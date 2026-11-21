import {
  capaciteMode,
  COULEURS_JOUEUR,
  type Equipe,
  type JeuId,
  type JoueurPartie,
  type ModeArcade,
} from "./types";

/** Ce que chaque joueur publie dans la présence de la room (voir reseau.ts). */
export type Membre = {
  id: string;
  pseudo: string;
  niveau: number;
  /** Heure d'arrivée (ms) : sert à choisir un nouveau propriétaire si le créateur part. */
  depuis: number;
  /** Réglages de la room : seul le propriétaire les publie. */
  jeu?: JeuId;
  mode?: ModeArcade;
  phase?: "salle" | "jeu";
  /** Numéro de la partie en cours (change à chaque lancement). */
  manche?: number;
  graine?: number;
};

export type RoomVue = {
  /** Identifiant de la room = identifiant de son créateur. */
  id: string;
  proprietaire: Membre;
  joueurs: Membre[];
  jeu: JeuId;
  mode: ModeArcade;
  phase: "salle" | "jeu";
  manche: number;
  graine: number;
  max: number;
};

/** Résumé d'une room, affiché dans la liste. */
export type RoomInfo = {
  id: string;
  createur: string;
  nb: number;
  max: number;
  jeu: JeuId;
  mode: ModeArcade;
  phase: "salle" | "jeu";
};

export const JEU_DEFAUT: JeuId = "arene";
export const MODE_DEFAUT: ModeArcade = "1v1";

const parArrivee = (a: Membre, b: Membre) =>
  a.depuis - b.depuis || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Joueurs dans l'ordre : le créateur d'abord (s'il est là), puis par heure d'arrivée. */
export function ordonner(membres: readonly Membre[], createurId: string): Membre[] {
  const vus = new Map<string, Membre>();
  for (const m of membres) if (!vus.has(m.id)) vus.set(m.id, m);
  return [...vus.values()].sort((a, b) => {
    if (a.id === createurId) return -1;
    if (b.id === createurId) return 1;
    return parArrivee(a, b);
  });
}

/** Construit la vue d'une room à partir de la présence. Null si plus personne n'est dedans. */
export function construireRoom(roomId: string, membres: readonly Membre[]): RoomVue | null {
  const joueurs = ordonner(membres, roomId);
  const proprietaire = joueurs[0];
  if (!proprietaire) return null;
  const mode = proprietaire.mode ?? MODE_DEFAUT;
  return {
    id: roomId,
    proprietaire,
    joueurs,
    jeu: proprietaire.jeu ?? JEU_DEFAUT,
    mode,
    phase: proprietaire.phase ?? "salle",
    manche: proprietaire.manche ?? 0,
    graine: proprietaire.graine ?? 0,
    max: capaciteMode(mode),
  };
}

/** Équipe d'un joueur : on alterne bleu / rouge dans l'ordre d'arrivée. */
export const equipeDe = (room: RoomVue, id: string): Equipe =>
  (Math.max(
    0,
    room.joueurs.findIndex((j) => j.id === id),
  ) % 2) as Equipe;

export const estProprietaire = (room: RoomVue | null, id: string) =>
  !!room && room.proprietaire.id === id;

/** Le joueur dépasse-t-il la capacité de la room (arrivé trop tard) ? */
export function sansPlace(room: RoomVue, id: string): boolean {
  const i = room.joueurs.findIndex((j) => j.id === id);
  return i >= room.max;
}

export function pleine(info: Pick<RoomInfo, "nb" | "max">): boolean {
  return info.nb >= info.max;
}

/** Peut-on passer dans ce mode avec les joueurs actuels ? */
export function peutChangerMode(room: RoomVue, mode: ModeArcade): boolean {
  return room.joueurs.length <= capaciteMode(mode);
}

/** Raison pour laquelle la partie ne peut pas être lancée, ou null si tout est prêt. */
export function raisonBlocage(room: RoomVue): string | null {
  const n = room.joueurs.length;
  if (room.phase !== "salle") return "Une partie est déjà en cours.";
  if (room.mode === "1v1")
    return n === 2
      ? null
      : n < 2
        ? "Il faut un adversaire (2 joueurs)."
        : "1v1 : 2 joueurs maximum.";
  if (n === 2 || n === 4) return null;
  return n < 2
    ? "Il faut au moins 2 joueurs."
    : "Équipes : il faut 2 ou 4 joueurs (équipes égales).";
}

/** Les joueurs de la partie, avec leur équipe et leur couleur. */
export function joueursDePartie(room: RoomVue): JoueurPartie[] {
  const compte: Record<Equipe, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  return room.joueurs.slice(0, room.max).map((m, i) => {
    const equipe = (i % 2) as Equipe;
    const teintes = COULEURS_JOUEUR[equipe];
    const couleur = compte[equipe]++ % 2 === 0 ? teintes[0] : teintes[1];
    return { id: m.id, pseudo: m.pseudo, equipe, couleur };
  });
}

export function resumeRoom(room: RoomVue): RoomInfo {
  return {
    id: room.id,
    createur: room.proprietaire.pseudo,
    nb: room.joueurs.length,
    max: room.max,
    jeu: room.jeu,
    mode: room.mode,
    phase: room.phase,
  };
}

/** Lit la présence du salon pour en tirer la liste des rooms ouvertes. */
export function sallesDepuisPresence(etat: Record<string, unknown[]>): RoomInfo[] {
  const r: RoomInfo[] = [];
  for (const metas of Object.values(etat))
    for (const m of metas) {
      const info = (m as { salle?: RoomInfo }).salle;
      if (info && typeof info.id === "string") r.push(info);
    }
  return r.sort((x, y) => x.createur.localeCompare(y.createur));
}
