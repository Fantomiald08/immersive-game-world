import { BTN, type Entree } from "../types";

/**
 * Un « cerveau » décide à chaque image quelles touches presser pour un joueur piloté par l'ordinateur.
 * Il ne lit que l'état de la partie, exactement comme un joueur : aucune triche sur les règles.
 */
export type Cerveau = (etat: import("../types").EtatBase, dt: number) => Entree;

/** Transforme une direction en touches (8 directions possibles). */
export function bitsDirection(vx: number, vy: number, seuil = 0.38): Entree {
  const n = Math.hypot(vx, vy);
  if (n < 1e-6) return 0;
  const ux = vx / n;
  const uy = vy / n;
  let b = 0;
  if (ux > seuil) b |= BTN.droite;
  else if (ux < -seuil) b |= BTN.gauche;
  if (uy > seuil) b |= BTN.bas;
  else if (uy < -seuil) b |= BTN.haut;
  return b;
}

export const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(bx - ax, by - ay);

/** Le segment A→B traverse-t-il l'un des rectangles ? (échantillonné tous les 8 px, largement assez ici) */
export function segmentBloque(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  murs: ReadonlyArray<{ x: number; y: number; w: number; h: number }>,
): boolean {
  const n = Math.max(1, Math.ceil(distance(ax, ay, bx, by) / 8));
  for (let k = 1; k < n; k++) {
    const x = ax + ((bx - ax) * k) / n;
    const y = ay + ((by - ay) * k) / n;
    if (murs.some((m) => x > m.x && x < m.x + m.w && y > m.y && y < m.y + m.h)) return true;
  }
  return false;
}

/** Distance du point P à la droite passant par A et B (et position le long du segment, 0 à 1). */
export function projeter(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { dist: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = ((px - ax) * dx + (py - ay) * dy) / l2;
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  return { dist: Math.hypot(px - cx, py - cy), t };
}
