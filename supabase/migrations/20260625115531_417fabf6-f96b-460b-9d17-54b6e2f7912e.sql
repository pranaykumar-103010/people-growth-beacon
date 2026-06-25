
-- Step 1: Additive columns for AI insights and segmentation
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS talent_segment text,
  ADD COLUMN IF NOT EXISTS retention_risk_band text,
  ADD COLUMN IF NOT EXISTS flight_risk_drivers text[],
  ADD COLUMN IF NOT EXISTS ai_readiness_score integer,
  ADD COLUMN IF NOT EXISTS ai_readiness_band text,
  ADD COLUMN IF NOT EXISTS leadership_readiness text,
  ADD COLUMN IF NOT EXISTS ai_recommended_actions text[],
  ADD COLUMN IF NOT EXISTS ai_insight_generated_at timestamptz;

-- Department insights cache
CREATE TABLE IF NOT EXISTS public.department_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL UNIQUE,
  strengths text[] NOT NULL DEFAULT '{}',
  risks text[] NOT NULL DEFAULT '{}',
  actions text[] NOT NULL DEFAULT '{}',
  summary text,
  generated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.department_insights TO authenticated;
GRANT ALL ON public.department_insights TO service_role;

ALTER TABLE public.department_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dept_insights_select_all_auth" ON public.department_insights
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dept_insights_admin_write" ON public.department_insights
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'hrbp_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'hrbp_admin'));

CREATE TRIGGER dept_insights_touch BEFORE UPDATE ON public.department_insights
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Deterministic compute function for the new fields based on existing data
CREATE OR REPLACE FUNCTION public.compute_talent_fields()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.employees SET
    retention_risk_band = CASE
      WHEN attrition_risk >= 80 THEN 'critical'
      WHEN attrition_risk >= 65 THEN 'high'
      WHEN attrition_risk >= 40 THEN 'medium'
      ELSE 'low' END,
    talent_segment = CASE
      WHEN h2_rating >= 3.5 AND potential_rating >= 3.5 AND attrition_risk >= 65 THEN 'Flight Risk Stars'
      WHEN h2_rating >= 3.5 AND potential_rating >= 3.5 THEN 'Future Leaders'
      WHEN h2_rating >= 3.5 AND attrition_risk >= 65 THEN 'Retention Priority'
      WHEN potential_rating >= 3.5 AND attrition_risk < 40 THEN 'Emerging Talent'
      WHEN h2_rating >= 3.5 THEN 'Core Talent'
      WHEN h2_rating >= 2.5 AND attrition_risk >= 65 THEN 'Watch List'
      WHEN h2_rating >= 2.5 THEN 'Solid Contributors'
      WHEN attrition_risk >= 65 THEN 'Critical Intervention'
      ELSE 'Performance Concern' END,
    leadership_readiness = CASE
      WHEN h2_rating >= 4 AND potential_rating >= 4 AND EXTRACT(DAY FROM (now() - joining_date::timestamptz))/365.0 >= 3 THEN 'ready_now'
      WHEN h2_rating >= 3.5 AND potential_rating >= 4 THEN 'ready_1y'
      WHEN potential_rating >= 3.5 THEN 'ready_2y'
      ELSE 'ic_track' END,
    ai_readiness_score = LEAST(100, GREATEST(0, ROUND(
      (potential_rating * 12) +
      (h2_rating * 8) +
      (CASE WHEN level IN ('L3','L4','L5','L6') THEN 10 ELSE 5 END) +
      (CASE WHEN sub_vertical ILIKE '%AI%' OR sub_vertical ILIKE '%ML%' OR sub_vertical ILIKE '%data%' OR sub_vertical ILIKE '%engineering%' THEN 15 ELSE 5 END) +
      30
    )::int)),
    ai_readiness_band = CASE
      WHEN potential_rating >= 4 AND h2_rating >= 4 THEN 'AI Champion'
      WHEN potential_rating >= 3.5 THEN 'AI Ready'
      WHEN potential_rating >= 2.5 THEN 'AI Learner'
      ELSE 'AI Beginner' END,
    flight_risk_drivers = CASE
      WHEN attrition_risk >= 65 AND h2_rating >= 3.5 AND potential_rating >= 3.5 THEN ARRAY['Career Growth','Lack of Recognition','Compensation']
      WHEN attrition_risk >= 65 AND h2_rating < 2.5 THEN ARRAY['Manager Dependency','Skill Stagnation','Workload']
      WHEN attrition_risk >= 40 AND potential_rating >= 3.5 THEN ARRAY['Internal Mobility','Career Growth','Leadership Gap']
      WHEN attrition_risk >= 40 THEN ARRAY['Workload','Manager Dependency','Lack of Recognition']
      ELSE ARRAY[]::text[] END
  WHERE active = true;
END $$;

SELECT public.compute_talent_fields();
