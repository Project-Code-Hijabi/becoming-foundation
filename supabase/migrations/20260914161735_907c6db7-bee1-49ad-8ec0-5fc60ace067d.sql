
CREATE TYPE public.registration_status AS ENUM ('pending','paid','cancelled','refunded');
CREATE TYPE public.payment_status AS ENUM ('pending','successful','failed','cancelled','refunded');
CREATE TYPE public.badge_status AS ENUM ('active','revoked');
CREATE TYPE public.connection_status AS ENUM ('pending','accepted','declined','blocked');

-- ticket types
CREATE TABLE public.ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_kobo INTEGER NOT NULL CHECK (price_kobo >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  sales_start TIMESTAMPTZ,
  sales_end TIMESTAMPTZ,
  quantity_cap INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ticket_types TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ticket_types TO authenticated;
GRANT ALL ON public.ticket_types TO service_role;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ticket_types_updated BEFORE UPDATE ON public.ticket_types
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "active tickets public" ON public.ticket_types FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage tickets" ON public.ticket_types FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- registrations
CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id) ON DELETE RESTRICT,
  attendee_code TEXT NOT NULL UNIQUE,
  status public.registration_status NOT NULL DEFAULT 'pending',
  amount_kobo INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_reference TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  dietary_notes TEXT,
  accessibility_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_registrations_one_paid_per_user
  ON public.registrations(user_id) WHERE status = 'paid';
CREATE INDEX idx_registrations_user ON public.registrations(user_id);
CREATE INDEX idx_registrations_ticket_type ON public.registrations(ticket_type_id);
CREATE INDEX idx_registrations_status ON public.registrations(status);
GRANT SELECT, INSERT, UPDATE ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_registrations_updated BEFORE UPDATE ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "own registration read" ON public.registrations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "own registration create" ON public.registrations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "admins update registrations" ON public.registrations FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- payments (backend only)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'flutterwave',
  tx_ref TEXT NOT NULL UNIQUE,
  provider_transaction_id TEXT UNIQUE,
  amount_kobo INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status public.payment_status NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  provider_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_registration ON public.payments(registration_id);
CREATE INDEX idx_payments_user ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "admins read payments" ON public.payments FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- badges
CREATE TABLE public.attendee_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL UNIQUE REFERENCES public.registrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qr_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  status public.badge_status NOT NULL DEFAULT 'active',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_badges_user ON public.attendee_badges(user_id);
GRANT SELECT ON public.attendee_badges TO authenticated;
GRANT INSERT, UPDATE ON public.attendee_badges TO authenticated;
GRANT ALL ON public.attendee_badges TO service_role;
ALTER TABLE public.attendee_badges ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_badges_updated BEFORE UPDATE ON public.attendee_badges
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "own or staff badge read" ON public.attendee_badges FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "admins manage badges" ON public.attendee_badges FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- check-ins
CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id UUID NOT NULL REFERENCES public.attendee_badges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  programme_item_id UUID,
  checked_in_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_override BOOLEAN NOT NULL DEFAULT false,
  notes TEXT
);
CREATE UNIQUE INDEX idx_checkin_unique_main
  ON public.check_ins(badge_id) WHERE programme_item_id IS NULL AND is_override = false;
CREATE UNIQUE INDEX idx_checkin_unique_session
  ON public.check_ins(badge_id, programme_item_id) WHERE programme_item_id IS NOT NULL AND is_override = false;
CREATE INDEX idx_checkin_user ON public.check_ins(user_id);
GRANT SELECT, INSERT ON public.check_ins TO authenticated;
GRANT UPDATE, DELETE ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkin read" ON public.check_ins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "staff record checkin" ON public.check_ins FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND checked_in_by = auth.uid()
    AND (is_override = false OR public.is_admin(auth.uid())));
CREATE POLICY "admins amend checkin" ON public.check_ins FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- networking scans
CREATE TABLE public.badge_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (scanner_user_id <> scanned_user_id)
);
CREATE INDEX idx_scans_scanner ON public.badge_scans(scanner_user_id);
CREATE INDEX idx_scans_scanned ON public.badge_scans(scanned_user_id);
GRANT SELECT, INSERT ON public.badge_scans TO authenticated;
GRANT ALL ON public.badge_scans TO service_role;
ALTER TABLE public.badge_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scans read own" ON public.badge_scans FOR SELECT TO authenticated
  USING (scanner_user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "scans create own" ON public.badge_scans FOR INSERT TO authenticated
  WITH CHECK (scanner_user_id = auth.uid());

-- connection requests
CREATE TABLE public.connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.connection_status NOT NULL DEFAULT 'pending',
  message TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requester_id <> recipient_id),
  UNIQUE (requester_id, recipient_id)
);
CREATE INDEX idx_requests_recipient ON public.connection_requests(recipient_id, status);
GRANT SELECT, INSERT, UPDATE ON public.connection_requests TO authenticated;
GRANT ALL ON public.connection_requests TO service_role;
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON public.connection_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "requests read own" ON public.connection_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "requests create own" ON public.connection_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending');
CREATE POLICY "requests respond" ON public.connection_requests FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() OR requester_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid() OR requester_id = auth.uid());

-- connections (canonical pair)
CREATE TABLE public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.connection_requests(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
CREATE INDEX idx_connections_a ON public.connections(user_a);
CREATE INDEX idx_connections_b ON public.connections(user_b);
GRANT SELECT, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connections read own" ON public.connections FOR SELECT TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());
CREATE POLICY "connections remove own" ON public.connections FOR DELETE TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());

-- create the connection automatically when a request is accepted
CREATE OR REPLACE FUNCTION public.handle_request_accepted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    INSERT INTO public.connections (user_a, user_b, request_id)
    VALUES (LEAST(NEW.requester_id, NEW.recipient_id),
            GREATEST(NEW.requester_id, NEW.recipient_id), NEW.id)
    ON CONFLICT (user_a, user_b) DO NOTHING;
    NEW.responded_at = now();
  ELSIF NEW.status <> OLD.status THEN
    NEW.responded_at = now();
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_request_accepted() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_request_accepted BEFORE UPDATE ON public.connection_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_request_accepted();

-- are two people connected?
CREATE OR REPLACE FUNCTION public.are_connected(_a UUID, _b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.connections
    WHERE user_a = LEAST(_a,_b) AND user_b = GREATEST(_a,_b));
$$;
REVOKE ALL ON FUNCTION public.are_connected(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.are_connected(UUID, UUID) TO authenticated;
