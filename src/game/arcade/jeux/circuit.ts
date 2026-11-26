/**
 * Le circuit de la course : une boucle de 2 400 m dans une grande arène néon, à parcourir 3 fois.
 * Données et fonctions pures (aucun dessin) : virages continus, 3 embranchements avec deux routes,
 * obstacles, flaques d'huile et dalles de boost.
 */
export const LONGUEUR_TOUR = 2400;
export const TOURS = 3;

/** [longueur du tronçon en m, courbure]. >0 = vers la droite. Jamais de longue ligne droite. */
const BRUT: ReadonlyArray<readonly [number, number]> = [
  [60, 0.4],
  [90, -0.9],
  // Boucle 1 : grand virage en spirale vers la droite qui se resserre
  [120, 1.1],
  [130, 1.5],
  [110, 1.7],
  // S rapide puis épingle à gauche
  [90, -1.2],
  [100, 1.0],
  [70, -1.9],
  [80, 0.8],
  [70, -0.9],
  // Boucle 2 : spirale vers la gauche
  [110, -1.2],
  [130, -1.5],
  [110, -1.6],
  // Chicane serrée
  [60, 1.1],
  [60, -1.1],
  [60, 1.1],
  [100, -0.7],
  // Boucle 3 : la plus serrée, qui finit en épingle
  [100, 1.3],
  [120, 1.6],
  [110, 1.8],
  [80, 1.4],
  [90, -1.3],
  [70, 1.9],
  [80, -1.0],
  [90, 0.9],
];
const SOMME = BRUT.reduce((t, [l]) => t + l, 0);
/** Le dernier tronçon complète la boucle exactement. */
export const TRONCONS: ReadonlyArray<readonly [number, number]> = [
  ...BRUT,
  [LONGUEUR_TOUR - SOMME, -0.9],
];

const mod = (z: number) => ((z % LONGUEUR_TOUR) + LONGUEUR_TOUR) % LONGUEUR_TOUR;

export function courbure(z: number): number {
  let d = mod(z);
  for (const [l, c] of TRONCONS) {
    if (d < l) return c;
    d -= l;
  }
  return 0;
}

/** Courbure moyenne sur une fenêtre autour de z (pour des changements de caméra progressifs). */
export function courbureLissee(z: number, avant = 90, arriere = 30): number {
  let t = 0;
  const n = 10;
  for (let i = 0; i < n; i++) t += courbure(z - arriere + ((avant + arriere) * i) / (n - 1));
  return t / n;
}

/**
 * Profil de caméra le long de la boucle : relief (la ligne d'horizon monte et descend comme sur des bosses),
 * recul supplémentaire et roulis dans les grandes boucles. Valeurs cibles, lissées par le dessin.
 */
export function profilCamera(z: number): { horizon: number; recul: number; roulis: number } {
  const c = courbureLissee(z);
  const relief = Math.sin(z / 210) * 18 + Math.sin(z / 87 + 1.3) * 9;
  return {
    horizon: relief - Math.abs(c) * 7,
    recul: Math.min(2.6, Math.abs(c) * 1.7),
    roulis: -c * 0.04,
  };
}

/** Cap (direction) cumulé le long de la boucle, pour faire défiler le décor lointain avec les virages. */
const CAP: number[] = [];
export function cap(z: number): number {
  if (CAP.length === 0) {
    let a = 0;
    for (let i = 0; i <= LONGUEUR_TOUR; i++) {
      CAP.push(a);
      a += courbure(i);
    }
  }
  const i = Math.floor(mod(z));
  return CAP[i]!;
}

/** Embranchements : deux routes côte à côte, séparées par un muret central. */
export type Fork = { debut: number; fin: number };
export const FORKS: ReadonlyArray<Fork> = [
  { debut: 380, fin: 560 },
  { debut: 1150, fin: 1330 },
  { debut: 1850, fin: 2030 },
];
/** Voie extérieure (gauche, large, fluide) / intérieure (droite, étroite, raccourci technique). */
export const MURET = 0.07;
export const LIMITE_INTERIEURE = 0.72;
export const BONUS_RACCOURCI = 0.12;

