CREATE OR REPLACE FUNCTION public.guard_connection_request_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profile_privacy pp
                 WHERE pp.profile_id = NEW.recipient_id AND pp.networking_enabled) THEN
    RAISE EXCEPTION 'This attendee is not accepting connections';
  END IF;
  RETURN NEW;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.guard_connection_request_insert() FROM PUBLIC, anon, authenticated;