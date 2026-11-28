import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normaliser, type Apparence } from "./apparence";
import { isicoinsPourXp } from "./boutique";

export type Profil = {
  id: string; pseudo: string; bio: string; titre: string; xp: number; niveau: number;
  apparence: Apparence; personnage_cree: boolean;
};

export async function chargerMonProfil(): Promise<Profil | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase.from("profiles")
    .select("id,pseudo,bio,titre,xp,niveau,apparence,personnage_cree").eq("id", u.user.id).maybeSingle();
  if (error) throw error;
  return data ? { ...data, apparence: normaliser(data.apparence) } : null;
}

export function useMonProfil() {
  return useQuery({ queryKey: ["mon-profil"], queryFn: chargerMonProfil });
}

export function useRafraichirProfil() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["mon-profil"] });
}

export async function majProfil(id: string, champs: Partial<Pick<Profil, "pseudo" | "bio" | "apparence" | "personnage_cree">>) {
  const { error } = await supabase.from("profiles")
    .update({ ...champs, updated_at: new Date().toISOString() } as never).eq("id", id);
  if (error) throw error;
}

export type ProfilPublic = Pick<Profil, "id" | "pseudo" | "bio" | "titre" | "xp" | "niveau" | "apparence">;

export function useProfil(id: string) {
  return useQuery({
    queryKey: ["profil", id],
    queryFn: async (): Promise<ProfilPublic | null> => {
      const { data, error } = await supabase.from("profiles").select("id,pseudo,bio,titre,xp,niveau,apparence").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? { ...data, apparence: normaliser(data.apparence) } : null;
    },
  });
}

export function useHeros() {
  return useQuery({
    queryKey: ["heros"],
    queryFn: async (): Promise<ProfilPublic[]> => {
      const { data, error } = await supabase.from("profiles").select("id,pseudo,bio,titre,xp,niveau,apparence")
        .eq("personnage_cree", true).order("xp", { ascending: false }).limit(50);
      if (error) throw error;
      return data.map((d) => ({ ...d, apparence: normaliser(d.apparence) }));
    },
  });
}

export type ResultatRecompense = { xp: number; niveau: number; niveauAvant: number; isicoins: number };

/**
 * Gain d'un exploit : XP et ISICoins sont ajoutés au même compte, en solo comme en multijoueur.
 * Le serveur plafonne chaque gain à 50 et calcule le niveau ; le client compare avant/après pour annoncer la montée de niveau.
 */
export async function ajouterXp(montant: number): Promise<ResultatRecompense> {
  const { data, error } = await supabase.rpc("attribuer_recompense", {
    montant,
    monnaie: isicoinsPourXp(montant),
  });
  if (error) throw error;
  const ligne = data?.[0];
  if (!ligne) throw new Error("Réponse inattendue du serveur.");
  return { xp: ligne.xp, niveau: ligne.niveau, niveauAvant: ligne.niveau_avant, isicoins: ligne.isicoins };
}
