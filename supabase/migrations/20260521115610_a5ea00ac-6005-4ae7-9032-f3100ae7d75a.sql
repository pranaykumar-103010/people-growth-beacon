
-- Roles
CREATE TYPE public.app_role AS ENUM ('hrbp_admin', 'manager');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'hrbp_admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'hrbp_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'hrbp_admin'));

-- Profiles (to map auth user to email for manager lookup)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'hrbp_admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  -- Default new users to manager role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'manager');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Employees
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  sub_department text NOT NULL,
  job_title text,
  manager_email text NOT NULL,
  date_joined date NOT NULL DEFAULT CURRENT_DATE,
  risk_score integer NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  performance_rating numeric(2,1) NOT NULL DEFAULT 3 CHECK (performance_rating BETWEEN 1 AND 5),
  potential_rating numeric(2,1) NOT NULL DEFAULT 3 CHECK (potential_rating BETWEEN 1 AND 5),
  nine_box_quadrant text NOT NULL DEFAULT 'Core',
  induction_status integer NOT NULL DEFAULT 0 CHECK (induction_status BETWEEN 0 AND 100),
  risk_drivers text[] NOT NULL DEFAULT '{}',
  last_analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_employees_manager_email ON public.employees(manager_email);
CREATE INDEX idx_employees_risk ON public.employees(risk_score DESC);

-- Manager sees only their reports; admin sees all
CREATE POLICY "Managers view own reports" ON public.employees
  FOR SELECT TO authenticated USING (
    manager_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "Admins view all employees" ON public.employees
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'hrbp_admin'));
CREATE POLICY "Admins manage employees" ON public.employees
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'hrbp_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'hrbp_admin'));
CREATE POLICY "Managers update own reports" ON public.employees
  FOR UPDATE TO authenticated USING (
    manager_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

-- HRBP private notes
CREATE TABLE public.hrbp_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hrbp_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_hrbp_notes_employee ON public.hrbp_notes(employee_id, created_at DESC);

CREATE POLICY "Admins view all notes" ON public.hrbp_notes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'hrbp_admin'));
CREATE POLICY "Admins manage notes" ON public.hrbp_notes
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'hrbp_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'hrbp_admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER employees_touch BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
