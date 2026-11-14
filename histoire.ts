/**
 * MODE HISTOIRE — chapitres, missions et dialogues.
 * Tout est DONNÉES (CHAPITRES) : ajouter un chapitre ou un événement = ajouter un objet, pas de nouveau code.
 * Les missions avancent avec les actions du jeu (parler, visiter, combattre, lire le tableau, déposer un cours).
 * Logique pure et testée ; la sauvegarde se fait sur l'appareil, par joueur.
 */
import type { Difficulte } from "./combat";

export type Evenement =
  | { k: "parler"; pnj: string }
  | { k: "visite"; salle: string }
  | { k: "combat"; victoire: boolean; difficulte: Difficulte; bonnes: number }
  | { k: "tableau" }
  | { k: "depot" };

/** Condition d'une mission : seuls les champs indiqués sont vérifiés. */
export type Condition = Partial<{
  k: Evenement["k"];
  pnj: string;
  salle: string;
  victoire: boolean;
  difficulteMin: Difficulte;
  bonnesMin: number;
}>;

export type Mission = {
  id: string;
  objectif: string;
  dialogue: string;
  cond: Condition;
  xp: number;
};
export type Chapitre = {
  id: string;
  titre: string;
  intro: string;
  missions: Mission[];
  recompense: number;
  conclusion: string;
};

const ORDRE: Difficulte[] = ["facile", "normal", "difficile", "cauchemar"];

export const CHAPITRES: Chapitre[] = [
  {
    id: "c1",
    titre: "Chapitre 1 — Le signal étrange",
    intro:
      "Ce matin, les écrans de supervision affichent des alertes inconnues. Le réseau d'Isitech ressent une présence étrange. L'hôtesse de l'accueil te demande de mener l'enquête.",
    recompense: 40,
    conclusion:
      "Le premier virus est repoussé. Mais l'alerte a une source : elle vient du tableau d'affichage.",
    missions: [
      {
        id: "c1m1",
        objectif: "Parler à l'hôtesse de l'accueil",
        xp: 10,
        dialogue:
          "« Des alertes remontent du serveur. Commence par la salle Serveurs, et jette un œil au tableau d'affichage. »",
        cond: { k: "parler", pnj: "accueil-hotesse" },
      },
      {
        id: "c1m2",
        objectif: "Te rendre dans la salle Serveurs",
        xp: 10,
        dialogue:
          "Les baies clignotent d'une lumière rouge. Un virus s'est installé. Il faut le combattre sur un PC gaming.",
        cond: { k: "visite", salle: "serveurs" },
      },
      {
        id: "c1m3",
        objectif: "Gagner un combat sur un PC gaming",
        xp: 20,
        dialogue: "Le virus est tombé. Mais tu sens que d'autres attaques arrivent.",
        cond: { k: "combat", victoire: true },
      },
    ],
  },
  {
    id: "c2",
    titre: "Chapitre 2 — Le serveur infecté",
    intro:
      "Le virus était un leurre. Un malware plus sournois s'est glissé dans le réseau, et des élèves signalent des messages étranges sur le tableau d'affichage.",
    recompense: 60,
    conclusion: "Le malware est neutralisé. Une dernière trace mène à un message signé : « R. ».",
    missions: [
      {
        id: "c2m1",
        objectif: "Lire le tableau d'affichage de l'accueil",
        xp: 10,
        dialogue:
          "Une annonce suspecte est épinglée, rédigée comme si elle venait de la direction. Elle a été publiée depuis un compte inconnu.",
        cond: { k: "tableau" },
      },
      {
        id: "c2m2",
        objectif: "Gagner un combat avec au moins 4 bonnes réponses",
        xp: 25,
        dialogue:
          "Tes réponses sont précises. Le malware perd sa couverture : il frappait au hasard, pas toi.",
        cond: { k: "combat", victoire: true, bonnesMin: 4 },
      },
      {
        id: "c2m3",
        objectif: "Vaincre un malware en difficulté Difficile",
        xp: 35,
        dialogue:
          "Le malware se désintègre dans un flash. Son code contient une signature : « Ransomware ».",
        cond: { k: "combat", victoire: true, difficulteMin: "difficile" },
      },
    ],
  },
  {
    id: "c3",
    titre: "Chapitre 3 — Le Ransomware",
    intro:
      "Le message signé « R. » annonce une attaque finale. Le Ransomware veut chiffrer tous les cours de l'école. Il faut déposer les tiens pour préserver le savoir, puis affronter le boss.",
    recompense: 100,
    conclusion:
      "Le Ransomware est vaincu. Isitech est en sécurité, et tes cours sont sauvegardés. Félicitations, tu as terminé l'histoire !",
    missions: [
      {
        id: "c3m1",
        objectif: "Déposer un cours sur le réseau Isitech",
        xp: 20,
        dialogue:
          "Ton cours est sauvegardé sur le réseau. Le Ransomware ne pourra plus rien chiffrer d'essentiel.",
        cond: { k: "depot" },
      },
      {
        id: "c3m2",
        objectif: "Vaincre le Ransomware en difficulté Cauchemar",
        xp: 50,
        dialogue: "Dans un dernier cri, le Ransomware se tait. Ses fichiers sont libérés un à un.",
        cond: { k: "combat", victoire: true, difficulteMin: "cauchemar" },
      },
    ],
  },
];

