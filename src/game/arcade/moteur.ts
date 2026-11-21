import type { EtatBase, Equipe, Jeu, JoueurPartie } from "./types";

/** Générateur pseudo-aléatoire reproductible (même graine = même partie). */
export function aleatoire(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Équipe qui a le meilleur score. `cle` donne une liste de nombres comparée dans l'ordre :
 * le plus petit est le meilleur (mets un signe moins pour « plus grand = meilleur »).
 * Renvoie null en cas d'égalité en tête.
 */
export function meilleureEquipe(
  equipes: readonly Equipe[],
  cle: (e: Equipe) => number[],
): Equipe | null {
  const cmp = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] ?? 0) - (b[i] ?? 0);
      if (d !== 0) return d;
    }
    return 0;
  };
  const tri = equipes.map((e) => ({ e, k: cle(e) })).sort((x, y) => cmp(x.k, y.k));
  if (tri.length === 0 || (tri.length > 1 && cmp(tri[0]!.k, tri[1]!.k) === 0)) return null;
  return tri[0]!.e;
}

export const borne = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Équipes encore représentées par des joueurs présents. */
export function equipesPresentes(joueurs: readonly JoueurPartie[]): Equipe[] {
  const r = new Set<Equipe>();
  for (const j of joueurs) if (!j.absent) r.add(j.equipe);
  return [...r];
}

/** Fin de partie : calcule le classement et fige l'état. */
export function terminer(jeu: Jeu, s: EtatBase): void {
  if (s.phase === "fini") return;
  s.phase = "fini";
  s.resultat = jeu.finir(s);
}

/**
 * Fait avancer une partie : décompte, jeu, puis fin (chrono, fin anticipée ou forfait).
 * C'est l'hôte (le propriétaire de la room) qui appelle cette fonction ; les autres reçoivent l'état.
 */
export function avancer(
  jeu: Jeu,
  s: EtatBase,
  entrees: Readonly<Record<string, number>>,
  dt: number,
): void {
  if (s.phase === "fini") return;
  if (s.phase === "compte") {
    s.compte -= dt;
    if (s.compte <= 0) {
      s.compte = 0;
      s.phase = "jeu";
    }
    return;
  }
  jeu.pas(s, entrees, dt);
  s.t += dt;
  if (equipesPresentes(s.joueurs).length < 2 || jeu.termine?.(s) || s.t >= s.duree) {
    s.t = Math.min(s.t, s.duree);
    terminer(jeu, s);
  }
}

/** Un joueur quitte en cours de partie. Si une seule équipe reste, la partie s'arrête. */
export function abandonner(jeu: Jeu, s: EtatBase, id: string): void {
  const j = s.joueurs.find((x) => x.id === id);
  if (!j || j.absent) return;
  j.absent = true;
  if (s.phase !== "fini" && equipesPresentes(s.joueurs).length < 2) terminer(jeu, s);
}

/** Propriétés qu'on lisse entre deux états reçus (les positions). Tout le reste vient du plus récent. */
const LISSEES: ReadonlySet<string> = new Set(["x", "y", "z"]);
/** Au-delà de cet écart, on considère que c'est une téléportation (réapparition) : pas de lissage. */
const SAUT_MAX = 150;

/**
 * Mélange deux états reçus du réseau pour afficher un mouvement fluide entre deux envois.
 * Seules les positions (x, y, z) sont interpolées ; les tableaux d'objets sont rapprochés par `id`.
 */
export function melange<T>(a: T, b: T, t: number, cle = ""): T {
  if (typeof a === "number" && typeof b === "number")
    return (LISSEES.has(cle) && Math.abs(b - a) <= SAUT_MAX ? a + (b - a) * t : b) as T;
  if (Array.isArray(a) && Array.isArray(b)) {
    return b.map((e, i) => {
      const id = e && typeof e === "object" ? (e as { id?: unknown }).id : undefined;
      const x =
        id !== undefined
          ? a.find((q) => q && typeof q === "object" && (q as { id?: unknown }).id === id)
          : a[i];
      return x === undefined ? e : melange(x, e, t, cle);
    }) as T;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const r: Record<string, unknown> = {};
    for (const k of Object.keys(b)) {
      const va = (a as Record<string, unknown>)[k];
      const vb = (b as Record<string, unknown>)[k];
      r[k] = va === undefined ? vb : melange(va, vb, t, k);
    }
    return r as T;
  }
  return b;
}

export const formaterTemps = (secondes: number) => {
  const s = Math.max(0, secondes);
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};
export const formaterChrono = (secondes: number) => {
  const s = Math.max(0, secondes);
  const m = Math.floor(s / 60);
  const reste = s - m * 60;
  return `${m}:${reste.toFixed(2).padStart(5, "0")}`;
};

/** Chrono, décompte et fin : dessinés par-dessus chaque mini-jeu, au même endroit. */
export function dessinerHud(
  ctx: CanvasRenderingContext2D,
  s: EtatBase,
  largeur: number,
  hauteur: number,
): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const restant = s.duree - s.t;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(largeur / 2 - 40, 4, 80, 26);
  ctx.fillStyle = s.phase === "jeu" && restant <= 10 ? "#ff6b6b" : "#ffd166";
  ctx.font = "bold 20px monospace";
  ctx.fillText(formaterTemps(Math.ceil(restant)), largeur / 2, 18);
  if (s.phase === "compte") {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 120px monospace";
    ctx.fillText(String(Math.max(1, Math.ceil(s.compte))), largeur / 2, hauteur / 2);
  } else if (s.phase === "jeu" && s.t < 0.7) {
    ctx.fillStyle = "#4fd1c5";
    ctx.font = "bold 90px monospace";
    ctx.fillText("GO !", largeur / 2, hauteur / 2);
  } else if (s.phase === "fini") {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, hauteur / 2 - 40, largeur, 80);
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 44px monospace";
    ctx.fillText("PARTIE TERMINÉE", largeur / 2, hauteur / 2);
  }
  ctx.restore();
}
