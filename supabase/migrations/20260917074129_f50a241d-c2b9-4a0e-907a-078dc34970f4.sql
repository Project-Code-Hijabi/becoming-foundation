-- 1. Check-in guard must be able to resolve the badge without granting staff SELECT on badges
CREATE OR REPLACE FUNCTION public.guard_check_in()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE b RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff(auth.uid()) THEN
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

-- 2. Role/connection helpers answer only about the caller when invoked directly
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
  END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'))
  END;
$function$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('staff','admin','super_admin'))
  END;
$function$;

CREATE OR REPLACE FUNCTION public.are_connected(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND auth.uid() NOT IN (_a, _b) THEN false
    ELSE EXISTS (SELECT 1 FROM public.connections
      WHERE user_a = LEAST(_a,_b) AND user_b = GREATEST(_a,_b))
  END;
$function$;

REVOKE EXECUTE ON FUNCTION public.generate_qr_token() FROM PUBLIC, anon;

-- 3. Curated public event assets served via short-lived signed URLs from a private bucket
CREATE TABLE IF NOT EXISTS public.event_asset_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_path text NOT NULL UNIQUE,
  title text,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_asset_publications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_asset_publications TO authenticated;
GRANT ALL ON public.event_asset_publications TO service_role;

ALTER TABLE public.event_asset_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "published assets readable" ON public.event_asset_publications;
CREATE POLICY "published assets readable" ON public.event_asset_publications
  FOR SELECT TO anon, authenticated USING (is_published = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins manage asset publications" ON public.event_asset_publications;
CREATE POLICY "admins manage asset publications" ON public.event_asset_publications
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_event_asset_pub_published
  ON public.event_asset_publications (is_published, display_order);

DROP TRIGGER IF EXISTS trg_event_asset_pub_updated ON public.event_asset_publications;
CREATE TRIGGER trg_event_asset_pub_updated BEFORE UPDATE ON public.event_asset_publications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "event assets published read" ON storage.objects;
CREATE POLICY "event assets published read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'event-assets'
    AND EXISTS (
      SELECT 1 FROM public.event_asset_publications p
      WHERE p.object_path = storage.objects.name AND p.is_published = true
    )
  );