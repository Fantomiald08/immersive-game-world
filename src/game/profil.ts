import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normaliser, type Apparence } from "./apparence";

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
