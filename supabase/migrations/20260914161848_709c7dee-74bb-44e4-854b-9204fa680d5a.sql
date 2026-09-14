
CREATE OR REPLACE FUNCTION public.get_shareable_profile(_target UUID)
RETURNS TABLE (
  id UUID, full_name TEXT, photo_path TEXT, profession TEXT, organisation TEXT,
  location TEXT, bio TEXT, interests TEXT[], skills TEXT[], networking_preferences TEXT,
  instagram TEXT, linkedin TEXT, whatsapp TEXT, phone TEXT, email TEXT, is_connected BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  viewer UUID := auth.uid();
  connected BOOLEAN;
BEGIN
  IF viewer IS NULL THEN RETURN; END IF;
  connected := public.are_connected(viewer, _target);

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
END; $$;

REVOKE ALL ON FUNCTION public.get_shareable_profile(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shareable_profile(UUID) TO authenticated;
