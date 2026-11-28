-- =====================================================================
-- ISITECH WORLD — Migration 6 : monnaie unifiée (ISICoins) et boutique
-- =====================================================================
-- Une seule monnaie par compte, gagnée en solo comme en multijoueur.
-- Toutes les écritures passent par des fonctions SECURITY DEFINER :
-- aucun client ne peut modifier directement le solde, les achats ou les équipements.
-- Le catalogue ci-dessous est généré depuis src/game/boutique.ts (mêmes ids, mêmes prix).
-- =====================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS isicoins integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.boutique_catalogue (
  id text PRIMARY KEY,
  categorie text NOT NULL,
  prix integer NOT NULL CHECK (prix >= 0)
);

CREATE TABLE IF NOT EXISTS public.boutique_achats (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article text NOT NULL REFERENCES public.boutique_catalogue(id),
  acquis_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article)
);

CREATE TABLE IF NOT EXISTS public.boutique_equipements (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categorie text NOT NULL,
  article text NOT NULL REFERENCES public.boutique_catalogue(id),
  PRIMARY KEY (user_id, categorie)
);

ALTER TABLE public.boutique_catalogue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_achats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_equipements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalogue lecture" ON public.boutique_catalogue;
CREATE POLICY "catalogue lecture" ON public.boutique_catalogue FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "achats lecture propre" ON public.boutique_achats;
CREATE POLICY "achats lecture propre" ON public.boutique_achats FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Les équipements sont visibles par tous : ils s'affichent sur le personnage et la fiche des autres joueurs.
DROP POLICY IF EXISTS "equipements lecture" ON public.boutique_equipements;
CREATE POLICY "equipements lecture" ON public.boutique_equipements FOR SELECT TO authenticated USING (true);

INSERT INTO public.boutique_catalogue (id, categorie, prix) VALUES
  ('badge-cafe', 'badge', 40),
  ('badge-hacker', 'badge', 80),
  ('badge-quiz', 'badge', 120),
  ('titre-stagiaire', 'titre', 30),
  ('titre-noctambule', 'titre', 60),
  ('titre-admin', 'titre', 150),
  ('couleur-cyan', 'couleur', 50),
  ('couleur-or', 'couleur', 80),
  ('couleur-rose', 'couleur', 80),
  ('couleur-vert', 'couleur', 50),
  ('animal-chat', 'animal', 200),
  ('animal-robot', 'animal', 250),
  ('animal-hibou', 'animal', 180),
  ('tenue-veste-neon', 'tenue', 120),
  ('tenue-capuche', 'tenue', 90),
  ('tenue-sweat', 'tenue', 100)
ON CONFLICT (id) DO UPDATE SET categorie = EXCLUDED.categorie, prix = EXCLUDED.prix;

-- Gain d'XP et de monnaie, plafonnés à 50 par appel, avec le niveau avant et après.
CREATE OR REPLACE FUNCTION public.attribuer_recompense(montant integer, monnaie integer)
RETURNS TABLE(xp integer, niveau integer, niveau_avant integer, isicoins integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m integer := greatest(0, least(coalesce(montant, 0), 50));
  c integer := greatest(0, least(coalesce(monnaie, 0), 50));
  p public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'non connecté'; END IF;
  SELECT * INTO p FROM public.profiles pr WHERE pr.id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profil introuvable'; END IF;
  UPDATE public.profiles pr
    SET xp = p.xp + m, niveau = 1 + (p.xp + m) / 100, isicoins = p.isicoins + c, updated_at = now()
    WHERE pr.id = auth.uid();
  RETURN QUERY SELECT p.xp + m, 1 + (p.xp + m) / 100, p.niveau, p.isicoins + c;
END $$;

-- Achat : vérifie le solde et la possession, puis débite et enregistre dans une seule transaction.
CREATE OR REPLACE FUNCTION public.acheter_article(article_id text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prix_article integer;
  solde integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'non connecté'; END IF;
  SELECT cat.prix INTO prix_article FROM public.boutique_catalogue cat WHERE cat.id = article_id;
  IF prix_article IS NULL THEN RAISE EXCEPTION 'article inconnu'; END IF;
  SELECT pr.isicoins INTO solde FROM public.profiles pr WHERE pr.id = auth.uid() FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.boutique_achats a WHERE a.user_id = auth.uid() AND a.article = article_id) THEN
    RAISE EXCEPTION 'Tu possèdes déjà cet article.';
  END IF;
  IF solde < prix_article THEN
    RAISE EXCEPTION 'Solde insuffisant : il te manque % ISICoins.', prix_article - solde;
  END IF;
  INSERT INTO public.boutique_achats (user_id, article) VALUES (auth.uid(), article_id);
  UPDATE public.profiles pr SET isicoins = pr.isicoins - prix_article, updated_at = now() WHERE pr.id = auth.uid();
  RETURN solde - prix_article;
END $$;

-- Équipement : seul un article possédé et de la bonne catégorie peut être équipé. article_id NULL = retirer.
CREATE OR REPLACE FUNCTION public.equiper_article(categorie_choisie text, article_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'non connecté'; END IF;
  IF article_id IS NULL THEN
    DELETE FROM public.boutique_equipements e WHERE e.user_id = auth.uid() AND e.categorie = categorie_choisie;
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.boutique_achats a
    JOIN public.boutique_catalogue cat ON cat.id = a.article
    WHERE a.user_id = auth.uid() AND a.article = article_id AND cat.categorie = categorie_choisie
  ) THEN
    RAISE EXCEPTION 'Cet article n''est pas dans ta collection pour cette catégorie.';
  END IF;
  INSERT INTO public.boutique_equipements (user_id, categorie, article) VALUES (auth.uid(), categorie_choisie, article_id)
  ON CONFLICT (user_id, categorie) DO UPDATE SET article = EXCLUDED.article;
END $$;

REVOKE ALL ON FUNCTION public.attribuer_recompense(integer, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.acheter_article(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.equiper_article(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.attribuer_recompense(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acheter_article(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equiper_article(text, text) TO authenticated;
