/**
 * IA adaptative des combats.
 *  - Le jeu mesure ta précision réelle (sauvegardée sur ton appareil, par joueur).
 *  - Plus tu réussis, plus le monstre est résistant, rapide à frapper, et plus le chrono est court.
 *  - Le monstre « apprend » tes habitudes : le Ransomware bloque plus souvent les réponses que tu choisis le plus.
 *  - Les questions suivent ton niveau réel.
 * Logique pure (testée) + petites fonctions de stockage.
 */
import { choisirQuestions, type Difficulte, type Question } from "./combat";

export type Perf = {
  tentatives: number;
  reussites: number;
  combats: number;
  victoires: number;
  positions: number[];
};
export const PERF_VIDE: Perf = {
  tentatives: 0,
  reussites: 0,
  combats: 0,
  victoires: 0,
  positions: [],
};
const MIN_REPONSES = 8; // avant ce nombre de réponses, on considère le joueur « moyen »
const MAX_POSITIONS = 40;

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const arrondi2 = (x: number) => Math.round(x * 100) / 100;

/** Niveau estimé du joueur, de 0 (débutant) à 1 (expert). */
export function niveauJoueur(p: Perf): number {
  if (p.tentatives < MIN_REPONSES) return 0.5;
  const precision = (p.reussites + 1) / (p.tentatives + 2);
  const victoires = p.combats >= 2 ? (p.victoires + 1) / (p.combats + 2) : precision;
  return clamp(0.7 * precision + 0.3 * victoires);
}

export type Modificateurs = { pv: number; temps: number; degats: number };
/** Le monstre s'adapte : un expert affronte un monstre plus solide, plus rapide, plus dangereux. */
export function modificateurs(niveau: number): Modificateurs {
  const n = clamp(niveau);
  return {
    pv: arrondi2(0.85 + 0.4 * n),
    temps: arrondi2(1.1 - 0.3 * n),
    degats: arrondi2(0.9 + 0.3 * n),
  };
}

const ORDRE: Difficulte[] = ["facile", "normal", "difficile", "cauchemar"];
/** Niveau des questions : décalé d'un cran vers le haut pour les experts, vers le bas pour les débutants. */
export function difficulteCible(d: Difficulte, niveau: number): Difficulte {
  const i = ORDRE.indexOf(d);
  if (niveau >= 0.8 && i < ORDRE.length - 1) return ORDRE[i + 1]!;
  if (niveau <= 0.25 && i > 0) return ORDRE[i - 1]!;
  return d;
}

export function questionsAdaptees(
  pool: readonly Question[],
  n: number,
  d: Difficulte,
  niveau: number,
  rnd: () => number = Math.random,
): Question[] {
  return choisirQuestions(pool, n, difficulteCible(d, niveau), rnd);
}

/**
 * Le Ransomware choisit la réponse à chiffrer. Il préfère les réponses que le joueur choisit souvent
 * (poids 1 + 2 × nombre de fois récent), mais n'est jamais totalement prévisible.
 */
export function choisirVerrou(
  choix: readonly number[],
  historique: readonly number[],
  rnd: () => number,
): number {
  const recents = historique.slice(-20);
  const poids = choix.map((c) => 1 + 2 * recents.filter((h) => h === c).length);
  const total = poids.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < choix.length; i++) {
    r -= poids[i]!;
    if (r < 0) return choix[i]!;
  }
  return choix[choix.length - 1]!;
}

export type ResumeCombat = {
  bonnes: number;
  mauvaises: number;
  victoire: boolean;
  positions: readonly number[];
};
export function enregistrerCombat(p: Perf, r: ResumeCombat): Perf {
  return {
    tentatives: p.tentatives + r.bonnes + r.mauvaises,
    reussites: p.reussites + r.bonnes,
    combats: p.combats + 1,
    victoires: p.victoires + (r.victoire ? 1 : 0),
    positions: [...p.positions, ...r.positions].slice(-MAX_POSITIONS),
  };
}

/** Options à donner à creerCombat pour ce joueur. */
export function optionsCombat(p: Perf) {
  const m = modificateurs(niveauJoueur(p));
  return { pv: m.pv, temps: m.temps, degats: m.degats, verrou: choisirVerrou };
}

/* ───────────── Stockage (sur l'appareil, par joueur) ───────────── */
const cle = (uid: string) => `isitech.perf.v1.${uid}`;
export function lirePerf(uid: string): Perf {
  try {
    const b = typeof localStorage !== "undefined" ? localStorage.getItem(cle(uid)) : null;
    return b ? { ...PERF_VIDE, ...(JSON.parse(b) as Partial<Perf>) } : PERF_VIDE;
  } catch {
    return PERF_VIDE;
  }
}
export function ecrirePerf(uid: string, p: Perf): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(cle(uid), JSON.stringify(p));
  } catch {
    /* stockage indisponible */
  }
}
