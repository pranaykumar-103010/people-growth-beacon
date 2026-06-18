
-- Drop old employees (schema is changing) and notes referencing it
DROP TABLE IF EXISTS public.hrbp_notes CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;

-- Directory: name <-> email
CREATE TABLE public.employee_directory (
  email text PRIMARY KEY,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_directory TO authenticated;
GRANT ALL ON public.employee_directory TO service_role;
ALTER TABLE public.employee_directory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authed can read directory" ON public.employee_directory
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage directory" ON public.employee_directory
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'hrbp_admin'))
  WITH CHECK (public.has_role(auth.uid(),'hrbp_admin'));

-- Employees
CREATE TABLE public.employees (
  emp_id text PRIMARY KEY,
  name text NOT NULL,
  email text,
  job_title text,
  level text,
  department text NOT NULL DEFAULT 'Technology',
  sub_vertical text,
  joining_date date NOT NULL DEFAULT CURRENT_DATE,
  h2_rating numeric(3,2) NOT NULL DEFAULT 3,
  potential_rating numeric(3,2) NOT NULL DEFAULT 3,
  manager_email text NOT NULL,
  rollup_manager_email text,
  function_head_email text,
  nine_box_quadrant text NOT NULL DEFAULT 'Core Player',
  attrition_risk integer NOT NULL DEFAULT 0,
  rag_status text NOT NULL DEFAULT 'green',
  succession_notes text,
  future_career_path text,
  hrbp_insights text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_email() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(p.email) FROM public.profiles p WHERE p.id = auth.uid()
  UNION ALL SELECT lower(((auth.jwt() ->> 'email')::text)) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_view_emp(
  _viewer_email text, _emp_mgr text, _emp_rollup text, _emp_fh text, _emp_email text
) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT _viewer_email IS NOT NULL AND (
    lower(_emp_mgr) = _viewer_email
    OR lower(coalesce(_emp_rollup,'')) = _viewer_email
    OR lower(coalesce(_emp_fh,'')) = _viewer_email
    OR lower(coalesce(_emp_email,'')) = _viewer_email
  )
$$;

CREATE POLICY "View employees by role/hierarchy" ON public.employees
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'hrbp_admin')
    OR public.can_view_emp(
      public.current_user_email(), manager_email, rollup_manager_email, function_head_email, email
    )
  );

CREATE POLICY "Admins manage employees" ON public.employees
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'hrbp_admin'))
  WITH CHECK (public.has_role(auth.uid(),'hrbp_admin'));

CREATE TRIGGER trg_employees_touch BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.hrbp_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public.employees(emp_id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  note text NOT NULL,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hrbp_notes TO authenticated;
GRANT ALL ON public.hrbp_notes TO service_role;
ALTER TABLE public.hrbp_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage notes" ON public.hrbp_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'hrbp_admin'))
  WITH CHECK (public.has_role(auth.uid(),'hrbp_admin'));
CREATE POLICY "View notes if can view employee" ON public.hrbp_notes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.emp_id = hrbp_notes.employee_id));

