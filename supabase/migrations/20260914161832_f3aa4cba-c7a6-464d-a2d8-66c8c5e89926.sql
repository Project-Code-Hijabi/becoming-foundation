
CREATE TYPE public.person_type AS ENUM ('speaker','panelist','fireside_guest','special_guest','grand_honoree','host','sponsor');
CREATE TYPE public.session_type AS ENUM ('keynote','panel','fireside','hackathon','award','networking','break','opening','closing','other');
CREATE TYPE public.becoming_entry_type AS ENUM ('reflection','memory','note','media','other');

-- people
CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  title TEXT,
  organisation TEXT,
  bio TEXT,
  photo_path TEXT,
  instagram TEXT,
  linkedin TEXT,
  website TEXT,
  person_type public.person_type NOT NULL DEFAULT 'speaker',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_people_type ON public.people(person_type, display_order);
GRANT SELECT ON public.people TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_people_updated BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "published people readable" ON public.people FOR SELECT TO anon, authenticated
  USING (is_published = true OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage people" ON public.people FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- programme
CREATE TABLE public.programme_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  session_type public.session_type NOT NULL DEFAULT 'other',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  location TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_programme_order ON public.programme_items(display_order, starts_at);
GRANT SELECT ON public.programme_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.programme_items TO authenticated;
GRANT ALL ON public.programme_items TO service_role;
ALTER TABLE public.programme_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_programme_updated BEFORE UPDATE ON public.programme_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "published programme readable" ON public.programme_items FOR SELECT TO anon, authenticated
  USING (is_published = true OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage programme" ON public.programme_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.check_ins
  ADD CONSTRAINT check_ins_programme_item_fkey
  FOREIGN KEY (programme_item_id) REFERENCES public.programme_items(id) ON DELETE SET NULL;

CREATE TABLE public.session_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_item_id UUID NOT NULL REFERENCES public.programme_items(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  speaking_role TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (programme_item_id, person_id)
);
CREATE INDEX idx_session_speakers_person ON public.session_speakers(person_id);
GRANT SELECT ON public.session_speakers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.session_speakers TO authenticated;
GRANT ALL ON public.session_speakers TO service_role;
ALTER TABLE public.session_speakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session speakers readable" ON public.session_speakers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage session speakers" ON public.session_speakers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- hackathon
CREATE TABLE public.hackathon_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  pitch_summary TEXT,
  pitch_url TEXT,
  logo_path TEXT,
  is_finalist BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hackathon_teams TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hackathon_teams TO authenticated;
GRANT ALL ON public.hackathon_teams TO service_role;
ALTER TABLE public.hackathon_teams ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.hackathon_teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "published teams readable" ON public.hackathon_teams FOR SELECT TO anon, authenticated
  USING (is_published = true OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage teams" ON public.hackathon_teams FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.hackathon_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.hackathon_teams(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  photo_path TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_team_members_team ON public.hackathon_team_members(team_id);
GRANT SELECT ON public.hackathon_team_members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hackathon_team_members TO authenticated;
GRANT ALL ON public.hackathon_team_members TO service_role;
ALTER TABLE public.hackathon_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members readable" ON public.hackathon_team_members FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.hackathon_teams t WHERE t.id = team_id AND t.is_published) OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage team members" ON public.hackathon_team_members FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- awards
CREATE TABLE public.award_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  year INTEGER NOT NULL DEFAULT 2026,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, year)
);
GRANT SELECT ON public.award_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.award_categories TO authenticated;
GRANT ALL ON public.award_categories TO service_role;
ALTER TABLE public.award_categories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_awards_updated BEFORE UPDATE ON public.award_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "published awards readable" ON public.award_categories FOR SELECT TO anon, authenticated
  USING (is_published = true OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage awards" ON public.award_categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.award_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.award_categories(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.hackathon_teams(id) ON DELETE SET NULL,
  recipient_name TEXT,
  recognition_note TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_award_recipients_category ON public.award_recipients(category_id);
GRANT SELECT ON public.award_recipients TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.award_recipients TO authenticated;
GRANT ALL ON public.award_recipients TO service_role;
ALTER TABLE public.award_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published recipients readable" ON public.award_recipients FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.award_categories c WHERE c.id = category_id AND c.is_published) OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage recipients" ON public.award_recipients FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- announcements
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  publish_at TIMESTAMPTZ,
  audience TEXT NOT NULL DEFAULT 'public',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_announcements_publish ON public.announcements(is_published, publish_at DESC);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_announcements_updated BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "public announcements readable" ON public.announcements FOR SELECT TO anon
  USING (is_published = true AND audience = 'public' AND (publish_at IS NULL OR publish_at <= now()));
CREATE POLICY "announcements readable signed in" ON public.announcements FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid())
    OR (is_published = true AND (publish_at IS NULL OR publish_at <= now())
        AND (audience = 'public' OR audience = 'attendees')));
CREATE POLICY "admins manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- becoming experiences
CREATE TABLE public.dear_future_me (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  deliver_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dfm_user ON public.dear_future_me(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dear_future_me TO authenticated;
GRANT ALL ON public.dear_future_me TO service_role;
ALTER TABLE public.dear_future_me ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_dfm_updated BEFORE UPDATE ON public.dear_future_me FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "own letters only" ON public.dear_future_me FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.becoming_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type public.becoming_entry_type NOT NULL DEFAULT 'reflection',
  title TEXT,
  body TEXT,
  media_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_becoming_user ON public.becoming_entries(user_id, entry_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.becoming_entries TO authenticated;
GRANT ALL ON public.becoming_entries TO service_role;
ALTER TABLE public.becoming_entries ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_becoming_updated BEFORE UPDATE ON public.becoming_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "own entries" ON public.becoming_entries FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "shared entries readable" ON public.becoming_entries FOR SELECT TO authenticated
  USING (is_public = true);