export type EtatHistoire = { chapitre: number; faites: string[]; termine: boolean };
export const ETAT_INITIAL: EtatHistoire = { chapitre: 0, faites: [], termine: false };

/** Vrai si l'événement remplit la condition de la mission. */
export function correspond(c: Condition, ev: Evenement): boolean {
  if (c.k !== undefined && c.k !== ev.k) return false;
  if (ev.k === "parler" && c.pnj !== undefined) return c.pnj === ev.pnj;
  if (ev.k === "visite" && c.salle !== undefined) return c.salle === ev.salle;
  if (ev.k === "combat") {
    if (c.victoire !== undefined && c.victoire !== ev.victoire) return false;
    if (
      c.difficulteMin !== undefined &&
      ORDRE.indexOf(ev.difficulte) < ORDRE.indexOf(c.difficulteMin)
    )
      return false;
    if (c.bonnesMin !== undefined && ev.bonnes < c.bonnesMin) return false;
  }
  return true;
}

export type Gains = {
  xp: number;
  missions: Mission[];
  chapitreTermine: Chapitre | null;
  fini: boolean;
};

/** Fait avancer l'histoire avec un événement de jeu. Renvoie le nouvel état et ce qui a été gagné. */
export function progresser(e: EtatHistoire, ev: Evenement): { etat: EtatHistoire; gains: Gains } {
  const gains: Gains = { xp: 0, missions: [], chapitreTermine: null, fini: false };
  if (e.termine) return { etat: e, gains };
  const chap = CHAPITRES[e.chapitre];
  if (!chap) return { etat: { ...e, termine: true }, gains: { ...gains, fini: true } };

  const faites = [...e.faites];
  for (const m of chap.missions) {
    if (faites.includes(m.id)) continue;
    if (!correspond(m.cond, ev)) continue;
    faites.push(m.id);
    gains.xp += m.xp;
    gains.missions.push(m);
  }
  let next: EtatHistoire = { ...e, faites };
  if (chap.missions.every((m) => faites.includes(m.id))) {
    gains.xp += chap.recompense;
    gains.chapitreTermine = chap;
    const suivant = e.chapitre + 1;
    next =
      suivant < CHAPITRES.length
        ? { chapitre: suivant, faites: [], termine: false }
        : { chapitre: suivant, faites: [], termine: true };
    gains.fini = next.termine;
  }
  return { etat: next, gains };
}

/** Résumé pour l'affichage : chapitre courant, missions, avancement. */
export function resume(e: EtatHistoire) {
  const total = CHAPITRES.reduce((n, c) => n + c.missions.length, 0);
  const avant = CHAPITRES.slice(0, Math.min(e.chapitre, CHAPITRES.length)).reduce(
    (n, c) => n + c.missions.length,
    0,
  );
  const chap = e.termine ? null : (CHAPITRES[e.chapitre] ?? null);
  return {
    chapitre: chap,
    missions: chap
      ? chap.missions.map((m) => ({ mission: m, faite: e.faites.includes(m.id) }))
      : [],
    terminee: e.termine,
    pourcent: total === 0 ? 0 : Math.round(((avant + (chap ? e.faites.length : 0)) / total) * 100),
  };
}

/* ───────────── Sauvegarde sur l'appareil, par joueur ───────────── */
const cle = (uid: string) => `isitech.histoire.v1.${uid}`;
export function lireHistoire(uid: string): EtatHistoire {
  try {
    const b = typeof localStorage !== "undefined" ? localStorage.getItem(cle(uid)) : null;
    if (!b) return ETAT_INITIAL;
    const j = JSON.parse(b) as Partial<EtatHistoire>;
    return {
      chapitre: Number(j.chapitre) || 0,
      faites: Array.isArray(j.faites) ? j.faites.filter((x) => typeof x === "string") : [],
      termine: !!j.termine,
    };
  } catch {
    return ETAT_INITIAL;
  }
}
export function ecrireHistoire(uid: string, e: EtatHistoire): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(cle(uid), JSON.stringify(e));
  } catch {
    /* stockage indisponible */
  }
}