CREATE OR REPLACE FUNCTION public.compute_quadrant(_perf numeric, _pot numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _perf >= 3.5 AND _pot >= 3.5 THEN 'Star'
    WHEN _perf BETWEEN 2.5 AND 3.49 AND _pot >= 3.5 THEN 'Key Player'
    WHEN _perf < 2.5 AND _pot >= 3.5 THEN 'Question Mark'
    WHEN _perf >= 3.5 AND _pot BETWEEN 2.5 AND 3.49 THEN 'High Performer'
    WHEN _perf BETWEEN 2.5 AND 3.49 AND _pot BETWEEN 2.5 AND 3.49 THEN 'Core Player'
    WHEN _perf < 2.5 AND _pot BETWEEN 2.5 AND 3.49 THEN 'Inconsistent'
    WHEN _perf >= 3.5 AND _pot < 2.5 THEN 'Risk'
    WHEN _perf BETWEEN 2.5 AND 3.49 AND _pot < 2.5 THEN 'Solid Performer'
    ELSE 'Iceberg' END
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text := lower(NEW.email);
  _role app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  IF _email = 'pranay.kumar@flick2know.com' THEN
    _role := 'hrbp_admin';
  ELSIF EXISTS (SELECT 1 FROM public.employees WHERE lower(function_head_email)=_email) THEN
    _role := 'function_head';
  ELSIF EXISTS (SELECT 1 FROM public.employees WHERE lower(rollup_manager_email)=_email) THEN
    _role := 'rollup_manager';
  ELSIF EXISTS (SELECT 1 FROM public.employees WHERE lower(manager_email)=_email) THEN
    _role := 'manager';
  ELSE
    _role := 'manager';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.employee_directory (email, display_name) VALUES
('anand.abraham.samuel@flick2know.com', 'Anand Abraham Samuel'),
('anuj.gupta@flick2know.com', 'Anuj Gupta'),
('varun.pandey@flick2know.com', 'Varun Pandey'),
('animesh.agrawal@flick2know.com', 'Animesh Agrawal'),
('himanshu.saini@flick2know.com', 'Himanshu Saini'),
('mehak.sachdeva@flick2know.com', 'Mehak Sachdeva'),
('alumuru.jayavardhan@flick2know.com', 'Alumuru Jayavardhan'),
('puneet.upadhayay@flick2know.com', 'Puneet Upadhayay'),
('pooja.yadav@flick2know.com', 'Pooja Yadav'),
('sirisht.qureshi@flick2know.com', 'Sirisht Qureshi'),
('pratiksha.sharma@flick2know.com', 'Pratiksha Sharma'),
('taranjeet.singh@flick2know.com', 'Taranjeet Singh'),
('tushar.sharma@flick2know.com', 'Tushar Sharma'),
('riya.sethi@flick2know.com', 'Riya Sethi'),
('ritesh.vitthal.khadse@flick2know.com', 'Ritesh Vitthal Khadse'),
('priyanka.malik@flick2know.com', 'Priyanka Malik'),
('naman.popli@flick2know.com', 'Naman Popli'),
('kapil.sharma@flick2know.com', 'Kapil Sharma'),
('rajiv.sharma@flick2know.com', 'Rajiv Sharma'),
('akshay.singh@flick2know.com', 'Akshay Singh'),
('sushant.thakur@flick2know.com', 'Sushant Thakur'),
('pushpender.singh.jodha@flick2know.com', 'Pushpender Singh Jodha'),
('deepali.srivastava@flick2know.com', 'Deepali Srivastava'),
('pranshu.singh@flick2know.com', 'Pranshu Singh'),
('vipin.vishwakarma@flick2know.com', 'Vipin Vishwakarma'),
('amit.upadhyay@flick2know.com', 'Amit Upadhyay'),
('subham.pandey@flick2know.com', 'Subham Pandey'),
('rakshit.sharma@flick2know.com', 'Rakshit Sharma'),
('abhishek.kumar@flick2know.com', 'Abhishek Kumar'),
('vatsal.ketan.gandhi@flick2know.com', 'Vatsal Ketan Gandhi'),
('pragati.pandey@flick2know.com', 'Pragati Pandey'),
('mohit.kumar@flick2know.com', 'Mohit Kumar'),
('khushboo.agrawal@flick2know.com', 'Khushboo Agrawal'),
('manas.agarwal@flick2know.com', 'Manas Agarwal'),
('mayank.shrivastava@flick2know.com', 'Mayank Shrivastava'),
('chirag.kaushik@flick2know.com', 'Chirag Kaushik'),
('sourav.sharma@flick2know.com', 'Sourav Sharma') ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

INSERT INTO public.employees (emp_id, name, email, job_title, level, department, sub_vertical, joining_date, h2_rating, potential_rating, manager_email, rollup_manager_email, function_head_email, nine_box_quadrant, attrition_risk, rag_status, active) VALUES
('F2K0060', 'Anand Abraham Samuel', 'anand.abraham.samuel@flick2know.com', 'Lead QA', 'L3', 'Technology', 'QA SFA', '2018-02-14', 2.8, 3.5, 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'varun.pandey@flick2know.com', 'Key Player', 43, 'amber', true),
('F2K0171', 'Animesh Agrawal', 'animesh.agrawal@flick2know.com', 'Team Lead', 'L4', 'Technology', 'Fai', '2020-12-01', 3.6, 4.0, 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 27, 'green', true),
('F2K0174', 'Himanshu Saini', 'himanshu.saini@flick2know.com', 'Team Lead', 'L4', 'Technology', 'GT', '2020-12-01', 3.5, 3.5, 'mehak.sachdeva@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 27, 'green', true),
('F2K0211', 'Alumuru Jayavardhan', 'alumuru.jayavardhan@flick2know.com', 'Software Development Engineer-2', 'L2', 'Technology', 'Engineering', '2021-06-15', 2.5, 4.5, 'mehak.sachdeva@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Question Mark', 57, 'amber', true),
('F2K0239', 'Puneet Upadhayay', 'puneet.upadhayay@flick2know.com', 'Senior QA Engineer', 'L2', 'Technology', 'QA - HCCB', '2021-08-01', 2.2, 3.7, 'anand.abraham.samuel@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Question Mark', 59, 'amber', true),
('F2K0241', 'Pooja Yadav', 'pooja.yadav@flick2know.com', 'Senior QA Engineer', 'L2', 'Technology', 'QA GT Onboarding', '2021-08-02', 2.37, 3.65, 'anand.abraham.samuel@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Question Mark', 54, 'amber', true),
('F2K0244', 'Sirisht Qureshi', 'sirisht.qureshi@flick2know.com', 'Senior QA Engineer', 'L2', 'Technology', 'QA GT Road Map', '2021-09-01', 3.5, 4.55, 'anand.abraham.samuel@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 33, 'green', true),
('F2K0249', 'Pratiksha Sharma', 'pratiksha.sharma@flick2know.com', 'Software Development Engineer-3', 'L3', 'Technology', 'GT', '2021-09-20', 3.0, 4.2, 'mehak.sachdeva@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Key Player', 43, 'amber', true),
('F2K0252', 'Taranjeet Singh', 'taranjeet.singh@flick2know.com', 'Team Lead', 'L4', 'Technology', 'GT', '2021-11-01', 4.0, 4.6, 'tushar.sharma@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 21, 'green', true),
('F2K0267', 'Riya Sethi', 'riya.sethi@flick2know.com', 'Software Development Engineer-3', 'L1', 'Technology', 'GT', '2022-01-17', 1.3, 3.1, 'pratiksha.sharma@flick2know.com', 'mehak.sachdeva@flick2know.com', 'varun.pandey@flick2know.com', 'Inconsistent', 76, 'red', true),
('F2K0296', 'Ritesh Vitthal Khadse', 'ritesh.vitthal.khadse@flick2know.com', 'Software Development Engineer-3', 'L3', 'Technology', 'Engineering', '2022-05-01', 4.0, 4.9, 'tushar.sharma@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 23, 'green', true),
('F2K0308', 'Priyanka Malik', 'priyanka.malik@flick2know.com', 'Software Development Engineer-3', 'L3', 'Technology', 'GT', '2022-06-01', 3.5, 5.0, 'himanshu.saini@flick2know.com', 'mehak.sachdeva@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 36, 'green', true),
('F2K0309', 'Naman Popli', 'naman.popli@flick2know.com', 'Software Development Engineer-3', 'L3', 'Technology', 'GT', '2022-06-01', 3.5, 4.45, 'pratiksha.sharma@flick2know.com', 'mehak.sachdeva@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 32, 'green', true),
('F2K0311', 'Kapil Sharma', 'kapil.sharma@flick2know.com', 'Team Lead', 'L4', 'Technology', 'GT', '2022-06-01', 3.6, 4.0, 'rajiv.sharma@flick2know.com', 'varun.pandey@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 27, 'green', true),
('F2K0312', 'Akshay Singh', 'akshay.singh@flick2know.com', 'Software Development Engineer-3', 'L3', 'Technology', 'GT', '2022-06-01', 3.5, 4.45, 'mehak.sachdeva@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 32, 'green', true),
('F2K0313', 'Sushant Thakur', 'sushant.thakur@flick2know.com', 'Senior QA Engineer', 'L2', 'Technology', 'QA GT Road Map', '2022-06-01', 3.5, 4.35, 'anand.abraham.samuel@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 32, 'green', true),
('F2K0376', 'Pushpender Singh Jodha', 'pushpender.singh.jodha@flick2know.com', 'QA Engineer', 'L1', 'Technology', 'QA - GT Maintenance', '2022-06-01', 2.0, 4.6, 'sushant.thakur@flick2know.com', 'anand.abraham.samuel@flick2know.com', 'varun.pandey@flick2know.com', 'Question Mark', 69, 'red', true),
('F2K0318', 'Deepali Srivastava', 'deepali.srivastava@flick2know.com', 'Senior QA Engineer', 'L2', 'Technology', 'QA - GT Maintenance', '2022-06-15', 3.5, 4.35, 'anand.abraham.samuel@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 32, 'green', true),
('F2K0326', 'Pranshu Singh', 'pranshu.singh@flick2know.com', 'QA Engineer', 'L1', 'Technology', 'QA GT Onboarding', '2022-07-01', 3.0, 4.1, 'sushant.thakur@flick2know.com', 'anand.abraham.samuel@flick2know.com', 'varun.pandey@flick2know.com', 'Key Player', 42, 'amber', true),
('F2K0329', 'Vipin Vishwakarma', 'vipin.vishwakarma@flick2know.com', 'Team Lead', 'L4', 'Technology', 'International', '2022-07-01', 4.0, 4.9, 'tushar.sharma@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 23, 'green', true),
('F2K0375', 'Amit Upadhyay', 'amit.upadhyay@flick2know.com', 'QA Engineer', 'L1', 'Technology', 'QA - HCCB', '2022-07-28', 2.65, 4.0, 'puneet.upadhayay@flick2know.com', 'anand.abraham.samuel@flick2know.com', 'varun.pandey@flick2know.com', 'Key Player', 50, 'amber', true),
('F2K0373', 'Subham Pandey', 'subham.pandey@flick2know.com', 'QA Engineer', 'L1', 'Technology', 'Tech Support', '2022-12-12', 3.5, 4.1, 'anand.abraham.samuel@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 30, 'green', true),
('F2K0386', 'Rakshit Sharma', 'rakshit.sharma@flick2know.com', 'Senior QA Engineer', 'L2', 'Technology', 'QA - GT Maintenance', '2023-02-17', 3.6, 4.55, 'deepali.srivastava@flick2know.com', 'anand.abraham.samuel@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 30, 'green', true),
('F2K0402', 'Abhishek Kumar', 'abhishek.kumar@flick2know.com', 'Team Lead', 'L4', 'Technology', 'GT', '2023-05-01', 4.0, 4.85, 'mehak.sachdeva@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 23, 'green', true),
('F2K0408', 'Vatsal Ketan Gandhi', 'vatsal.ketan.gandhi@flick2know.com', 'Software Development Engineer-3', 'L3', 'Technology', 'GT', '2023-05-31', 3.9, 4.0, 'rajiv.sharma@flick2know.com', 'varun.pandey@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 19, 'green', true),
('F2K0412', 'Pragati Pandey', 'pragati.pandey@flick2know.com', 'Software Development Engineer-2', 'L2', 'Technology', 'GT', '2023-06-05', 3.5, 4.5, 'abhishek.kumar@flick2know.com', 'mehak.sachdeva@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 33, 'green', true),
('F2K0414', 'Mohit Kumar', 'mohit.kumar@flick2know.com', 'Software Development Engineer-1', 'L1', 'Technology', 'GT', '2023-06-05', 2.7, 4.1, 'taranjeet.singh@flick2know.com', 'tushar.sharma@flick2know.com', 'varun.pandey@flick2know.com', 'Key Player', 49, 'amber', true),
('F2K0425', 'Khushboo Agrawal', 'khushboo.agrawal@flick2know.com', 'Software Development Engineer-2', 'L2', 'Technology', 'DMS', '2023-07-01', 3.8, 4.8, 'vipin.vishwakarma@flick2know.com', 'tushar.sharma@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 31, 'green', true),
('F2K0426', 'Manas Agarwal', 'manas.agarwal@flick2know.com', 'Software Development Engineer-3', 'L3', 'Technology', 'Fai', '2023-07-01', 4.0, 4.9, 'animesh.agrawal@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 27, 'green', true),
('F2K0427', 'Mayank Shrivastava', 'mayank.shrivastava@flick2know.com', 'Software Development Engineer-3', 'L3', 'Technology', 'Fai', '2023-07-01', 4.0, 5.0, 'animesh.agrawal@flick2know.com', 'anuj.gupta@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 28, 'green', true),
('F2K0428', 'Chirag Kaushik', 'chirag.kaushik@flick2know.com', 'Software Development Engineer-2', 'L2', 'Technology', 'GT', '2023-07-01', 3.5, 5.0, 'akshay.singh@flick2know.com', 'mehak.sachdeva@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 40, 'amber', true),
('F2K0430', 'Sourav Sharma', 'sourav.sharma@flick2know.com', 'Software Development Engineer-3', 'L3', 'Technology', 'GT Flutter', '2023-07-01', 3.9, 4.0, 'rajiv.sharma@flick2know.com', 'varun.pandey@flick2know.com', 'varun.pandey@flick2know.com', 'Star', 23, 'green', true) ON CONFLICT (emp_id) DO NOTHING;