-- =========================================================
-- 1. LEAST-PRIVILEGE GRANTS
-- =========================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Public (published) content: anon read-only, authenticated full CRUD gated by RLS
GRANT SELECT ON public.announcements, public.award_categories, public.award_recipients,
  public.people, public.programme_items, public.session_speakers,
  public.hackathon_teams, public.hackathon_team_members, public.ticket_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements, public.award_categories,
  public.award_recipients, public.people, public.programme_items, public.session_speakers,
  public.hackathon_teams, public.hackathon_team_members, public.ticket_types TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles, public.profile_privacy, public.registrations TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendee_badges, public.check_ins,
  public.dear_future_me, public.becoming_entries, public.user_roles TO authenticated;
GRANT SELECT, INSERT ON public.badge_scans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.connection_requests TO authenticated;
GRANT SELECT, DELETE ON public.connections TO authenticated;

-- =========================================================
-- 2. UNGUESSABLE QR TOKENS
-- =========================================================
CREATE OR REPLACE FUNCTION public.generate_qr_token()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'PCHB26-' || md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
$$;

ALTER TABLE public.attendee_badges ALTER COLUMN qr_token SET DEFAULT public.generate_qr_token();

UPDATE public.attendee_badges SET qr_token = public.generate_qr_token()
WHERE length(qr_token) < 40;

-- =========================================================
-- 3. BADGES: staff must not read every QR token
-- =========================================================
DROP POLICY IF EXISTS "own or staff badge read" ON public.attendee_badges;
CREATE POLICY "badges read own or admin" ON public.attendee_badges
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Controlled staff lookup: minimal check-in payload only, never the token itself
CREATE OR REPLACE FUNCTION public.staff_lookup_badge(_qr_token text)
RETURNS TABLE(badge_id uuid, user_id uuid, full_name text, photo_path text,
              ticket_name text, badge_status badge_status, registration_status registration_status,
              already_checked_in boolean, dietary_notes text, accessibility_notes text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN QUERY
  SELECT b.id, b.user_id, p.full_name, p.photo_path, tt.name, b.status, r.status,
         EXISTS (SELECT 1 FROM public.check_ins ci
                 WHERE ci.badge_id = b.id AND ci.programme_item_id IS NULL),
         r.dietary_notes, r.accessibility_notes
  FROM public.attendee_badges b
  JOIN public.registrations r ON r.id = b.registration_id
  JOIN public.ticket_types tt ON tt.id = r.ticket_type_id
  LEFT JOIN public.profiles p ON p.id = b.user_id
  WHERE b.qr_token = _qr_token;
END; $$;
REVOKE ALL ON FUNCTION public.staff_lookup_badge(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_lookup_badge(text) TO authenticated;

-- =========================================================
-- 4. REGISTRATIONS: staff no longer read all registrations
-- =========================================================
DROP POLICY IF EXISTS "own registration read" ON public.registrations;
CREATE POLICY "registrations read own or admin" ON public.registrations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Attendees may only edit notes on their own pending registration
CREATE POLICY "registrations update own notes" ON public.registrations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Registration integrity: one active registration per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_one_active
  ON public.registrations (user_id) WHERE status IN ('pending','paid');

-- Attendees may never change money/status fields on their own row
CREATE OR REPLACE FUNCTION public.guard_registration_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.amount_kobo IS DISTINCT FROM OLD.amount_kobo
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.ticket_type_id IS DISTINCT FROM OLD.ticket_type_id
     OR NEW.attendee_code IS DISTINCT FROM OLD.attendee_code
     OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Only dietary/accessibility notes may be changed';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_registration ON public.registrations;
CREATE TRIGGER trg_guard_registration BEFORE UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_registration_update();

-- =========================================================
-- 5. PAYMENTS: safe attendee summary, raw payload stays server-side
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_my_payment_summary()
RETURNS TABLE(registration_id uuid, attendee_code text, ticket_name text,
              amount_kobo integer, currency text, status payment_status,
              reference text, paid_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pay.registration_id, r.attendee_code, tt.name, pay.amount_kobo, pay.currency,
         pay.status, pay.tx_ref, pay.paid_at
  FROM public.payments pay
  JOIN public.registrations r ON r.id = pay.registration_id
  JOIN public.ticket_types tt ON tt.id = r.ticket_type_id
  WHERE pay.user_id = auth.uid() AND auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_my_payment_summary() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_payment_summary() TO authenticated;

-- =========================================================
-- 6. CONNECTION REQUESTS: requester cannot self-accept
-- =========================================================
CREATE OR REPLACE FUNCTION public.guard_connection_request_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.requester_id IS DISTINCT FROM OLD.requester_id
     OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id THEN
    RAISE EXCEPTION 'Request parties cannot be changed';
  END IF;
  IF auth.uid() = OLD.recipient_id THEN
    IF OLD.status <> 'pending' AND NEW.status <> 'blocked' THEN
      RAISE EXCEPTION 'Request already answered';
    END IF;
    IF NEW.status NOT IN ('accepted','declined','blocked') THEN
      RAISE EXCEPTION 'Invalid response';
    END IF;
  ELSIF auth.uid() = OLD.requester_id THEN
    -- requester may only withdraw a pending request
    IF NEW.status <> 'declined' OR OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Requester may only withdraw a pending request';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not a party to this request';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_request ON public.connection_requests;
CREATE TRIGGER trg_guard_request BEFORE UPDATE ON public.connection_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_connection_request_update();

-- Networking requires the recipient to be discoverable/networking-enabled
CREATE OR REPLACE FUNCTION public.guard_connection_request_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profile_privacy pp
                 WHERE pp.profile_id = NEW.recipient_id AND pp.networking_enabled) THEN
    RAISE EXCEPTION 'This attendee is not accepting connections';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_request_insert ON public.connection_requests;
CREATE TRIGGER trg_guard_request_insert BEFORE INSERT ON public.connection_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_connection_request_insert();

-- =========================================================
-- 7. CHECK-IN VALIDATION
-- =========================================================
CREATE OR REPLACE FUNCTION public.guard_check_in()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE b RECORD;
BEGIN
  SELECT ab.status, ab.user_id, r.status AS reg_status
    INTO b FROM public.attendee_badges ab
    JOIN public.registrations r ON r.id = ab.registration_id
    WHERE ab.id = NEW.badge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown badge'; END IF;
  IF b.status <> 'active' THEN RAISE EXCEPTION 'Badge has been revoked'; END IF;
  IF b.reg_status <> 'paid' THEN RAISE EXCEPTION 'Registration is not paid'; END IF;
  NEW.user_id := b.user_id;
  IF auth.uid() IS NOT NULL THEN NEW.checked_in_by := auth.uid(); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_check_in ON public.check_ins;
CREATE TRIGGER trg_guard_check_in BEFORE INSERT ON public.check_ins
  FOR EACH ROW EXECUTE FUNCTION public.guard_check_in();

-- =========================================================
-- 8. SESSION SPEAKERS: don't leak unpublished programme
-- =========================================================
DROP POLICY IF EXISTS "session speakers readable" ON public.session_speakers;
CREATE POLICY "published session speakers readable" ON public.session_speakers
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.programme_items pi
                 WHERE pi.id = session_speakers.programme_item_id AND pi.is_published)
         OR public.is_admin(auth.uid()));