export const forkA = (z: number): Fork | null => {
  const m = mod(z);
  return FORKS.find((f) => m >= f.debut && m <= f.fin) ?? null;
};
/** Prochain embranchement dans les `dist` mètres devant `z` (ou null). */
export function prochainFork(z: number, dist: number): Fork | null {
  const m = mod(z);
  for (const f of FORKS) {
    const d = f.debut - m;
    if (d > 0 && d <= dist) return f;
    if (m >= f.debut && m <= f.fin) return f;
  }
  return null;
}

export type TypeObstacle = "plot" | "bloc" | "huile" | "boost";
export type Obstacle = {
  id: number;
  /** Position le long de la boucle (m). */
  z: number;
  /** Position latérale (-1 à 1). */
  x: number;
  type: TypeObstacle;
  /** Largeur latérale (unités de route). */
  w: number;
  /** Profondeur (m). */
  prof: number;
};
const O = (type: TypeObstacle, z: number, x: number): Omit<Obstacle, "id"> => ({
  type,
  z,
  x,
  w: type === "plot" ? 0.12 : type === "bloc" ? 0.3 : type === "huile" ? 0.5 : 0.4,
  prof: type === "plot" ? 3 : type === "bloc" ? 4 : type === "huile" ? 14 : 9,
});
export const OBSTACLES: ReadonlyArray<Obstacle> = (
  [
    // Embranchement 1 : voie intérieure semée de plots, voie extérieure avec une flaque
    O("plot", 400, 0.3),
    O("plot", 425, 0.52),
    O("plot", 450, 0.28),
    O("plot", 480, 0.5),
    O("plot", 505, 0.3),
    O("bloc", 530, 0.5),
    O("boost", 546, 0.36),
    O("huile", 430, -0.55),
    O("plot", 500, -0.8),
    // Entre les embranchements : on ne s'ennuie jamais
    O("plot", 640, -0.3),
    O("plot", 660, 0.3),
    O("plot", 680, -0.3),
    O("huile", 760, 0.1),
    O("bloc", 840, -0.6),
    O("boost", 900, 0.0),
    O("plot", 960, 0.5),
    O("plot", 985, -0.5),
    O("bloc", 1040, 0.5),
    O("huile", 1090, -0.3),
    // Embranchement 2
    O("plot", 1170, 0.3),
    O("plot", 1195, 0.52),
    O("plot", 1220, 0.3),
    O("plot", 1250, 0.55),
    O("plot", 1280, 0.3),
    O("bloc", 1302, 0.5),
    O("boost", 1318, 0.36),
    O("huile", 1200, -0.5),
    O("bloc", 1260, -0.72),
    O("plot", 1420, 0.0),
    O("plot", 1440, -0.4),
    O("huile", 1500, 0.4),
    O("boost", 1560, -0.3),
    O("bloc", 1620, 0.0),
    O("plot", 1680, 0.6),
    O("plot", 1700, -0.6),
    O("huile", 1760, 0.2),
    // Embranchement 3
    O("plot", 1870, 0.3),
    O("plot", 1900, 0.55),
    O("plot", 1925, 0.3),
    O("plot", 1955, 0.5),
    O("bloc", 1985, 0.3),
    O("boost", 2016, 0.4),
    O("huile", 1900, -0.5),
    O("plot", 1960, -0.9),
    O("huile", 2000, -0.6),
    // Dernière ligne droite relative
    O("boost", 2100, -0.2),
    O("plot", 2200, 0.3),
    O("plot", 2220, -0.3),
    O("huile", 2300, 0.1),
    O("bloc", 2350, -0.5),
  ] as Array<Omit<Obstacle, "id">>
).map((o, i) => ({ ...o, id: i }));

/** Distance signée le long de la boucle de z vers un point de la boucle, entre -L/2 et L/2. */
export function ecartBoucle(z: number, zo: number): number {
  const d = mod(z - zo);
  return d > LONGUEUR_TOUR / 2 ? d - LONGUEUR_TOUR : d;
}
export { mod as modBoucle };
