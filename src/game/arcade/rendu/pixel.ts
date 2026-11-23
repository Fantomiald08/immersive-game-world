import { apparenceDepuis, type Apparence, type Direction } from "../../apparence";
import { nuance } from "../../carte/couleur";
import type { JoueurPartie } from "../types";

/** Outils de dessin pixel-art partagés par les trois mini-jeux. Même contour que le monde d'ISITECH WORLD. */
export const OL = "#2a1810";

/** Rectangle aux coordonnées arrondies (pixels nets). */
export function r(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: string,
): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Rectangle avec contour sombre d'un pixel. */
export function bloc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: string,
  ol = OL,
): void {
  r(ctx, x - 1, y, w + 2, h, ol);
  r(ctx, x, y - 1, w, h + 2, ol);
  r(ctx, x, y, w, h, c);
}

/** Ombre portée au sol (ellipse aplatie). */
export function ombre(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha = 0.38,
): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y), Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Halo lumineux (néon, explosion). */
export function halo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rayon: number,
  couleur: string,
  alpha = 0.5,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rayon);
  g.addColorStop(0, couleur);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - rayon, y - rayon, rayon * 2, rayon * 2);
  ctx.globalAlpha = 1;
}

/** Nombre pseudo-aléatoire stable entre 0 et 1 (pour le décor et la foule). */
export const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Texte avec contour sombre. */
export function texte(
  ctx: CanvasRenderingContext2D,
  txt: string,
  x: number,
  y: number,
  taille: number,
  couleur: string,
  align: CanvasTextAlign = "center",
): void {
  ctx.font = `bold ${taille}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = OL;
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const)
    ctx.fillText(txt, Math.round(x + dx), Math.round(y + dy));
  ctx.fillStyle = couleur;
  ctx.fillText(txt, Math.round(x), Math.round(y));
}

/** Panneau de HUD : fond sombre, contour pixel et liseré néon. */
export function panneau(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  neon = "#4fd1c5",
): void {
  r(ctx, x - 2, y - 2, w + 4, h + 4, OL);
  r(ctx, x, y, w, h, "rgba(10,14,24,0.82)");
  r(ctx, x, y, w, 2, neon);
}

/* ───────────── Décor en cache ───────────── */
const caches = new Map<string, HTMLCanvasElement | null>();

/**
 * Dessine un décor fixe une seule fois dans un canvas caché, puis le recopie à chaque image
 * (c'est ce qui permet un décor très détaillé à 60 images par seconde).
 * Renvoie faux si le cache n'est pas disponible : à l'appelant de dessiner directement.
 */
export function decorEnCache(
  cle: string,
  l: number,
  h: number,
  dessiner: (ctx: CanvasRenderingContext2D) => void,
  cible: CanvasRenderingContext2D,
  dx = 0,
  dy = 0,
): boolean {
  let c = caches.get(cle);
  if (c === undefined) {
    c = null;
    if (typeof document !== "undefined") {
      const el = document.createElement("canvas");
      el.width = l;
      el.height = h;
      const cx = el.getContext("2d");
      if (cx) {
        dessiner(cx);
        c = el;
      }
    }
    caches.set(cle, c);
  }
  if (!c) return false;
  cible.drawImage(c, dx, dy);
  return true;
}

/* ───────────── Le personnage chibi d'ISITECH WORLD ───────────── */
export type PoseChibi =
  "idle" | "marche" | "saut" | "garde" | "leger" | "lourd" | "special" | "degat" | "ko";

export const apparenceDe = (j: Pick<JoueurPartie, "id" | "apparence">): Apparence =>
  j.apparence ?? apparenceDepuis(j.id);

/**
 * Dessine le personnage « chibi » du monde (grille 16×25, grosse tête, contour sombre) sur canvas.
 * (x, y) = point entre les pieds. `ech` = pixels par case de la grille (entier pour rester net).
 */
export function dessinerChibi(
  ctx: CanvasRenderingContext2D,
  o: {
    x: number;
    y: number;
    ech: number;
    a: Apparence;
    dir: Direction;
    /** Image de marche 0 à 3. */
    frame?: number;
    pose?: PoseChibi;
    /** Avancement de l'attaque (0 à 1). */
    progres?: number;
    /** Dessine tout en blanc (flash d'impact). */
    blanc?: boolean;
    alpha?: number;
  },
): void {
  const { a, ech } = o;
  const dir = o.dir;
  const pose = o.pose ?? "idle";
  const f = o.frame ?? 0;
  const prog = o.progres ?? 0;
  const cote = dir === "gauche" || dir === "droite";
  const dos = dir === "haut";
  const peau = o.blanc ? "#fff" : a.peau;
  const haut = o.blanc ? "#fff" : a.hautCouleur;
  const bas = o.blanc ? "#eee" : a.basCouleur;
  const cheveux = o.blanc ? "#fff" : a.cheveux;
  const chaus = o.blanc ? "#fff" : a.chaussures;
  const peauO = nuance(peau, 0.82);
  const hautO = nuance(haut, 0.8);

  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(Math.round(o.x), Math.round(o.y));
  const ko = pose === "ko";
  if (ko) ctx.rotate(dir === "droite" ? -Math.PI / 2 : Math.PI / 2);
  if (dir === "gauche" && cote) ctx.scale(-1, 1);
  ctx.scale(ech, ech);
  ctx.translate(-8, -25);

  const R = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const PB = (x: number, y: number, w: number, h: number, c: string) => {
    R(x, y - 1, w, h + 2, OL);
    R(x - 1, y, w + 2, h, OL);
    R(x, y, w, h, c);
  };

  // Mouvements du corps selon la pose
  const rebond =
    pose === "marche" && f % 2 === 1 ? -1 : pose === "idle" ? (f % 2 === 1 ? 0 : 0) : 0;
  let pencher = 0;
  let teteX = 0;
  let teteY = 0;
  if (pose === "degat") {
    pencher = -1;
    teteX = -1;
    teteY = -1;
  } else if (pose === "special") pencher = 1;
  else if (pose === "lourd") pencher = prog < 0.35 ? -1 : 0;
  ctx.translate(pencher, rebond);

  /* Jambes */
  const jambe = (x: number, long: number, c: string, avant: boolean) => {
    PB(x, 17, 3, long, c);
    if (a.bas === "short" || a.bas === "jupe") R(x, 17, 3, 2, bas);
    PB(avant ? x : x - 1, 17 + long - 1, 4, 2, chaus);
  };
  const cj = a.bas === "jupe" || a.bas === "short" ? peau : bas;
  if (pose === "saut") {
    jambe(4, 3, cj, false);
    jambe(9, 4, cj, true);
  } else if (pose === "lourd" && prog >= 0.35) {
    // Coup de pied : la jambe avant part en avant, à l'horizontale.
    jambe(5, 5, cj, false);
    PB(8, 16, 10, 3, cj);
    PB(17, 15, 3, 5, chaus);
  } else if (pose === "marche") {
    const l1 = f === 1 ? 4 : 5;
    const l2 = f === 3 ? 4 : 5;
    jambe(4, l1, cj, false);
    jambe(9, l2, cj, true);
  } else {
    jambe(4, 5, cj, false);
    jambe(9, 5, cj, true);
  }

  /* Sac à dos (derrière) */
  if (a.accessoire === "sac" && !o.blanc) PB(cote ? 1 : 3, 11, 4, 6, "#6b4128");

  /* Torse */
  PB(4, 11, 8, 7, haut);
  R(4, 15, 8, 3, hautO);
  if (a.haut === "chemise" || a.haut === "veste") R(7, 11, 2, 7, nuance(haut, 1.25));
  if (a.accessoire === "badge" && !dos && !o.blanc) R(5, 12, 2, 2, "#f4f4f4");

  /* Bras */
  const brasA = (x: number, y: number, w: number, h: number) => {
    PB(x, y, w, h, a.haut === "tshirt" ? peau : haut);
    if (a.haut === "tshirt") R(x, y, w, 2, haut);
  };
  const poing = (x: number, y: number) => PB(x, y, 3, 3, peau);
  if (pose === "garde") {
    brasA(10, 9, 3, 6);
    poing(10, 7);
    if (!cote) brasA(3, 9, 3, 6);
  } else if (pose === "leger") {
    const ext = Math.round(3 + 6 * Math.min(1, prog * 3));
    PB(11, 12, ext, 3, a.haut === "tshirt" ? peau : haut);
    poing(11 + ext - 1, 11);
    if (!cote) brasA(1, 12, 3, 5);
  } else if (pose === "special") {
    PB(11, 12, 8, 3, peau);
    PB(11, 8, 8, 3, peau);
    poing(18, 10);
  } else if (pose === "saut") {
    brasA(12, 7, 3, 5);
    brasA(1, 7, 3, 5);
  } else if (pose === "degat") {
    brasA(0, 10, 3, 5);
    brasA(13, 9, 3, 4);
  } else {
    const sw = pose === "marche" ? (f === 1 ? -1 : f === 3 ? 1 : 0) : 0;
    if (!cote) {
      brasA(1, 12 + sw, 3, 5);
      brasA(12, 12 - sw, 3, 5);
    } else brasA(7 + sw, 12, 3, 5);
  }

  /* Tête */
  ctx.translate(teteX, teteY);
  PB(3, 2, 10, 9, peau);
  R(3, 9, 10, 2, peauO);
  const coupeCheveux = a.coiffure === "rase" ? 2 : 3;
  if (dos) {
    PB(3, 1, 10, 9, cheveux);
  } else {
    PB(3, 1, 10, coupeCheveux, cheveux);
    if (a.coiffure === "longue" || a.coiffure === "boucles") {
      R(2, 3, 2, 6, cheveux);
      if (!cote) R(12, 3, 2, 6, cheveux);
    }
    if (a.coiffure === "herisse") {
      R(4, 0, 2, 2, cheveux);
      R(8, 0, 2, 2, cheveux);
      R(11, 1, 2, 1, cheveux);
    }
    if (a.coiffure === "chignon") R(6, -1, 4, 3, cheveux);
    if (a.coiffure === "boucles") R(3, 0, 10, 1, nuance(cheveux, 1.3));
    // Visage
    const yeux = o.blanc ? "#999" : a.yeux;
    if (pose === "degat" || ko) {
      R(5, 6, 2, 1, OL);
      if (!cote) R(9, 6, 2, 1, OL);
      R(cote ? 9 : 7, 9, 2, 1, "#c0392b");
    } else if (!cote) {
      R(5, 6, 2, 2, yeux);
      R(9, 6, 2, 2, yeux);
      R(5, 6, 1, 1, "#fff");
      R(9, 6, 1, 1, "#fff");
      R(7, 9, 2, 1, nuance(peau, 0.65));
    } else {
      R(9, 6, 2, 2, yeux);
      R(9, 6, 1, 1, "#fff");
      R(10, 9, 2, 1, nuance(peau, 0.65));
    }
    if (a.accessoire === "lunettes") R(cote ? 8 : 4, 6, cote ? 4 : 8, 1, "#222");
  }
  if (a.accessoire === "casquette") {
    PB(3, 0, 10, 3, "#d9483b");
    if (!dos) R(cote ? 11 : 3, 2, cote ? 5 : 10, 1, "#a8322a");
  }
  if (a.accessoire === "casque") {
    R(2, 5, 2, 4, "#2d2d3a");
    if (!cote) R(12, 5, 2, 4, "#2d2d3a");
    R(3, 1, 10, 1, "#2d2d3a");
  }
  ctx.restore();
}