-- =========================================================
-- 9. ROLE ESCALATION DEFENCE IN DEPTH
-- =========================================================
CREATE OR REPLACE FUNCTION public.guard_user_roles()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE target_role app_role;
BEGIN
  IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  target_role := COALESCE(NEW.role, OLD.role);
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin may change roles';
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own roles';
  END IF;
  IF TG_OP <> 'DELETE' THEN NEW.granted_by := auth.uid(); END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_guard_user_roles ON public.user_roles;
CREATE TRIGGER trg_guard_user_roles BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_roles();

-- =========================================================
-- 10. PROFILES: admins may read but not silently edit attendee profiles
-- =========================================================
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- =========================================================
-- 11. STORAGE POLICIES (all buckets private)
-- =========================================================
DROP POLICY IF EXISTS "attendee photos owner" ON storage.objects;
CREATE POLICY "attendee photos owner" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'attendee-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'attendee-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "attendee photos connections read" ON storage.objects;
CREATE POLICY "attendee photos connections read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attendee-photos'
         AND public.are_connected(auth.uid(), ((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "becoming media owner only" ON storage.objects;
CREATE POLICY "becoming media owner only" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'becoming-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'becoming-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "event assets admin manage" ON storage.objects;
CREATE POLICY "event assets admin manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'event-assets' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'event-assets' AND public.is_admin(auth.uid()));

-- =========================================================
-- 12. SUPPORTING INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_badges_token ON public.attendee_badges (qr_token);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS idx_requests_recipient ON public.connection_requests (recipient_id);
CREATE INDEX IF NOT EXISTS idx_scans_scanner ON public.badge_scans (scanner_user_id);
CREATE INDEX IF NOT EXISTS idx_becoming_user ON public.becoming_entries (user_id);
