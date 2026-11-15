CREATE OR REPLACE FUNCTION public.est_joueur(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND personnage_cree)
$$;
REVOKE EXECUTE ON FUNCTION public.est_joueur(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.est_joueur(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles readable" ON public.profiles;
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.est_joueur(auth.uid()));

DROP POLICY IF EXISTS "courses readable" ON public.courses;
CREATE POLICY "courses readable" ON public.courses FOR SELECT TO authenticated
  USING (auth.uid() = author_id OR public.est_joueur(auth.uid()));