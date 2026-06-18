ALTER FUNCTION public.can_view_emp(text,text,text,text,text) SET search_path = public;
ALTER FUNCTION public.compute_quadrant(numeric,numeric) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.current_user_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_emp(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_emp(text,text,text,text,text) TO authenticated;