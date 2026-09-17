CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;

CREATE OR REPLACE FUNCTION app_private.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin')); $$;

CREATE OR REPLACE FUNCTION app_private.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('staff','admin','super_admin')); $$;

CREATE OR REPLACE FUNCTION app_private.are_connected(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.connections WHERE user_a = LEAST(_a,_b) AND user_b = GREATEST(_a,_b)); $$;

REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.are_connected(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_admin(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_staff(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.are_connected(uuid, uuid) TO anon, authenticated, service_role;

DROP POLICY "admins manage announcements" ON public.announcements; CREATE POLICY "admins manage announcements" ON public.announcements FOR ALL TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
DROP POLICY "announcements readable signed in" ON public.announcements; CREATE POLICY "announcements readable signed in" ON public.announcements FOR SELECT TO authenticated USING ((app_private.is_admin(auth.uid()) OR ((is_published = true) AND ((publish_at IS NULL) OR (publish_at <= now())) AND ((audience = 'public'::text) OR (audience = 'attendees'::text)))));
DROP POLICY "admins manage badges" ON public.attendee_badges; CREATE POLICY "admins manage badges" ON public.attendee_badges FOR ALL TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
DROP POLICY "badges read own or admin" ON public.attendee_badges; CREATE POLICY "badges read own or admin" ON public.attendee_badges FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR app_private.is_admin(auth.uid())));
DROP POLICY "admins manage awards" ON public.award_categories; CREATE POLICY "admins manage awards" ON public.award_categories FOR ALL TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
DROP POLICY "published awards readable" ON public.award_categories; CREATE POLICY "published awards readable" ON public.award_categories FOR SELECT TO anon, authenticated USING (((is_published = true) OR app_private.is_admin(auth.uid())));
DROP POLICY "admins manage recipients" ON public.award_recipients; CREATE POLICY "admins manage recipients" ON public.award_recipients FOR ALL TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
DROP POLICY "published recipients readable" ON public.award_recipients; CREATE POLICY "published recipients readable" ON public.award_recipients FOR SELECT TO anon, authenticated USING (((EXISTS ( SELECT 1 FROM award_categories c WHERE ((c.id = award_recipients.category_id) AND c.is_published))) OR app_private.is_admin(auth.uid())));
DROP POLICY "scans read own" ON public.badge_scans; CREATE POLICY "scans read own" ON public.badge_scans FOR SELECT TO authenticated USING (((scanner_user_id = auth.uid()) OR app_private.is_admin(auth.uid())));
DROP POLICY "admins amend checkin" ON public.check_ins; CREATE POLICY "admins amend checkin" ON public.check_ins FOR ALL TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
DROP POLICY "checkin read" ON public.check_ins; CREATE POLICY "checkin read" ON public.check_ins FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR app_private.is_staff(auth.uid())));
DROP POLICY "staff record checkin" ON public.check_ins; CREATE POLICY "staff record checkin" ON public.check_ins FOR INSERT TO authenticated WITH CHECK ((app_private.is_staff(auth.uid()) AND (checked_in_by = auth.uid()) AND ((is_override = false) OR app_private.is_admin(auth.uid()))));
DROP POLICY "admins manage asset publications" ON public.event_asset_publications; CREATE POLICY "admins manage asset publications" ON public.event_asset_publications FOR ALL TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
DROP POLICY "published assets readable" ON public.event_asset_publications; CREATE POLICY "published assets readable" ON public.event_asset_publications FOR SELECT TO anon, authenticated USING (((is_published = true) OR app_private.is_admin(auth.uid())));
DROP POLICY "admins manage team members" ON public.hackathon_team_members; CREATE POLICY "admins manage team members" ON public.hackathon_team_members FOR ALL TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
DROP POLICY "team members readable" ON public.hackathon_team_members; CREATE POLICY "team members readable" ON public.hackathon_team_members FOR SELECT TO anon, authenticated USING (((EXISTS ( SELECT 1 FROM hackathon_teams t WHERE ((t.id = hackathon_team_members.team_id) AND t.is_published))) OR app_private.is_admin(auth.uid())));
DROP POLICY "admins manage teams" ON public.hackathon_teams; CREATE POLICY "admins manage teams" ON public.hackathon_teams FOR ALL TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
DROP POLICY "published teams readable" ON public.hackathon_teams; CREATE POLICY "published teams readable" ON public.hackathon_teams FOR SELECT TO anon, authenticated USING (((is_published = true) OR app_private.is_admin(auth.uid())));
DROP POLICY "admins read payments" ON public.payments; CREATE POLICY "admins read payments" ON public.payments FOR SELECT TO authenticated USING (app_private.is_admin(auth.uid()));
DROP POLICY "admins manage people" ON public.people; CREATE POLICY "admins manage people" ON public.people FOR ALL TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
DROP POLICY "published people readable" ON public.people; CREATE POLICY "published people readable" ON public.people FOR SELECT TO anon, authenticated USING (((is_published = true) OR app_private.is_admin(auth.uid())));
DROP POLICY "own privacy read" ON public.profile_privacy; CREATE POLICY "own privacy read" ON public.profile_privacy FOR SELECT TO authenticated USING (((profile_id = auth.uid()) OR app_private.is_admin(auth.uid())));
DROP POLICY "own profile read" ON public.profiles; CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR app_private.is_admin(auth.uid())));
DROP POLICY "admins manage programme" ON public.programme_items; CREATE POLICY "admins manage programme" ON public.programme_items FOR ALL TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
DROP POLICY "published programme readable" ON public.programme_items; CREATE POLICY "published programme readable" ON public.programme_items FOR SELECT TO anon, authenticated USING (((is_published = true) OR app_private.is_admin(auth.uid())));
DROP POLICY "admins update registrations" ON public.registrations; CREATE POLICY "admins update registrations" ON public.registrations FOR UPDATE TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
DROP POLICY "registrations read own or admin" ON public.registrations; CREATE POLICY "registrations read own or admin" ON public.registrations FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR app_private.is_admin(auth.uid())));
DROP POLICY "admins manage session speakers" ON public.session_speakers; CREATE POLICY "admins manage session speakers" ON public.session_speakers FOR ALL TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
DROP POLICY "published session speakers readable" ON public.session_speakers; CREATE POLICY "published session speakers readable" ON public.session_speakers FOR SELECT TO anon, authenticated USING (((EXISTS ( SELECT 1 FROM programme_items pi WHERE ((pi.id = session_speakers.programme_item_id) AND pi.is_published))) OR app_private.is_admin(auth.uid())));
DROP POLICY "active tickets public" ON public.ticket_types; CREATE POLICY "active tickets public" ON public.ticket_types FOR SELECT TO anon, authenticated USING (((is_active = true) OR app_private.is_admin(auth.uid())));
DROP POLICY "admins manage tickets" ON public.ticket_types; CREATE POLICY "admins manage tickets" ON public.ticket_types FOR ALL TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
DROP POLICY "roles managed by super admin" ON public.user_roles; CREATE POLICY "roles managed by super admin" ON public.user_roles FOR ALL TO authenticated USING (app_private.has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY "roles read own or admin" ON public.user_roles; CREATE POLICY "roles read own or admin" ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR app_private.is_admin(auth.uid())));
DROP POLICY "attendee photos connections read" ON storage.objects; CREATE POLICY "attendee photos connections read" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'attendee-photos'::text) AND app_private.are_connected(auth.uid(), ((storage.foldername(name))[1])::uuid)));
DROP POLICY "event assets admin manage" ON storage.objects; CREATE POLICY "event assets admin manage" ON storage.objects FOR ALL TO authenticated USING (((bucket_id = 'event-assets'::text) AND app_private.is_admin(auth.uid()))) WITH CHECK (((bucket_id = 'event-assets'::text) AND app_private.is_admin(auth.uid())));

