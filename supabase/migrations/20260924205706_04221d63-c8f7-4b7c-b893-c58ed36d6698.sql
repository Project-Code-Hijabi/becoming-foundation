REVOKE EXECUTE ON FUNCTION public.generate_qr_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_qr_token() TO service_role;