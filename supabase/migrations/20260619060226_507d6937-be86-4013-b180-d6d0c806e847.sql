
-- 1. Recursive rollup-chain function
CREATE OR REPLACE FUNCTION public.is_in_rollup_chain(_viewer_email text, _emp_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(_viewer_email,''));
BEGIN
  IF v_email = '' THEN RETURN false; END IF;
  RETURN EXISTS (
    WITH RECURSIVE chain AS (
      SELECT emp_id, lower(coalesce(manager_email,'')) AS mgr
      FROM public.employees WHERE emp_id = _emp_id
      UNION ALL
      SELECT e.emp_id, lower(coalesce(e.manager_email,''))
      FROM public.employees e
      JOIN chain c ON lower(coalesce(e.email,'')) = c.mgr
      WHERE c.mgr <> ''
    )
    SELECT 1 FROM chain WHERE mgr = v_email
  );
END $$;

-- 2. Extended visibility function (kept signature-compatible)
CREATE OR REPLACE FUNCTION public.can_view_emp_v2(_viewer_email text, _emp_id text, _emp_mgr text, _emp_rollup text, _emp_fh text, _emp_email text)
RETURNS boolean
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT _viewer_email IS NOT NULL AND (
    lower(coalesce(_emp_mgr,''))    = _viewer_email
    OR lower(coalesce(_emp_rollup,''))= _viewer_email
    OR lower(coalesce(_emp_fh,''))    = _viewer_email
    OR lower(coalesce(_emp_email,'')) = _viewer_email
    OR public.is_in_rollup_chain(_viewer_email, _emp_id)
  )
$$;

-- 3. Replace SELECT policy on employees to use v2
DROP POLICY IF EXISTS "employees select" ON public.employees;
DROP POLICY IF EXISTS "Employees readable by allowed viewers" ON public.employees;
CREATE POLICY "Employees readable by allowed viewers"
ON public.employees FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(),'hrbp_admin')
  OR public.can_view_emp_v2(public.current_user_email(), emp_id, manager_email, rollup_manager_email, function_head_email, email)
);

-- 4. Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email text NOT NULL,
  emp_id text NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit insert by self" ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (lower(actor_email) = public.current_user_email());

CREATE POLICY "Audit readable by hrbp_admin" ON public.audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'hrbp_admin'));
