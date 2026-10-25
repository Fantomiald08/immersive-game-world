/** Moteur de salle : données des scènes, collisions et portes. Logique pure, sans affichage. */
export const TUILE = 40;

export type SceneId = "hall" | "classe" | "serveur" | "cafeteria";
export type TypeDecor =
  | "mur"
  | "tableau"
  | "bureau"
  | "plante"
  | "banc"
  | "accueil"
  | "casier"
  | "rack"
  | "table"
  | "comptoir"
  | "tapis"
  | "objet"
  | "mural"
  | "cable"
  | "babyfoot";
export type Decor = {
  x: number;
  y: number;
  w: number;
  h: number;
  type: TypeDecor;
  solide: boolean;
  /** Emoji affiché (objet, mural). */ e?: string;
  /** Texte affiché (panneaux, logo). */ txt?: string;
  /** Couleur CSS (câbles). */ c?: string;
  /** Petite animation. */ anim?: "blink" | "bob";
  /** Posé sur un meuble : dessiné par-dessus lui. */ dessus?: boolean;
};
export type Porte = { x: number; y: number; w: number; h: number; vers: SceneId; label: string };
export type Point = { x: number; y: number };
export type Scene = {
  id: SceneId;
  nom: string;
  l: number;
  h: number;
  sol: string;
  decor: Decor[];
  portes: Porte[];
  /** Point d'arrivée selon la salle d'où l'on vient ("debut" = première arrivée). */
  entrees: Partial<Record<SceneId | "debut", Point>>;
};

export const d = (type: TypeDecor, x: number, y: number, w = 1, h = 1, solide = true): Decor => ({
  type,
  x,
  y,
  w,
  h,
  solide,
});

/** Objet de décor avec emoji (solide par défaut). */
export const obj = (
  e: string,
  x: number,
  y: number,
  w = 1,
  h = 1,
  solide = true,
  extra: Partial<Decor> = {},
): Decor => ({ type: "objet", e, x, y, w, h, solide, ...extra });
/** Objet posé sur un meuble (non solide, dessiné par-dessus). */
export const sur = (e: string, x: number, y: number, extra: Partial<Decor> = {}): Decor => ({
  type: "objet",
  e,
  x,
  y,
  w: 1,
  h: 1,
  solide: false,
  dessus: true,
  ...extra,
});
/** Objet posé au sol (non solide, dessiné sous les joueurs). */
export const sol = (
  e: string,
  x: number,
  y: number,
  w = 1,
  h = 1,
  extra: Partial<Decor> = {},
): Decor => ({ type: "objet", e, x, y, w, h, solide: false, ...extra });
/** Décor accroché au mur (sur la rangée du haut). */
export const mural = (e: string, x: number, w = 1, extra: Partial<Decor> = {}): Decor => ({
  type: "mural",
  e,
  x,
  y: 0,
  w,
  h: 1,
  solide: false,
  ...extra,
});
/** Câble coloré posé au sol. */
export const cable = (c: string, x: number, y: number, w: number, h = 0.12): Decor => ({
  type: "cable",
  c,
  x,
  y,
  w,
  h,
  solide: false,
});

const R = 0.3; // demi-largeur des pieds du joueur

/** Vrai si les pieds du joueur centrés en (x, y) touchent un obstacle ou sortent de la salle. */
export function bloque(s: Scene, x: number, y: number): boolean {
  const x0 = x - R,
    x1 = x + R,
    y0 = y - 0.25,
    y1 = y;
  if (x0 < 0 || x1 > s.l || y0 < 0 || y1 > s.h) return true;
  return s.decor.some((o) => o.solide && x1 > o.x && x0 < o.x + o.w && y1 > o.y && y0 < o.y + o.h);
}

export function porteSous(s: Scene, x: number, y: number): Porte | undefined {
  return s.portes.find((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
}

/** Déplace en glissant le long des murs (axe X puis axe Y). */
export function deplacer(s: Scene, p: Point, dx: number, dy: number): Point {
  let { x, y } = p;
  if (!bloque(s, x + dx, y)) x += dx;
  if (!bloque(s, x, y + dy)) y += dy;
  return { x, y };
}

/** Cherche si on peut aller de a vers b (grille fine). Sert aux tests : aucune porte ne doit être bouchée. */
export function atteignable(s: Scene, a: Point, b: Point, pas = 0.25): boolean {
  const k = (x: number, y: number) => `${Math.round(x / pas)},${Math.round(y / pas)}`;
  const vus = new Set([k(a.x, a.y)]);
  const file: Point[] = [a];
  while (file.length) {
    const p = file.pop()!;
    if (Math.hypot(p.x - b.x, p.y - b.y) <= 0.6) return true;
    for (const [dx, dy] of [
      [pas, 0],
      [-pas, 0],
      [0, pas],
      [0, -pas],
    ] as const) {
      const n = { x: p.x + dx, y: p.y + dy };
      const id = k(n.x, n.y);
      if (vus.has(id) || bloque(s, n.x, n.y)) continue;
      vus.add(id);
      file.push(n);
    }
  }
  return false;
}
