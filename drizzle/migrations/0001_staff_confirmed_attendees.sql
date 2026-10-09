CREATE OR REPLACE FUNCTION public.staff_confirmed_attendees(_search text DEFAULT '', _offset integer DEFAULT 0)
RETURNS TABLE(full_name text, attendee_code text, ticket_name text, checked_in_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT app_private.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY
  SELECT p.full_name, r.attendee_code, t.name, ci.checked_in_at
  FROM public.registrations r
  JOIN public.ticket_types t ON t.id = r.ticket_type_id
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN LATERAL (
    SELECT c.checked_in_at FROM public.check_ins c
    JOIN public.attendee_badges b ON b.id = c.badge_id
    WHERE b.registration_id = r.id AND c.programme_item_id IS NULL
    ORDER BY c.checked_in_at LIMIT 1
  ) ci ON true
  WHERE r.status = 'paid'
    AND (coalesce(p.full_name, '') ILIKE '%' || left(coalesce(_search, ''), 100) || '%'
      OR r.attendee_code ILIKE '%' || left(coalesce(_search, ''), 100) || '%')
  ORDER BY coalesce(p.full_name, ''), r.attendee_code
  LIMIT 50 OFFSET greatest(coalesce(_offset, 0), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_confirmed_attendees(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_confirmed_attendees(text, integer) TO authenticated;
COMMENT ON FUNCTION public.staff_confirmed_attendees(text, integer) IS 'Staff-only paid attendance roster; no contacts, badge tokens, private notes or payment payloads. Check-in remains QR verified.';