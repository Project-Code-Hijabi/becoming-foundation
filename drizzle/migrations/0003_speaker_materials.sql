CREATE OR REPLACE FUNCTION app_private.is_confirmed(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.registrations WHERE user_id = _user_id AND status = 'paid')
$$;
REVOKE ALL ON FUNCTION app_private.is_confirmed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_confirmed(uuid) TO authenticated, service_role;

CREATE TABLE public.speaker_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  note text CHECK (char_length(note) <= 2000),
  url text CHECK (url IS NULL OR url ~ '^https://'),
  file_path text,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (url IS NOT NULL OR file_path IS NOT NULL)
);
CREATE INDEX ON public.speaker_materials (speaker_id);
GRANT SELECT, INSERT, DELETE ON public.speaker_materials TO authenticated;
GRANT ALL ON public.speaker_materials TO service_role;
ALTER TABLE public.speaker_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "speaker manages own materials" ON public.speaker_materials FOR ALL TO authenticated
  USING (speaker_id = auth.uid() AND app_private.has_role(auth.uid(), 'speaker'))
  WITH CHECK (speaker_id = auth.uid() AND app_private.has_role(auth.uid(), 'speaker')
    AND (file_path IS NULL OR file_path LIKE auth.uid()::text || '/%'));
CREATE POLICY "confirmed guests read materials" ON public.speaker_materials FOR SELECT TO authenticated
  USING (app_private.is_confirmed(auth.uid()) OR app_private.is_staff(auth.uid()));

CREATE TABLE public.speaker_sharing (
  speaker_id uuid PRIMARY KEY,
  show_instagram boolean NOT NULL DEFAULT false,
  show_linkedin boolean NOT NULL DEFAULT false,
  show_website boolean NOT NULL DEFAULT false,
  show_email boolean NOT NULL DEFAULT false,
  show_whatsapp boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.speaker_sharing TO authenticated;
GRANT ALL ON public.speaker_sharing TO service_role;
ALTER TABLE public.speaker_sharing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "speaker manages own sharing" ON public.speaker_sharing FOR ALL TO authenticated
  USING (speaker_id = auth.uid()) WITH CHECK (speaker_id = auth.uid() AND app_private.has_role(auth.uid(), 'speaker'));

-- Confirmed guests see each speaker's name/work plus only the contacts she chose to share.
CREATE OR REPLACE FUNCTION public.speaker_directory()
RETURNS TABLE(id uuid, full_name text, profession text, organisation text, bio text, instagram text, linkedin text, website text, email text, whatsapp text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.profession, p.organisation, p.bio,
    CASE WHEN s.show_instagram THEN p.instagram END,
    CASE WHEN s.show_linkedin THEN p.linkedin END,
    CASE WHEN s.show_website THEN p.website END,
    CASE WHEN s.show_email THEN p.email END,
    CASE WHEN s.show_whatsapp THEN p.whatsapp END
  FROM public.user_roles r JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN public.speaker_sharing s ON s.speaker_id = p.id
  WHERE r.role = 'speaker'
    AND (app_private.is_confirmed(auth.uid()) OR app_private.is_staff(auth.uid()))
  ORDER BY p.full_name
$$;
REVOKE ALL ON FUNCTION public.speaker_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.speaker_directory() TO authenticated;

CREATE POLICY "speaker uploads own materials" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'speaker-materials' AND (storage.foldername(name))[1] = auth.uid()::text AND app_private.has_role(auth.uid(), 'speaker'));
CREATE POLICY "speaker deletes own materials" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'speaker-materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "confirmed guests read speaker materials" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'speaker-materials' AND (app_private.is_confirmed(auth.uid()) OR app_private.is_staff(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text));

ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;