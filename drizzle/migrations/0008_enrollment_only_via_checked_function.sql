DROP POLICY IF EXISTS "enroll self" ON public.enrollments;
REVOKE INSERT ON public.enrollments FROM anon, authenticated;