/** Types communs au lobby, aux rooms et aux mini-jeux de l'arcade. */

export type JeuId = "arene" | "course" | "combat";
/** 1v1 : chacun pour soi à deux. Équipes : 2 contre 2. */
export type ModeArcade = "1v1" | "equipes";
import type { Apparence } from "../apparence";
import type { Effets } from "./fx";

/** Jusqu'à 4 équipes : 2 (1v1, 2v2) ou 4 (1v1v1v1, chacun pour soi). */
export type Equipe = 0 | 1 | 2 | 3;
export const COULEUR_EQUIPE: Record<Equipe, string> = {
  0: "#4da3ff",
  1: "#ff6b6b",
  2: "#6ee7a0",
  3: "#ffd166",
};
/** Deux teintes par équipe, pour distinguer deux coéquipiers. */
export const COULEURS_JOUEUR: Record<Equipe, [string, string]> = {
  0: ["#4da3ff", "#8fe0ff"],
  1: ["#ff6b6b", "#ffb36b"],
  2: ["#6ee7a0", "#b8f5cf"],
  3: ["#ffd166", "#ffe9a8"],
};
const NOM_COULEUR: Record<Equipe, string> = { 0: "bleue", 1: "rouge", 2: "verte", 3: "jaune" };

/** Durée d'une partie, identique pour les trois mini-jeux. */
export const DUREE_PARTIE = 120;
export const DUREE_COMPTE = 3;

/** Un joueur engagé dans une partie. */
export type JoueurPartie = {
  id: string;
  pseudo: string;
  equipe: Equipe;
  couleur: string;
  /** Vrai si le joueur a quitté la partie en cours. */
  absent?: boolean;
  /** Vrai pour un joueur piloté par l'ordinateur (mode solo). */
  ia?: boolean;
  /** Apparence du personnage d'ISITECH WORLD (sinon une apparence dérivée de l'identifiant). */
  apparence?: Apparence;
};

/**
 * Événement de jeu (impact, explosion, KO…) émis par la simulation pour déclencher des effets visuels.
 * Chaque événement a un numéro croissant : l'affichage ne traite que ceux qu'il n'a pas encore vus,
 * ce qui marche aussi pour les joueurs qui reçoivent l'état par le réseau.
 */
export type EvenementFx = {
  n: number;
  k:
    | "tir"
    | "impact"
    | "parade"
    | "explosion"
    | "ko"
    | "kill"
    | "respawn"
    | "choc"
    | "boost"
    | "huile"
    | "tour"
    | "spawn";
  x: number;
  y: number;
  /** Intensité (dégâts, force du choc…). */
  v?: number;
  /** Couleur utile (équipe, arme). */
  c?: string;
  /** Joueur concerné. */
  qui?: string;
};

/** « Léo » si l'équipe n'a qu'un joueur, sinon « l'équipe bleue ». */
export function nomEquipe(joueurs: readonly JoueurPartie[], e: Equipe): string {
  const m = joueurs.filter((j) => j.equipe === e);
  return m.length === 1 ? m[0]!.pseudo : `l'équipe ${NOM_COULEUR[e]}`;
}
/** Les équipes présentes dans une partie, dans l'ordre. */
export const equipesDe = (joueurs: readonly JoueurPartie[]): Equipe[] =>
  ([...new Set(joueurs.map((j) => j.equipe))] as Equipe[]).sort((a, b) => a - b);

/** Boutons de la manette, regroupés dans un nombre (léger à envoyer sur le réseau). */
export const BTN = {
  haut: 1,
  bas: 2,
  gauche: 4,
  droite: 8,
  a: 16,
  b: 32,
  c: 64,
  visee: 128,
} as const;
export type Entree = number;
export const presse = (e: Entree, bouton: number) => (e & bouton) !== 0;

/**
 * Visée précise réservée aux ordinateurs : le bouton « visée » + un angle sur 8 bits.
 * Les joueurs humains n'envoient jamais ce bouton (ils visent dans la direction où ils marchent).
 */
export const viser = (angle: number): Entree =>
  BTN.visee |
  ((Math.round(((((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI)) * 256) &
    255) <<
    8);
export const angleVise = (e: Entree): number => (((e >> 8) & 255) / 256) * 2 * Math.PI;

export type PhasePartie = "compte" | "jeu" | "fini";

export type LigneClassement = {
  id: string;
  pseudo: string;
  equipe: Equipe;
  rang: number;
  /** Texte affiché dans le classement (kills, temps, PV…). */
  texte: string;
};

export type Resultat = {
  /** Équipe gagnante, ou null en cas d'égalité. */
  vainqueur: Equipe | null;
  titre: string;
  lignes: LigneClassement[];
};

/** Champs que tout état de mini-jeu doit avoir. Le reste est propre au jeu. */
export type EtatBase = {
  phase: PhasePartie;
  /** Secondes restantes avant le départ (phase « compte »). */
  compte: number;
  /** Secondes écoulées depuis le départ. */
  t: number;
  duree: number;
  joueurs: JoueurPartie[];
  resultat: Resultat | null;
  /** Derniers événements (les plus anciens sont oubliés) et compteur. Servent aux effets visuels. */
  ev: EvenementFx[];
  evN: number;
};

export type BoutonsEcran = { a: string; b?: string; c?: string; haut?: string; bas?: string };

/** Ce que doit fournir un mini-jeu pour être ajouté à l'arcade. */
export interface Jeu {
  id: JeuId;
  nom: string;
  icone: string;
  description: string;
  /** Aide-mémoire des touches clavier. */
  aide: string[];
  /** Libellés des boutons à l'écran. */
  boutons: BoutonsEcran;
  /** Taille logique du canvas. */
  largeur: number;
  hauteur: number;
  creer(joueurs: JoueurPartie[], graine: number): EtatBase;
  /** Un pas de simulation (appelé seulement pendant la phase « jeu »). */
  pas(s: EtatBase, entrees: Readonly<Record<string, Entree>>, dt: number): void;
  /** Vrai si la partie peut s'arrêter avant la fin du chrono. */
  termine?(s: EtatBase): boolean;
  /** Calcule le classement final. */
  finir(s: EtatBase): Resultat;
  dessiner(ctx: CanvasRenderingContext2D, s: EtatBase, moi: string, fx: Effets): void;
}

export const JEUX_IDS: JeuId[] = ["arene", "course", "combat"];
export const capaciteMode = (m: ModeArcade) => (m === "1v1" ? 2 : 4);
