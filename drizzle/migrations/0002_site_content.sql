CREATE TABLE public.site_content (
  key text PRIMARY KEY,
  content jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads page content" ON public.site_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins write page content" ON public.site_content FOR ALL TO authenticated USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
CREATE TRIGGER trg_site_content_updated BEFORE UPDATE ON public.site_content FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE public.registrations ADD COLUMN confirmation_email_sent_at timestamptz;