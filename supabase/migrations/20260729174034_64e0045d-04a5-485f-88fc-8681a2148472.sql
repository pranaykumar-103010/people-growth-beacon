ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS annual_rating numeric,
  ADD COLUMN IF NOT EXISTS exit_date date,
  ADD COLUMN IF NOT EXISTS previous_level text,
  ADD COLUMN IF NOT EXISTS promoted_level text,
  ADD COLUMN IF NOT EXISTS promotion_effective_date date;

UPDATE public.employees SET annual_rating = COALESCE(annual_rating, h2_rating);
ALTER TABLE public.employees ALTER COLUMN annual_rating SET DEFAULT 3;
ALTER TABLE public.employees ALTER COLUMN annual_rating SET NOT NULL;

INSERT INTO public.hrbp_scopes (user_email, department)
SELECT 'varun@flick2know.com', 'Technology'
WHERE NOT EXISTS (
  SELECT 1 FROM public.hrbp_scopes WHERE lower(user_email)='varun@flick2know.com' AND department='Technology'
);