CREATE OR REPLACE FUNCTION public.guard_check_in()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE b RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT app_private.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised to record check-ins';
  END IF;
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
END; $function$;

CREATE OR REPLACE FUNCTION public.guard_registration_update()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR app_private.is_admin(auth.uid()) THEN RETURN NEW; END IF;
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
END; $function$;

CREATE OR REPLACE FUNCTION public.guard_user_roles()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE target_role app_role;
BEGIN
  IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  target_role := COALESCE(NEW.role, OLD.role);
  IF NOT app_private.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin may change roles';
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own roles';
  END IF;
  IF TG_OP <> 'DELETE' THEN NEW.granted_by := auth.uid(); END IF;
  RETURN COALESCE(NEW, OLD);
END; $function$;

CREATE OR REPLACE FUNCTION public.staff_lookup_badge(_qr_token text)
RETURNS TABLE(badge_id uuid, user_id uuid, full_name text, photo_path text, ticket_name text, badge_status badge_status, registration_status registration_status, already_checked_in boolean, dietary_notes text, accessibility_notes text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT app_private.is_staff(auth.uid()) THEN
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
END; $function$;

CREATE OR REPLACE FUNCTION public.get_shareable_profile(_target uuid)
RETURNS TABLE(id uuid, full_name text, photo_path text, profession text, organisation text, location text, bio text, interests text[], skills text[], networking_preferences text, instagram text, linkedin text, whatsapp text, phone text, email text, is_connected boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  viewer UUID := auth.uid();
  connected BOOLEAN;
BEGIN
  IF viewer IS NULL THEN RETURN; END IF;
  connected := app_private.are_connected(viewer, _target);

  RETURN QUERY
  SELECT p.id, p.full_name, p.photo_path, p.profession, p.organisation, p.location,
         p.bio, p.interests, p.skills, p.networking_preferences,
         CASE WHEN viewer = p.id OR (connected AND pp.show_instagram_to_connections) THEN p.instagram END,
         CASE WHEN viewer = p.id OR (connected AND pp.show_linkedin_to_connections) THEN p.linkedin END,
         CASE WHEN viewer = p.id OR (connected AND pp.show_whatsapp_to_connections) THEN p.whatsapp END,
         CASE WHEN viewer = p.id OR (connected AND pp.show_phone_to_connections) THEN p.phone END,
         CASE WHEN viewer = p.id OR (connected AND pp.show_email_to_connections) THEN p.email END,
         connected
  FROM public.profiles p
  JOIN public.profile_privacy pp ON pp.profile_id = p.id
  WHERE p.id = _target
    AND (viewer = p.id OR pp.networking_enabled = true);
END; $function$;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_admin(uuid);
DROP FUNCTION IF EXISTS public.is_staff(uuid);
DROP FUNCTION IF EXISTS public.are_connected(uuid, uuid);