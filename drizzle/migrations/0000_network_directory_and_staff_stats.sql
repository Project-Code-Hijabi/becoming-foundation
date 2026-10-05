CREATE OR REPLACE FUNCTION public.network_directory()
RETURNS TABLE(id uuid, full_name text, profession text, organisation text, location text, interests text[], discoverable boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.profession, p.organisation, p.location, p.interests,
         (pp.networking_enabled AND pp.profile_discoverable)
  FROM public.profiles p
  JOIN public.profile_privacy pp ON pp.profile_id = p.id
  WHERE auth.uid() IS NOT NULL AND p.id <> auth.uid() AND (
    (pp.networking_enabled AND pp.profile_discoverable
      AND EXISTS (SELECT 1 FROM public.registrations r WHERE r.user_id = p.id AND r.status = 'paid')
      AND NOT EXISTS (SELECT 1 FROM public.connection_requests b WHERE b.status = 'blocked'
        AND ((b.requester_id = auth.uid() AND b.recipient_id = p.id) OR (b.recipient_id = auth.uid() AND b.requester_id = p.id))))
    OR EXISTS (SELECT 1 FROM public.connection_requests c
      WHERE (c.requester_id = auth.uid() AND c.recipient_id = p.id) OR (c.recipient_id = auth.uid() AND c.requester_id = p.id))
  );
$$;
REVOKE ALL ON FUNCTION public.network_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_event_stats()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_private.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN json_build_object(
    'confirmed', (SELECT count(*) FROM public.registrations WHERE status = 'paid'),
    'checked_in', (SELECT count(DISTINCT badge_id) FROM public.check_ins WHERE programme_item_id IS NULL),
    'recent', (SELECT coalesce(json_agg(x), '[]'::json) FROM (
      SELECT p.full_name, ci.checked_in_at FROM public.check_ins ci
      LEFT JOIN public.profiles p ON p.id = ci.user_id
      WHERE ci.programme_item_id IS NULL ORDER BY ci.checked_in_at DESC LIMIT 10) x));
END $$;
REVOKE ALL ON FUNCTION public.staff_event_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_event_stats() TO authenticated;