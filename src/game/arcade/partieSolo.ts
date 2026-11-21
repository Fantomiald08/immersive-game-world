import { creerCerveau, type Cerveau } from "./ia";
import { avancer } from "./moteur";
import { JEUX } from "./jeux";
import {
  COULEURS_JOUEUR,
  type EtatBase,
  type Equipe,
  type JeuId,
  type JoueurPartie,
} from "./types";

/**
 * Parties en SOLO : le joueur affronte des ordinateurs, tout se passe sur son appareil.
 * Ce module n'utilise ni Supabase ni aucun canal réseau.
 */
export type FormatSolo = "1v1" | "2v2" | "ffa";

export const FORMATS_SOLO: ReadonlyArray<{
  id: FormatSolo;
  nom: string;
  description: string;
  ia: number;
}> = [
  { id: "1v1", nom: "1v1", description: "Toi contre 1 IA.", ia: 1 },
  { id: "2v2", nom: "2v2", description: "Toi + 1 allié IA contre 2 IA.", ia: 3 },
  { id: "ffa", nom: "1v1v1v1", description: "Chacun pour soi contre 3 IA.", ia: 3 },
];

const NOMS_IA = ["IA Rex", "IA Nova", "IA Zed"] as const;

/** Les joueurs d'une partie solo : toi en premier, puis les IA (alliée d'abord en 2v2). */
export function joueursSolo(
  moi: { id: string; pseudo: string },
  format: FormatSolo,
): JoueurPartie[] {
  // Équipe de chaque joueur, dans l'ordre : toi, puis les IA.
  const equipes: Equipe[] =
    format === "1v1" ? [0, 1] : format === "2v2" ? [0, 0, 1, 1] : [0, 1, 2, 3];
  const compte: Record<Equipe, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  return equipes.map((equipe, i) => {
    const teintes = COULEURS_JOUEUR[equipe];
    const couleur = compte[equipe]++ % 2 === 0 ? teintes[0] : teintes[1];
    return i === 0
      ? { id: moi.id, pseudo: moi.pseudo, equipe, couleur }
      : { id: `ia-${i}`, pseudo: NOMS_IA[(i - 1) % NOMS_IA.length]!, equipe, couleur, ia: true };
  });
}

export type PartieSolo = {
  jeu: JeuId;
  etat: EtatBase;
  /** Un cerveau par joueur ordinateur, indexé par son identifiant. */
  cerveaux: Map<string, Cerveau>;
  /** Touches de tous les joueurs (rempli à chaque pas). */
  entrees: Record<string, number>;
  moiId: string;
};

export function creerPartieSolo(
  jeuId: JeuId,
  moi: { id: string; pseudo: string },
  format: FormatSolo,
  graine: number,
): PartieSolo {
  const joueurs = joueursSolo(moi, format);
  const etat = JEUX[jeuId].creer(joueurs, graine);
  const cerveaux = new Map<string, Cerveau>();
  joueurs.forEach((j, i) => {
    if (j.ia) cerveaux.set(j.id, creerCerveau(jeuId, j.id, graine + 101 * (i + 1)));
  });
  return { jeu: jeuId, etat, cerveaux, entrees: {}, moiId: moi.id };
}

/** Avance la partie d'un pas : les IA décident, le joueur donne ses touches, puis la simulation avance. */
export function avancerSolo(p: PartieSolo, touchesJoueur: number, dt: number): void {
  p.entrees[p.moiId] = touchesJoueur;
  if (p.etat.phase === "jeu")
    for (const [id, cerveau] of p.cerveaux) p.entrees[id] = cerveau(p.etat, dt);
  avancer(JEUX[p.jeu], p.etat, p.entrees, dt);
}
