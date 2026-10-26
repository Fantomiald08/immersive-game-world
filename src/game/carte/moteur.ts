import type { Direction, Objet, PnjDef, Pt, Sortie, Zone } from "./types";

/** Taille d'une case à l'écran, en pixels (16 px d'art × 3). */
export const T = 48;
export const VEC: Record<Direction, Pt> = {
  haut: { x: 0, y: -1 },
  bas: { x: 0, y: 1 },
  gauche: { x: -1, y: 0 },
  droite: { x: 1, y: 0 },
};
export const cle = (x: number, y: number) => `${x},${y}`;

const dans = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Vrai si la case (x, y) est un mur du bord de la salle (sauf ouvertures et sorties). */
export function estMur(z: Zone, x: number, y: number): boolean {
  const { haut, bas, gauche, droite } = z.murs;
  const bord = y < haut || y >= z.h - bas || x < gauche || x >= z.l - droite;
  if (!bord) return false;
  return !(z.ouvertures.some((r) => dans(r, x, y)) || z.sorties.some((s) => dans(s, x, y)));
}

const caches = new WeakMap<Zone, Set<string>>();
/** Cases bloquées par des objets solides. */
function objetsBloquants(z: Zone): Set<string> {
  let s = caches.get(z);
  if (!s) {
    s = new Set();
    for (const o of z.objets) {
      if (!o.solide || o.plat) continue;
      for (let i = 0; i < o.w; i++) for (let j = 0; j < o.h; j++) s.add(cle(o.x + i, o.y + j));
    }
    caches.set(z, s);
  }
  return s;
}

export function estBloque(z: Zone, x: number, y: number, pnjs: readonly Pt[] = []): boolean {
  if (x < 0 || y < 0 || x >= z.l || y >= z.h) return true;
  if (estMur(z, x, y) || objetsBloquants(z).has(cle(x, y))) return true;
  return pnjs.some((p) => p.x === x && p.y === y);
}

export type Cible = { k: "objet"; o: Objet } | { k: "pnj"; p: PnjDef };

/** Ce qu'on a juste devant soi (case voisine dans la direction regardée). */
export function cibleDevant(
  z: Zone,
  x: number,
  y: number,
  dir: Direction,
  pnjs: readonly PnjDef[],
): Cible | null {
  const tx = x + VEC[dir].x,
    ty = y + VEC[dir].y;
  const p = pnjs.find((q) => q.x === tx && q.y === ty);
  if (p) return { k: "pnj", p };
  const ob = z.objets.find((q) => q.agir && dans(q, tx, ty));
  return ob ? { k: "objet", o: ob } : null;
}

export const sortieSous = (z: Zone, x: number, y: number): Sortie | undefined =>
  z.sorties.find((s) => dans(s, x, y));

/** Y a-t-il un chemin à pied entre a et b ? Sert aux tests (aucune porte ne doit être inaccessible). */
export function atteignable(z: Zone, a: Pt, b: Pt, pnjs: readonly Pt[] = []): boolean {
  const vus = new Set([cle(a.x, a.y)]);
  const pile = [a];
  while (pile.length) {
    const p = pile.pop()!;
    if (p.x === b.x && p.y === b.y) return true;
    for (const v of Object.values(VEC)) {
      const n = { x: p.x + v.x, y: p.y + v.y };
      if (vus.has(cle(n.x, n.y)) || estBloque(z, n.x, n.y, pnjs)) continue;
      vus.add(cle(n.x, n.y));
      pile.push(n);
    }
  }
  return false;
}

/** Libellé affiché au-dessus de la case pour dire ce que fera la touche d'action. */
export function libelleCible(c: Cible): string {
  if (c.k === "pnj") return c.p.monstre ? `Combattre : ${c.p.nom}` : `Parler : ${c.p.nom}`;
  const a = c.o.agir!;
  switch (a.k) {
    case "porte":
      return `Ouvrir la porte : ${a.nom}`;
    case "terminal":
      return "Utiliser l'ordinateur";
    case "classement":
      return "Voir le classement";
    default:
      return "Examiner";
  }
}
