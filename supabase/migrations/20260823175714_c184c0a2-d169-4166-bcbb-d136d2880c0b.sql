ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS enps_score integer,
  ADD COLUMN IF NOT EXISTS one_on_one_cadence text,
  ADD COLUMN IF NOT EXISTS goal_quality_index integer,
  ADD COLUMN IF NOT EXISTS prev_fy_rating numeric,
  ADD COLUMN IF NOT EXISTS exit_type text,
  ADD COLUMN IF NOT EXISTS is_critical_role boolean NOT NULL DEFAULT false;

-- Deterministic, plausible seed values for fields not present in the uploaded master sheet.
WITH s AS (
  SELECT emp_id, abs(hashtext(emp_id)) AS h FROM public.employees
)
UPDATE public.employees e SET
  location = COALESCE(e.location, (ARRAY['Gurugram','Bengaluru','Pune','Mumbai','Remote'])[(s.h % 5) + 1]),
  enps_score = COALESCE(e.enps_score, GREATEST(-40, LEAST(80, ROUND(((e.annual_rating - 3) * 18) + 20 - ((e.attrition_risk::numeric) * 0.6) + (s.h % 17))::int))),
  one_on_one_cadence = COALESCE(e.one_on_one_cadence, (ARRAY['Weekly','Fortnightly','Monthly','Ad-hoc'])[(s.h % 4) + 1]),
  goal_quality_index = COALESCE(e.goal_quality_index, GREATEST(30, LEAST(98, ROUND((e.annual_rating * 12) + (e.potential_rating * 6) + 30 + (s.h % 11))::int))),
  prev_fy_rating = COALESCE(e.prev_fy_rating, GREATEST(1, LEAST(5, ROUND((e.annual_rating + (((s.h % 7) - 3)::numeric / 10))::numeric, 2)))),
  is_critical_role = COALESCE(e.is_critical_role, false) OR (e.potential_rating >= 3.5 AND e.annual_rating >= 3.5) OR e.level IN ('L5','L6','L7','L8')
FROM s WHERE s.emp_id = e.emp_id;

UPDATE public.employees SET exit_type = CASE WHEN annual_rating >= 3.5 THEN 'regrettable' ELSE 'non_regrettable' END
WHERE exit_date IS NOT NULL AND exit_type IS NULL;

CREATE TABLE IF NOT EXISTS public.open_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text NOT NULL,
  sub_vertical text,
  level text,
  location text,
  hiring_manager_email text,
  opened_on date NOT NULL DEFAULT CURRENT_DATE,
  filled_on date,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.open_positions TO authenticated;
GRANT ALL ON public.open_positions TO service_role;
ALTER TABLE public.open_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS open_positions_read ON public.open_positions;
CREATE POLICY open_positions_read ON public.open_positions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS open_positions_admin_write ON public.open_positions;
CREATE POLICY open_positions_admin_write ON public.open_positions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'hrbp_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'hrbp_admin'::app_role));

INSERT INTO public.open_positions (title, department, sub_vertical, level, location, opened_on, filled_on, status)
SELECT * FROM (VALUES
  ('Senior Backend Engineer','Technology','Engineering','L4','Gurugram', CURRENT_DATE - 62, NULL::date, 'open'),
  ('QA Automation Engineer','Technology','QA SFA','L3','Bengaluru', CURRENT_DATE - 34, NULL::date, 'open'),
  ('DevOps Engineer','Technology','Devops','L4','Remote', CURRENT_DATE - 96, NULL::date, 'open'),
  ('Flutter Developer','Technology','GT Flutter','L3','Pune', CURRENT_DATE - 18, NULL::date, 'open'),
  ('Tech Support Specialist','Technology','Tech Support','L2','Gurugram', CURRENT_DATE - 120, CURRENT_DATE - 25, 'filled'),
  ('Engineering Manager','Technology','Engineering','L6','Gurugram', CURRENT_DATE - 150, CURRENT_DATE - 40, 'filled')
) v WHERE NOT EXISTS (SELECT 1 FROM public.open_positions);

CREATE TABLE IF NOT EXISTS public.hrbp_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'team',
  trigger_type text,
  subject_emp_id text,
  subject_name text,
  manager_email text,
  assigned_hrbp text,
  context text,
  root_cause text,
  recommended_action text,
  status text NOT NULL DEFAULT 'pending',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hrbp_actions TO authenticated;
GRANT ALL ON public.hrbp_actions TO service_role;
ALTER TABLE public.hrbp_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hrbp_actions_read ON public.hrbp_actions;
CREATE POLICY hrbp_actions_read ON public.hrbp_actions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS hrbp_actions_write ON public.hrbp_actions;
CREATE POLICY hrbp_actions_write ON public.hrbp_actions FOR INSERT TO authenticated WITH CHECK (lower(coalesce(created_by,'')) = current_user_email());
DROP POLICY IF EXISTS hrbp_actions_update ON public.hrbp_actions;
CREATE POLICY hrbp_actions_update ON public.hrbp_actions FOR UPDATE TO authenticated
  USING (lower(coalesce(created_by,'')) = current_user_email() OR has_role(auth.uid(), 'hrbp_admin'::app_role))
  WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_hrbp_actions_touch ON public.hrbp_actions;
CREATE TRIGGER trg_hrbp_actions_touch BEFORE UPDATE ON public.hrbp_actions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();