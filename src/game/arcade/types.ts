/** Types communs au lobby, aux rooms et aux mini-jeux de l'arcade. */

export type JeuId = "arene" | "course" | "combat";
/** 1v1 : chacun pour soi à deux. Équipes : 2 contre 2. */
export type ModeArcade = "1v1" | "equipes";
export type Equipe = 0 | 1;

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
};

/** Boutons de la manette, regroupés dans un nombre (léger à envoyer sur le réseau). */
export const BTN = { haut: 1, bas: 2, gauche: 4, droite: 8, a: 16, b: 32, c: 64 } as const;
export type Entree = number;
export const presse = (e: Entree, bouton: number) => (e & bouton) !== 0;

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
  dessiner(ctx: CanvasRenderingContext2D, s: EtatBase, moi: string): void;
}

export const JEUX_IDS: JeuId[] = ["arene", "course", "combat"];
export const capaciteMode = (m: ModeArcade) => (m === "1v1" ? 2 : 4);
