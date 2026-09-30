DROP POLICY IF EXISTS "own registration create" ON public.registrations;
REVOKE INSERT ON public.registrations FROM authenticated, anon;