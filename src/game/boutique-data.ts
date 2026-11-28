import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Ce que possède et équipe un joueur. */
export type EtatBoutique = {
  solde: number;
  possedes: string[];
  /** Catégorie -> identifiant de l'article équipé. */
  equipes: Record<string, string>;
};

export async function lireEquipements(uid: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("boutique_equipements").select("categorie,article").eq("user_id", uid);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((e) => [e.categorie, e.article]));
}

export async function lireBoutique(uid: string): Promise<EtatBoutique> {
  const [profil, achats, equipes] = await Promise.all([
    supabase.from("profiles").select("isicoins").eq("id", uid).maybeSingle(),
    supabase.from("boutique_achats").select("article").eq("user_id", uid),
    lireEquipements(uid),
  ]);
  if (profil.error) throw profil.error;
  if (achats.error) throw achats.error;
  return {
    solde: profil.data?.isicoins ?? 0,
    possedes: (achats.data ?? []).map((a) => a.article),
    equipes,
  };
}

/** Achat d'un article. Le serveur vérifie solde et possession ; renvoie le nouveau solde. */
export async function acheterArticle(id: string): Promise<number> {
  const { data, error } = await supabase.rpc("acheter_article", { article_id: id });
  if (error) throw error;
  return data;
}

/** Équipe un article possédé, ou retire l'équipement de la catégorie si id est null. */
export async function equiperArticle(categorie: string, id: string | null): Promise<void> {
  const { error } = await supabase.rpc("equiper_article", { categorie_choisie: categorie, article_id: id });
  if (error) throw error;
}

export function useBoutique(uid: string) {
  return useQuery({ queryKey: ["boutique", uid], queryFn: () => lireBoutique(uid), enabled: uid !== "" });
}

export function useEquipements(uid: string) {
  return useQuery({ queryKey: ["equipements", uid], queryFn: () => lireEquipements(uid), enabled: uid !== "" });
}
