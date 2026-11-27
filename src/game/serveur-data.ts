import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { modeProvisoire } from "./admins";
import { chargerReseau, type Reseau } from "./reseau";
import { lireEtatIA } from "./serveur-etat.functions";
import {
  evaluerRoles,
  evaluerServices,
  evenementsRecents,
  verifier,
  type EvenementServeur,
  type Mesures,
  type RoleServeur,
  type ServiceServeur,
  type Verification,
} from "./serveur";

/** Temps de réponse de la base et nombre de profils, mesurés par une vraie requête. */
export async function mesurerBase(): Promise<{ latenceMs: number | null; nbProfils: number }> {
  const debut = performance.now();
  const { count, error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
  const latenceMs = Math.round(performance.now() - debut);
  if (error) return { latenceMs: null, nbProfils: 0 };
  return { latenceMs, nbProfils: count ?? 0 };
}

/** Le canal temps réel est-il ouvert ? */
export function tempsReelOuvert(): boolean {
  const rt = (supabase as unknown as { realtime?: { isConnected?: () => boolean } }).realtime;
  return typeof rt?.isConnected === "function" ? rt.isConnected() : false;
}

export type DonneesServeur = {
  mesures: Mesures;
  services: ServiceServeur[];
  roles: RoleServeur[];
  verifications: Verification[];
  evenements: EvenementServeur[];
  reseau: Reseau;
};

/** Rassemble toutes les mesures réelles du jeu pour le gestionnaire de serveur. */
export function useDonneesServeur(actif: boolean) {
  const etatIA = useServerFn(lireEtatIA);
  return useQuery({
    queryKey: ["serveur-admin"],
    enabled: actif,
    refetchInterval: 15000,
    queryFn: async (): Promise<DonneesServeur> => {
      const [base, ia, reseau] = await Promise.all([mesurerBase(), etatIA({ data: {} }), chargerReseau()]);
      const mesures: Mesures = {
        latenceMs: base.latenceMs,
        nbProfils: base.nbProfils,
        tempsReelOk: tempsReelOuvert(),
        iaConfiguree: ia.iaConfiguree,
        provisoire: modeProvisoire(),
      };
      return {
        mesures,
        services: evaluerServices(mesures),
        roles: evaluerRoles(reseau),
        verifications: verifier(mesures, reseau),
        evenements: evenementsRecents(reseau),
        reseau,
      };
    },
  });
}
