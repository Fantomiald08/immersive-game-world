import { borne, dessinerHud, emettre, formaterChrono, meilleureEquipe } from "../moteur";
import type { Effets } from "../fx";
import { bloc, decorEnCache, halo, hash, ombre, OL, panneau, r, texte } from "../rendu/pixel";
import {
  BTN,
  COULEUR_EQUIPE,
  DUREE_COMPTE,
  presse,
  type EtatBase,
  type Jeu,
  type JoueurPartie,
  type LigneClassement,
  type Resultat,
  equipesDe,
  nomEquipe,
} from "../types";
import {
  BONUS_RACCOURCI,
  cap,
  courbure,
  ecartBoucle,
  FORKS,
  forkA,
  LIMITE_INTERIEURE,
  LONGUEUR_TOUR,
  modBoucle,
  MURET,
  OBSTACLES,
  TOURS,
  type Fork,
  type Obstacle,
} from "./circuit";

export { courbure, LONGUEUR_TOUR, TOURS };

/**
 * Mini-jeu : course de véhicules en vue humaine (derrière la voiture, route en perspective) dans une
 * immense arène néon à gradins. 3 tours d'un circuit sinueux avec 3 embranchements, obstacles, flaques
 * d'huile et dalles de boost. Classement au temps ; les non-arrivés sont classés à la distance.
 */

export const L = 800;
export const H = 480;
/** Plus longue que les 120 s des autres jeux : 3 tours dans une grande arène. */
export const DUREE_COURSE = 210;
export const VMAX = 56; // m/s (≈ 200 km/h)
const ACCEL = 30;
const FREIN = 62;
const FROTTEMENT = 11;
const NITRO_DUREE = 1.3;
const NITRO_RECHARGE = 6;
const HORS_PISTE_VMAX = 0.35 * VMAX;

export type Voiture = {
  id: string;
  /** Distance totale parcourue (m). */
  z: number;
  /** Position latérale : -1 = bord gauche de la route, 1 = bord droit. */
  x: number;
  v: number;
  nitro: number;
  nitroCd: number;
  /** Direction braquée (-1, 0, 1), pour le dessin. */
  dir: number;
  /** Temps d'arrivée (s) ou -1. */
  fin: number;
  /** Freine (feux arrière allumés). */
  frein: boolean;
  /** Délai pendant lequel un nouveau choc n'est pas compté. */
  choc: number;
  /** > 0 : sur une flaque d'huile (dérapage). */
  glisse: number;
  derive: number;
  /** > 0 : boosté par une dalle. */
  boost: number;
  boostCd: number;
  /** Tours terminés. */
  tours: number;
  /** Dernier côté de l'embranchement (-1 / 1). */
  cote: number;
};
export type EtatCourse = EtatBase & { v: Voiture[] };

function creer(joueurs: JoueurPartie[]): EtatCourse {
  return {
    phase: "compte",
    compte: DUREE_COMPTE,
    t: 0,
    duree: DUREE_COURSE,
    joueurs: joueurs.map((j) => ({ ...j })),
    resultat: null,
    ev: [],
    evN: 0,
    v: joueurs.map((j, i) => ({
      id: j.id,
      z: 0 - i * 6,
      x: joueurs.length === 1 ? 0 : -0.6 + (1.2 * i) / (joueurs.length - 1),
      v: 0,
      nitro: 0,
      nitroCd: 0,
      dir: 0,
      fin: -1,
      frein: false,
      choc: 0,
      glisse: 0,
      derive: 0,
      boost: 0,
      boostCd: 0,
      tours: 0,
      cote: 1,
    })),
  };
}

/** Collisions avec les obstacles, les flaques et les dalles de boost. Jamais bloquantes. */
function obstacles(s: EtatCourse, c: Voiture): void {
  for (const o of OBSTACLES) {
    const d = ecartBoucle(c.z, o.z);
    if (d < -3 || d > o.prof + 3) continue;
    const dx = Math.abs(c.x - o.x);
    if (o.type === "plot" || o.type === "bloc") {
      if (Math.abs(d) < 2.5 && dx < o.w / 2 + 0.07 && c.choc <= 0) {
        const fort = o.type === "bloc";
        c.v *= fort ? 0.38 : 0.55;
        c.choc = 0.6;
        c.x += (c.x >= o.x ? 1 : -1) * (fort ? 0.16 : 0.1);
        emettre(s, { k: "choc", x: c.x, y: 0, v: fort ? 2 : 1, qui: c.id });
      }
    } else if (o.type === "huile") {
      if (d >= 0 && d <= o.prof && dx < o.w / 2 + 0.05) {
        if (c.glisse <= 0.25) {
          c.derive = c.x >= o.x ? 1 : -1;
          emettre(s, { k: "huile", x: c.x, y: 0, qui: c.id });
        }
        c.glisse = 1.2;
      }
    } else if (d >= 0 && d <= o.prof && dx < o.w / 2 + 0.05 && c.boostCd <= 0) {
      c.boost = 1.5;
      c.boostCd = 1.5;
      c.v += 9;
      emettre(s, { k: "boost", x: c.x, y: 0, qui: c.id });
    }
  }
}

function pas(base: EtatBase, entrees: Readonly<Record<string, number>>, dt: number): void {
  const s = base as EtatCourse;
  s.v.forEach((c, i) => {
    const arrive = c.fin >= 0;
    const e = arrive || s.joueurs[i]!.absent ? 0 : (entrees[c.id] ?? 0);
    const gaz = presse(e, BTN.haut);
    const frein = presse(e, BTN.bas);
    c.nitroCd = Math.max(0, c.nitroCd - dt);
    c.nitro = Math.max(0, c.nitro - dt);
    c.choc = Math.max(0, c.choc - dt);
    c.glisse = Math.max(0, c.glisse - dt);
    c.boost = Math.max(0, c.boost - dt);
    c.boostCd = Math.max(0, c.boostCd - dt);
    if (presse(e, BTN.a) && c.nitroCd <= 0) {
      c.nitro = NITRO_DUREE;
      c.nitroCd = NITRO_RECHARGE;
    }
    const vmax = Math.max(c.nitro > 0 ? 1.35 : 1, c.boost > 0 ? 1.3 : 1) * VMAX;
    const acc = c.nitro > 0 || c.boost > 0 ? ACCEL * 2 : ACCEL;
    if (arrive) c.v = Math.max(18, c.v - 15 * dt);
    else if (gaz) c.v += acc * dt;
    else c.v = c.v > 0 ? Math.max(0, c.v - FROTTEMENT * dt) : Math.min(0, c.v + FROTTEMENT * dt);
    if (frein) c.v -= FREIN * dt;
    c.frein = frein && c.v > 2;
    if (c.glisse > 0) c.v = Math.max(0, c.v - 7 * dt);
    c.v = borne(c.v, -8, vmax);

    const horsPiste = Math.abs(c.x) > 1.02;
    if (horsPiste && c.v > HORS_PISTE_VMAX) c.v = Math.max(HORS_PISTE_VMAX, c.v - 70 * dt);

    const braque = (presse(e, BTN.droite) ? 1 : 0) - (presse(e, BTN.gauche) ? 1 : 0);
    c.dir = braque;
    const rapide = borne(c.v / VMAX, -0.3, 1.35);
    // Sur l'huile, la voiture répond mal et dérive.
    c.x += braque * 2.1 * rapide * (c.glisse > 0 ? 0.35 : 1) * dt;
    if (c.glisse > 0) c.x += c.derive * 0.9 * rapide * dt;
    // La force centrifuge pousse vers l'extérieur du virage.
    c.x -= courbure(c.z) * rapide * rapide * 1.1 * dt;
    c.x = borne(c.x, -1.6, 1.6);

    // Embranchement : muret central et limite de la voie intérieure (rebond, jamais de blocage).
    const fork = forkA(c.z);
    if (fork) {
      if (Math.abs(c.x) > MURET + 0.03) c.cote = c.x > 0 ? 1 : -1;
      if (Math.abs(c.x) < MURET) {
        c.x = c.cote * (MURET + 0.03);
        c.v *= 0.82;
        if (c.choc <= 0) {
          c.choc = 0.5;
          emettre(s, { k: "choc", x: c.x, y: 0, v: 1, qui: c.id });
        }
      } else if (c.x > LIMITE_INTERIEURE) {
        c.x = LIMITE_INTERIEURE - 0.04;
        c.v *= 0.85;
        if (c.choc <= 0) {
          c.choc = 0.5;
          emettre(s, { k: "choc", x: c.x, y: 0, v: 1, qui: c.id });
        }
      }
    }
    obstacles(s, c);
    // La voie intérieure est un raccourci : on y avance un peu plus vite.
    c.z += c.v * dt * (fork && c.x > MURET ? 1 + BONUS_RACCOURCI : 1);

    const tour = Math.floor(c.z / LONGUEUR_TOUR);
    if (!arrive && tour > c.tours && tour < TOURS) {
      c.tours = tour;
      emettre(s, { k: "tour", x: 0, y: 0, v: tour + 1, qui: c.id });
    }
    if (!arrive && c.z >= LONGUEUR_TOUR * TOURS) {
      c.fin = s.t;
      c.z = LONGUEUR_TOUR * TOURS;
      emettre(s, { k: "tour", x: 0, y: 0, v: TOURS + 1, qui: c.id });
    }
  });
  // Pare-chocs : la voiture qui touche celle de devant est ralentie, avec des étincelles.
  for (let i = 0; i < s.v.length; i++)
    for (let j = i + 1; j < s.v.length; j++) {
      const a = s.v[i]!;
      const b = s.v[j]!;
      if (Math.abs(a.z - b.z) < 7 && Math.abs(a.x - b.x) < 0.24) {
        const [derriere, devant] = a.z < b.z ? [a, b] : [b, a];
        derriere.v = Math.min(derriere.v, devant.v * 0.96);
        const ecart = derriere.x <= devant.x ? -1 : 1;
        derriere.x += ecart * 0.02;
        devant.x -= ecart * 0.02;
        if (derriere.choc <= 0) {
          derriere.choc = 0.4;
          emettre(s, { k: "choc", x: derriere.x, y: 0, v: 1, qui: derriere.id });
        }
      }
    }
}

function termine(base: EtatBase): boolean {
  const s = base as EtatCourse;
  return s.v.every((c, i) => c.fin >= 0 || s.joueurs[i]!.absent);
}

/** Classement : arrivés au temps, puis les autres à la distance parcourue. */
function classer(s: EtatCourse): Array<{ c: Voiture; j: JoueurPartie; rang: number }> {
  return s.v
    .map((c, i) => ({ c, j: s.joueurs[i]! }))
    .sort((a, b) => {
      if (a.j.absent !== b.j.absent) return a.j.absent ? 1 : -1;
      if (a.c.fin >= 0 && b.c.fin >= 0) return a.c.fin - b.c.fin;
      if (a.c.fin >= 0) return -1;
      if (b.c.fin >= 0) return 1;
      return b.c.z - a.c.z;
    })
    .map((x, i) => ({ ...x, rang: i + 1 }));
}

function finir(base: EtatBase): Resultat {
  const s = base as EtatCourse;
  const cl = classer(s);
  // Une équipe gagne avec le plus petit total de places ; à égalité, avec la meilleure place individuelle.
  const vainqueur = meilleureEquipe(equipesDe(s.joueurs), (e) => {
    const rangs = cl.filter((x) => x.j.equipe === e).map((x) => x.rang);
    return [rangs.reduce((t, rg) => t + rg, 0), Math.min(...rangs)];
  });
  const lignes: LigneClassement[] = cl.map(({ c, j, rang }) => ({
    id: j.id,
    pseudo: j.pseudo,
    equipe: j.equipe,
    rang,
    texte: j.absent
      ? "a abandonné"
      : c.fin >= 0
        ? formaterChrono(c.fin)
        : `non arrivé · ${Math.round((c.z / (LONGUEUR_TOUR * TOURS)) * 100)} %`,
  }));
  return {
    vainqueur,
    titre: vainqueur === null ? "Égalité !" : `Victoire de ${nomEquipe(s.joueurs, vainqueur)}`,
    lignes,
  };
}

/* ═════════════════════════ RENDU : l'arène néon ═════════════════════════ */

const HORIZON = 176;
const LIGNES = H - HORIZON;
/** Demi-largeur de la route (px) au bas de l'écran. */
const BAS = 330;
/** Profondeur maximale dessinée (1 = au pied de la voiture) et mètres par unité de profondeur. */
const PORTEE = 80;
const ECH = 14;
/** Intensité visuelle des virages. */
const KAPPA = 5e-5;
const BANDE = 12;
const NEONS = ["#19e6ff", "#ff2fb4", "#9b5cff", "#ffe14d"] as const;
const L_CIEL = L * 2;

type Ligne = {
  y: number;
  t: number;
  hw: number;
  cx: number;
  bande: number;
  zl: number;
  fork: Fork | null;
};

/** Projette la route devant la voiture : pour chaque ligne de l'écran, sa largeur, son centre et sa bande. */
function calculerLignes(me: Voiture): { lignes: Ligne[]; parY: Array<Ligne | undefined> } {
  const lignes: Ligne[] = [];
  const parY: Array<Ligne | undefined> = [];
  let pente = 0;
  let decal = 0;
  let zPrec = 0;
  for (let y = H - 1; y > HORIZON; y--) {
    const t = (y - HORIZON) / LIGNES;
    if (t < 1 / PORTEE) break;
    const dz = (1 / t - 1) * ECH;
    const pasZ = dz - zPrec;
    zPrec = dz;
    const zw = me.z + dz;
    pente += courbure(zw) * pasZ * KAPPA;
    decal += pente * pasZ;
    const hw = BAS * t;
    const l: Ligne = {
      y,
      t,
      hw,
      cx: L / 2 - me.x * hw + decal * hw,
      bande: Math.floor(zw / BANDE),
      zl: modBoucle(zw),
      fork: forkA(zw),
    };
    lignes.push(l);
    parY[y] = l;
  }
  return { lignes, parY };
}

/** Ligne de l'écran où se projette un point situé `dz` mètres devant la caméra. */
const rowDe = (dz: number): number => HORIZON + LIGNES / (1 + dz / ECH);

/** Ciel nocturne, étoiles, enceinte lointaine à gradins et projecteurs (couche en cache, défile avec les virages). */
function dessinerCiel(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, "#060612");
  g.addColorStop(0.55, "#1c1040");
  g.addColorStop(0.88, "#5a1c66");
  g.addColorStop(1, "#c0337a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L_CIEL, HORIZON + 2);
  for (let i = 0; i < 120; i++)
    r(
      ctx,
      hash(i) * L_CIEL,
      hash(i + 300) * (HORIZON - 80),
      i % 7 === 0 ? 2 : 1,
      i % 7 === 0 ? 2 : 1,
      i % 5 === 0 ? "#ffffff" : "#b9a7e8",
    );
  // Gratte-ciels derrière l'arène
  for (let k = 0; k < 32; k++) {
    const h = 24 + hash(k * 7) * 52;
    const x = k * 50 + hash(k) * 10;
    r(ctx, x, HORIZON - 56 - h, 38, h, "#150f30");
    for (let rr = 0; rr < h / 11; rr++)
      for (let cc = 0; cc < 3; cc++)
        if (hash(k * 11 + rr * 3 + cc) > 0.55)
          r(ctx, x + 5 + cc * 11, HORIZON - 52 - h + rr * 11, 4, 5, "#ffd98a");
  }
  // Enceinte de l'arène : gradins sombres peuplés
  r(ctx, 0, HORIZON - 58, L_CIEL, 58, "#0b0b18");
  for (let row = 0; row < 3; row++)
    for (let x = 0; x < L_CIEL; x += 9) {
      const k = hash(x * 0.37 + row * 91);
      r(
        ctx,
        x + hash(x + row) * 5,
        HORIZON - 54 + row * 11,
        4,
        5,
        k > 0.66 ? "#ff2fb4" : k > 0.4 ? "#19e6ff" : k > 0.2 ? "#ffe14d" : "#2b2b44",
      );
    }
  r(ctx, 0, HORIZON - 20, L_CIEL, 9, "#04040a");
  for (let x = 0; x < L_CIEL; x += 36)
    r(ctx, x + 2, HORIZON - 18, 30, 5, NEONS[Math.floor(x / 36) % 4]!);
  r(ctx, 0, HORIZON - 10, L_CIEL, 10, "#14142a");
  // Pylônes d'éclairage lointains
  for (const x of [120, 520, 960, 1330]) {
    r(ctx, x - 2, HORIZON - 96, 4, 40, "#2a2a44");
    r(ctx, x - 14, HORIZON - 104, 28, 8, "#1a1a30");
    for (let i = 0; i < 4; i++) r(ctx, x - 12 + i * 7, HORIZON - 102, 5, 4, "#eaf6ff");
  }
}

/** Voiture pixel-art vue de dos : châssis, aileron, roues, feux, reflets néon. (cx, bas) = point au sol sous la voiture. */
function dessinerVoiture(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bas: number,
  larg: number,
  o: { couleur: string; frein?: boolean; flammes?: number; incl?: number; t?: number },
): void {
  if (larg < 5) {
    r(ctx, cx - larg / 2, bas - larg * 0.5, larg, larg * 0.5, o.couleur);
    return;
  }
  const u = larg / 28;
  const fonce = nuanceCouleur(o.couleur, 0.62);
  const clair = nuanceCouleur(o.couleur, 1.35);
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(bas));
  if (o.incl) ctx.rotate(o.incl * 0.035);
  const R = (x: number, y: number, w: number, h: number, c: string) =>
    r(ctx, x * u, y * u, w * u, h * u, c);
  const B = (x: number, y: number, w: number, h: number, c: string) => {
    if (u >= 2) {
      R(x - 0.5, y, w + 1, h, OL);
      R(x, y - 0.5, w, h + 1, OL);
    }
    R(x, y, w, h, c);
  };
  // Lueur néon sous le châssis + ombre
  ombre(ctx, 0, 0.5 * u, 15.5 * u, 2.6 * u, 0.55);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = o.couleur;
  ctx.beginPath();
  ctx.ellipse(0, -0.5 * u, 14 * u, 2 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Pneus
  B(-14.5, -8.5, 5, 8.5, "#12121a");
  B(9.5, -8.5, 5, 8.5, "#12121a");
  R(-13.8, -7.5, 1.2, 6, "#3a3a4c");
  R(10.2, -7.5, 1.2, 6, "#3a3a4c");
  // Bas de caisse + diffuseur
  B(-12.5, -9, 25, 6, fonce);
  R(-9, -3.2, 18, 3, "#15151f");
  R(-8, -1.5, 16, 0.7, o.couleur);
  // Carrosserie
  B(-12, -15.5, 24, 7.5, o.couleur);
  R(-12, -15.5, 24, 1.4, clair);
  R(-12, -10, 24, 1.2, fonce);
  // Habitacle vitré
  B(-8.5, -21.5, 17, 6.2, "#13233a");
  R(-7.5, -20.5, 15, 1.2, "#4a7aa8");
  R(-3, -20.5, 1.5, 4, "#2a4a72");
  R(-8.5, -22, 17, 0.8, clair);
  // Aileron : supports, plan et liseré néon
  R(-8.5, -26, 1.6, 5, "#1a1a26");
  R(6.9, -26, 1.6, 5, "#1a1a26");
  B(-13.5, -27.5, 27, 2.5, "#1c1c2a");
  R(-13.5, -27.5, 27, 0.8, o.couleur);
  // Feux arrière
  const lumiere = o.frein ? "#ff8a8a" : "#e02020";
  R(-11.5, -13.5, 6.5, 2.2, lumiere);
  R(5, -13.5, 6.5, 2.2, lumiere);
  if (o.frein) {
    halo(ctx, -8 * u, -12.5 * u, 6 * u, "#ff3030", 0.8);
    halo(ctx, 8 * u, -12.5 * u, 6 * u, "#ff3030", 0.8);
  }
  // Échappements et flammes
  R(-5, -6, 3, 2.2, "#7a7a88");
  R(2, -6, 3, 2.2, "#7a7a88");
  if ((o.flammes ?? 0) > 0) {
    const f = o.flammes!;
    const fl = (Math.sin((o.t ?? 0) * 60) * 0.5 + 1) * f;
    for (const x of [-3.5, 3.5]) {
      R(x - 1.3, -4 + 0.1, 2.6, 3 + 3 * fl, "#ff8c2a");
      R(x - 0.7, -4 + 0.1, 1.4, 2 + 2.4 * fl, "#fff3a0");
    }
    halo(ctx, 0, -2 * u, 12 * u, f > 1.2 ? "#4fd1c5" : "#ff9f43", 0.55);
  }
  // Plaque
  R(-3, -7, 6, 2, "#eeeef6");
  R(-2.2, -6.5, 4.4, 1, "#2a2a3a");
  ctx.restore();
}

/** Nuance de couleur locale (évite une dépendance circulaire avec la carte). */
function nuanceCouleur(hex: string, f: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(f <= 1 ? v * f : v + (255 - v) * (f - 1)))),
  );
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function plot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  larg: number,
  t: number,
  horloge: number,
): void {
  const w = Math.max(3, larg);
  const h = w * 1.5;
  ombre(ctx, x, y, w * 0.8, w * 0.18, 0.45);
  r(ctx, x - w * 0.55, y - h * 0.12, w * 1.1, h * 0.12, "#1a1a26");
  ctx.fillStyle = "#ff7a1a";
  ctx.beginPath();
  ctx.moveTo(x - w * 0.42, y - h * 0.12);
  ctx.lineTo(x + w * 0.42, y - h * 0.12);
  ctx.lineTo(x + w * 0.08, y - h);
  ctx.lineTo(x - w * 0.08, y - h);
  ctx.fill();
  r(ctx, x - w * 0.3, y - h * 0.5, w * 0.6, Math.max(1, h * 0.16), "#f4f4f8");
  if (Math.sin(horloge * 8 + x) > 0) halo(ctx, x, y - h, w * 0.7 + 4, "#ffe14d", 0.75);
  if (t > 0.05) r(ctx, x - w * 0.07, y - h - w * 0.08, w * 0.14, w * 0.12, "#ffe14d");
}
function blocBeton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  larg: number,
  neon: string,
  hmul = 0.7,
): void {
  const w = Math.max(4, larg);
  const h = w * hmul;
  ombre(ctx, x, y, w * 0.62, w * 0.12, 0.45);
  r(ctx, x - w / 2, y - h, w, h, "#2c2c3a");
  r(ctx, x - w / 2, y - h, w, Math.max(1, h * 0.16), "#555570");
  r(ctx, x - w / 2, y - h * 0.5, w, Math.max(1, h * 0.14), neon);
  r(ctx, x - w / 2, y - h, Math.max(1, w * 0.06), h, "#1b1b26");
  r(ctx, x + w / 2 - Math.max(1, w * 0.06), y - h, Math.max(1, w * 0.06), h, "#1b1b26");
}

function interp(a: Ligne, b: Ligne, f: number, xr: number): { x: number; y: number } {
  const hw = a.hw + (b.hw - a.hw) * f;
  const cx = a.cx + (b.cx - a.cx) * f;
  return { x: cx + xr * hw, y: a.y + (b.y - a.y) * f };
}

/** Flaque d'huile et dalle de boost : posées à plat sur la route. */
function decalPlat(
  ctx: CanvasRenderingContext2D,
  o: Obstacle,
  me: Voiture,
  parY: Array<Ligne | undefined>,
  horloge: number,
): void {
  const brut = modBoucle(o.z - me.z);
  const dz0 = brut > LONGUEUR_TOUR / 2 ? brut - LONGUEUR_TOUR : brut;
  if (dz0 + o.prof < 1 || dz0 > PORTEE * ECH) return;
  const yN = Math.min(H - 1, Math.round(rowDe(Math.max(0.3, dz0))));
  const yF = Math.round(rowDe(dz0 + o.prof));
  const a = parY[yN];
  const b = parY[yF];
  if (!a || !b || a.y <= b.y) return;
  const xl = o.x - o.w / 2;
  const xr = o.x + o.w / 2;
  const p1 = interp(a, b, 0, xl);
  const p2 = interp(a, b, 0, xr);
  const p3 = interp(a, b, 1, xr);
  const p4 = interp(a, b, 1, xl);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();
  if (o.type === "huile") {
    ctx.fillStyle = "#06060c";
    ctx.fill();
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(p1.x, p1.y, p3.x, p3.y);
    g.addColorStop(0, "rgba(155,92,255,0.45)");
    g.addColorStop(0.5, "rgba(25,230,255,0.4)");
    g.addColorStop(1, "rgba(255,47,180,0.4)");
    ctx.fillStyle = g;
    ctx.fillRect(
      Math.min(p1.x, p4.x) - 2,
      p4.y,
      Math.abs(p2.x - p1.x) + Math.abs(p4.x - p1.x) + 40,
      p1.y - p4.y + 2,
    );
    ctx.restore();
  } else {
    ctx.fillStyle = "#06303a";
    ctx.fill();
    ctx.strokeStyle = "#19e6ff";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Chevrons qui défilent vers l'avant
    for (let k = 0; k < 3; k++) {
      const f = ((k / 3 + horloge * 1.6) % 1) * 0.85;
      const lo = interp(a, b, f, 0);
      const ap = interp(a, b, Math.min(1, f + 0.2), 0);
      const lw = interp(a, b, f, -o.w * 0.4);
      const rw = interp(a, b, f, o.w * 0.4);
      ctx.fillStyle = `rgba(120,255,255,${0.45 + 0.4 * (1 - f)})`;
      ctx.beginPath();
      ctx.moveTo(lw.x, lw.y);
      ctx.lineTo(ap.x, ap.y);
      ctx.lineTo(rw.x, rw.y);
      ctx.lineTo(lo.x, lo.y + 2);
      ctx.closePath();
      ctx.fill();
    }
  }
}

type Billboard = { dz: number; dessin: (l: Ligne) => void };

/** Un portique au-dessus de la route : arche de départ ou panneau d'embranchement. */
function portique(
  ctx: CanvasRenderingContext2D,
  l: Ligne,
  genre: "depart" | "fork",
  horloge: number,
): void {
  const { hw, cx, t, y } = l;
  const larg = hw * 1.28;
  const h = 130 * t;
  const ep = Math.max(3, hw * 0.07);
  r(ctx, cx - larg, y - h, ep, h, "#22222e");
  r(ctx, cx + larg - ep, y - h, ep, h, "#22222e");
  const barH = Math.max(6, 30 * t);
  r(ctx, cx - larg - ep, y - h - barH, larg * 2 + ep * 2, barH, "#16161f");
  r(
    ctx,
    cx - larg - ep,
    y - h - barH,
    larg * 2 + ep * 2,
    Math.max(1, barH * 0.12),
    genre === "depart" ? "#19e6ff" : "#ffe14d",
  );
  r(ctx, cx - larg - ep, y - h - 1, larg * 2 + ep * 2, Math.max(1, barH * 0.1), "#ff2fb4");
  const fs = Math.max(6, Math.round(21 * t));
  if (genre === "depart") {
    const n = 14;
    for (let k = 0; k < n; k++)
      for (let m = 0; m < 2; m++)
        r(
          ctx,
          cx - larg + (k * larg * 2) / n,
          y - h - barH + barH * 0.22 + m * barH * 0.28,
          (larg * 2) / n,
          barH * 0.28,
          (k + m) % 2 === 0 ? "#f4f4f8" : "#111118",
        );
  } else {
    r(ctx, cx - larg, y - h - barH * 0.85, larg - ep, barH * 0.7, "#06303a");
    r(ctx, cx + ep, y - h - barH * 0.85, larg - ep, barH * 0.7, "#3a0a2e");
    ctx.save();
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(horloge * 6);
    texte(ctx, "◀ EXTÉRIEUR", cx - larg * 0.5, y - h - barH * 0.5, fs, "#19e6ff");
    texte(ctx, "INTÉRIEUR ▶", cx + larg * 0.5, y - h - barH * 0.5, fs, "#ff2fb4");
    ctx.restore();
  }
}

/** Gradins d'un côté de la route pour une bande : mur à liseré néon, 3 niveaux, public animé. */
function tribune(
  ctx: CanvasRenderingContext2D,
  yBas: number,
  l: Ligne,
  cote: 1 | -1,
  fx: Effets,
  voitures: readonly Voiture[],
): void {
  const { hw, cx, t, bande } = l;
  const xin = cx + cote * hw * 1.32;
  const e = Math.max(2, hw * 0.1);
  const hMur = Math.max(3, 60 * t);
  const x0 = cote > 0 ? xin : xin - e;
  r(ctx, x0, yBas - hMur, e, hMur, "#1c1c29");
  const pulse = 0.65 + 0.35 * Math.sin(fx.horloge * 4 + bande * 0.8);
  ctx.globalAlpha = pulse;
  r(ctx, x0, yBas - hMur * 0.58, e, Math.max(1, hMur * 0.16), NEONS[(bande >> 1) % 4]!);
  ctx.globalAlpha = 1;
  r(ctx, x0, yBas - hMur, e, Math.max(1, hMur * 0.09), "#42425c");
  const larg = hw * 0.8;
  const zBande = bande * BANDE;
  const excite = voitures.some((c) => Math.abs(modBoucle(c.z) - modBoucle(zBande)) < 50 && c.v > 4);
  for (let k = 0; k < 3; k++) {
    const hT = hMur * 0.95;
    const yT = yBas - hMur - (k + 1) * hT;
    const xs = cote > 0 ? xin + e + k * hw * 0.09 : xin - e - larg - k * hw * 0.09;
    r(ctx, xs, yT, larg, hT, k % 2 ? "#252537" : "#2c2c42");
    r(ctx, xs, yT, larg, Math.max(1, hT * 0.1), "#4b4b68");
    const taille = Math.max(2, 8 * t);
    for (let m = 0; m < (fx.lent ? 0 : 3); m++) {
      const idx = bande * 17 + k * 5 + m + (cote > 0 ? 100 : 0);
      const sx = xs + larg * (0.1 + (0.8 * (m + hash(idx))) / 3);
      const bob =
        Math.sin(fx.horloge * (excite ? 11 : 2) + idx) * (excite ? taille * 0.7 : taille * 0.12);
      const sy = yT + hT - taille * 1.9 - Math.abs(bob);
      const chemise = ["#ff2fb4", "#19e6ff", "#ffe14d", "#9b5cff", "#f4f4f8"][
        Math.floor(hash(idx * 3) * 5)
      ]!;
      r(ctx, sx, sy + taille * 0.8, taille, taille * 1.05, chemise);
      r(
        ctx,
        sx + taille * 0.12,
        sy,
        taille * 0.76,
        taille * 0.8,
        ["#f6d5b8", "#c98d5f", "#9a6440"][Math.floor(hash(idx * 5) * 3)]!,
      );
      if (excite && taille > 3) {
        r(ctx, sx - taille * 0.25, sy - taille * 0.7, Math.max(1, taille * 0.25), taille, chemise);
        r(ctx, sx + taille * 1.0, sy - taille * 0.7, Math.max(1, taille * 0.25), taille, chemise);
      }
    }
  }
  // Pylône d'éclairage toutes les 6 bandes
  if (bande % 6 === 0) {
    const px = cote > 0 ? xin + e + larg * 0.95 : xin - e - larg * 0.95;
    const top = yBas - 175 * t;
    r(ctx, px - Math.max(1, 2 * t), top, Math.max(2, 4 * t), yBas - top, "#2c2c40");
    r(ctx, px - 9 * t - 2, top - 6 * t, 18 * t + 4, Math.max(2, 7 * t), "#1a1a28");
    if (!fx.lent) halo(ctx, px, top, 38 * t + 8, "#bfe9ff", 0.55);
    ctx.fillStyle = "rgba(190,230,255,0.05)";
    ctx.beginPath();
    ctx.moveTo(px - 3, top);
    ctx.lineTo(px + 3, top);
    ctx.lineTo(cx + hw * 0.6, yBas);
    ctx.lineTo(cx - hw * 0.6, yBas);
    ctx.fill();
  }
}

function evenements(s: EtatCourse, moi: string, fx: Effets): void {
  for (const e of fx.nouveaux(s.ev)) {
    if (e.qui !== moi) continue;
    switch (e.k) {
      case "choc":
        fx.gerbe(L / 2 + (Math.random() - 0.5) * 120, H - 44, (e.v ?? 1) > 1 ? 22 : 12, {
          couleur: ["#ffffff", "#ffd166", "#ff8c2a"],
          vitesse: 260,
          vie: 0.45,
          taille: 4,
          lueur: true,
          grav: 420,
          angle: -Math.PI / 2,
          ouverture: 2.4,
        });
        fx.secouer((e.v ?? 1) > 1 ? 8 : 4);
        fx.popup(L / 2, 262, "RALENTI", "#ff8c42", 20);
        break;
      case "huile":
        fx.popup(L / 2, 262, "DÉRAPAGE !", "#c084fc", 22);
        fx.secouer(2);
        break;
      case "boost":
        fx.popup(L / 2, 250, "BOOST", "#19e6ff", 30);
        fx.flash = 0.35;
        break;
      case "tour":
        fx.popup(
          L / 2,
          230,
          (e.v ?? 0) > TOURS ? "ARRIVÉE !" : `TOUR ${e.v}/${TOURS}`,
          "#ffe14d",
          34,
        );
        fx.excitation = 1;
        break;
      default:
        break;
    }
  }
}

function dessiner(ctx: CanvasRenderingContext2D, base: EtatBase, moi: string, fx: Effets): void {
  const s = base as EtatCourse;
  const idxMoi = Math.max(
    0,
    s.joueurs.findIndex((j) => j.id === moi),
  );
  const me = s.v[idxMoi];
  if (!me) return;
  const moiJ = s.joueurs[idxMoi]!;
  evenements(s, moi, fx);

  // Balancement de la caméra : elle penche dans les virages et vibre avec la vitesse.
  const vit = Math.max(0, me.v) / VMAX;
  const cibleX = -me.dir * 5 - courbure(me.z + 25) * 6 * vit;
  fx.cam.x += (cibleX - fx.cam.x) * Math.min(1, fx.dt * 6);
  fx.cam.y = Math.sin(fx.horloge * 19) * 1.3 * vit + (me.boost > 0 ? 2 : 0);

  fx.debut(ctx);
  ctx.translate(Math.round(fx.cam.x), Math.round(fx.cam.y));

  // Ciel et enceinte lointaine, qui défilent avec les virages
  const scroll = (((cap(me.z) * 0.9 - me.x * 14) % L_CIEL) + L_CIEL) % L_CIEL;
  const dessinerCielDecale = (dx: number) => {
    if (!decorEnCache("course-ciel", L_CIEL, HORIZON + 2, dessinerCiel, ctx, dx, 0)) {
      ctx.save();
      ctx.translate(dx, 0);
      dessinerCiel(ctx);
      ctx.restore();
    }
  };
  dessinerCielDecale(-scroll);
  dessinerCielDecale(L_CIEL - scroll);
  // Projecteurs qui balaient le ciel
  for (let k = 0; k < 3; k++) {
    const a = Math.sin(fx.horloge * 0.7 + k * 2.1) * 0.5;
    const bx = 160 + k * 240;
    ctx.fillStyle = `rgba(${k % 2 ? "255,47,180" : "25,230,255"},0.07)`;
    ctx.beginPath();
    ctx.moveTo(bx - 4, HORIZON - 40);
    ctx.lineTo(bx + 4, HORIZON - 40);
    ctx.lineTo(bx + 4 + Math.tan(a) * 150 + 50, 0);
    ctx.lineTo(bx - 4 + Math.tan(a) * 150 - 50, 0);
    ctx.fill();
  }

  const { lignes, parY } = calculerLignes(me);

  // La route, ligne par ligne, du lointain vers le proche
  for (let k = lignes.length - 1; k >= 0; k--) {
    const l = lignes[k]!;
    const { y, hw, cx, bande, fork, zl } = l;
    const pair = bande % 2 === 0;
    r(ctx, 0, y, L, 1, pair ? "#0f0f19" : "#12121d");
    r(ctx, cx - hw, y, hw * 2, 1, pair ? "#2a2a37" : "#303040");
    // Vibreurs bicolores néon, qui défilent
    r(ctx, cx - hw * 1.1, y, hw * 0.1, 1, pair ? NEONS[0] : NEONS[1]);
    r(ctx, cx + hw, y, hw * 0.1, 1, pair ? NEONS[1] : NEONS[0]);
    const rive = Math.max(1, hw * 0.022);
    r(ctx, cx - hw * 0.97, y, rive, 1, "#e8e8f4");
    r(ctx, cx + hw * 0.95, y, rive, 1, "#e8e8f4");
    if (fork) {
      const m = hw * MURET;
      r(ctx, cx - m, y, m * 2, 1, pair ? "#0b0b13" : "#141420");
      r(ctx, cx - m - rive, y, rive, 1, "#19e6ff");
      r(ctx, cx + m, y, rive, 1, "#19e6ff");
      // Voie intérieure plus étroite : au-delà de la limite, zone dangereuse
      r(
        ctx,
        cx + hw * LIMITE_INTERIEURE,
        y,
        hw * (1 - LIMITE_INTERIEURE),
        1,
        pair ? "#d9a300" : "#17171f",
      );
      r(ctx, cx + hw * LIMITE_INTERIEURE - rive, y, rive * 1.5, 1, "#ff2fb4");
    } else if (bande % 4 < 2) r(ctx, cx - hw * 0.012, y, Math.max(1, hw * 0.024), 1, "#e8e8f4");
    // Ligne de départ / arrivée en damier lumineux
    if (zl < 6)
      for (let q = 0; q < 12; q++)
        r(
          ctx,
          cx - hw + (q * hw * 2) / 12,
          y,
          (hw * 2) / 12 + 1,
          1,
          (q + Math.floor(zl * 1.3)) % 2 === 0 ? "#f6f6ff" : "#101018",
        );
  }

  // Flaques d'huile et dalles de boost (à plat)
  for (const o of OBSTACLES)
    if (o.type === "huile" || o.type === "boost") decalPlat(ctx, o, me, parY, fx.horloge);

  // Gradins et murs, bande par bande, du lointain vers le proche
  type Groupe = { bande: number; yBas: number; yHaut: number };
  const groupes: Groupe[] = [];
  for (const l of lignes) {
    const g = groupes[groupes.length - 1];
    if (g && g.bande === l.bande) g.yHaut = l.y;
    else groupes.push({ bande: l.bande, yBas: l.y, yHaut: l.y });
  }
  for (let k = groupes.length - 1; k >= 0; k--) {
    const g = groupes[k]!;
    const milieu = parY[Math.round((g.yBas + g.yHaut) / 2)];
    if (!milieu) continue;
    tribune(ctx, g.yBas, milieu, -1, fx, s.v);
    tribune(ctx, g.yBas, milieu, 1, fx, s.v);
  }

  // Objets debout (voitures, plots, blocs, muret, panneaux), du lointain vers le proche
  const bb: Billboard[] = [];
  const loin = PORTEE * ECH;
  s.v.forEach((c, i) => {
    if (c.id === me.id) return;
    const dz = c.z - me.z;
    if (dz < 1.5 || dz > loin) return;
    const j = s.joueurs[i]!;
    const allie = j.equipe === moiJ.equipe;
    bb.push({
      dz,
      dessin: (l) => {
        const px = l.cx + c.x * l.hw;
        const larg = l.hw * 0.5;
        dessinerVoiture(ctx, px, l.y, larg, {
          couleur: j.couleur,
          frein: c.frein,
          flammes: c.nitro > 0 || c.boost > 0 ? 1.4 : 0.5,
          incl: c.dir,
          t: fx.horloge,
        });
        if (larg > 14) {
          ctx.fillStyle = COULEUR_EQUIPE[j.equipe];
          ctx.beginPath();
          ctx.moveTo(px, l.y - larg * 1.2);
          ctx.lineTo(px - larg * 0.12, l.y - larg * 1.2 - larg * 0.16);
          ctx.lineTo(px + larg * 0.12, l.y - larg * 1.2 - larg * 0.16);
          ctx.fill();
          texte(
            ctx,
            (allie ? "♦ " : "") + j.pseudo.slice(0, 8),
            px,
            l.y - larg * 1.2 - larg * 0.34,
            Math.max(8, Math.min(13, larg * 0.28)),
            COULEUR_EQUIPE[j.equipe],
          );
        }
      },
    });
  });
  for (const o of OBSTACLES) {
    if (o.type === "huile" || o.type === "boost") continue;
    const dz = modBoucle(o.z - me.z);
    if (dz < 1.5 || dz > loin) continue;
    bb.push({
      dz,
      dessin: (l) => {
        const px = l.cx + o.x * l.hw;
        if (o.type === "plot") plot(ctx, px, l.y, l.hw * 0.13, l.t, fx.horloge);
        else blocBeton(ctx, px, l.y, l.hw * o.w, "#ff2fb4");
      },
    });
  }
  for (const f of FORKS) {
    // Muret central et limite de la voie intérieure
    for (let z = f.debut; z <= f.fin; z += 10) {
      const dz = modBoucle(z - me.z);
      if (dz < 1.5 || dz > loin) continue;
      bb.push({ dz, dessin: (l) => blocBeton(ctx, l.cx, l.y, l.hw * MURET * 2.4, "#19e6ff", 0.9) });
    }
    for (let z = f.debut; z <= f.fin; z += 18) {
      const dz = modBoucle(z - me.z);
      if (dz < 1.5 || dz > loin) continue;
      bb.push({
        dz,
        dessin: (l) => {
          const px = l.cx + (LIMITE_INTERIEURE + 0.05) * l.hw;
          r(
            ctx,
            px - Math.max(1, l.hw * 0.01),
            l.y - 36 * l.t,
            Math.max(2, l.hw * 0.02),
            36 * l.t,
            "#1c1c29",
          );
          halo(ctx, px, l.y - 36 * l.t, 14 * l.t + 3, "#ff2fb4", 0.7);
        },
      });
    }
    const dzp = modBoucle(f.debut - 70 - me.z);
    if (dzp > 1.5 && dzp < loin)
      bb.push({ dz: dzp, dessin: (l) => portique(ctx, l, "fork", fx.horloge) });
  }
  const dzd = modBoucle(0 - me.z);
  if (dzd > 1.5 && dzd < loin)
    bb.push({ dz: dzd, dessin: (l) => portique(ctx, l, "depart", fx.horloge) });
  bb.sort((a, b) => b.dz - a.dz);
  for (const b of bb) {
    const y = Math.round(rowDe(b.dz));
    const l = parY[y];
    if (l) b.dessin(l);
  }

  // Poussière, fumée et flammes de ma voiture
  const hors = Math.abs(me.x) > 1.02 && me.v > 8;
  if (hors && Math.random() < 0.8)
    fx.particule({
      x: L / 2 + (Math.random() - 0.5) * 150,
      y: H - 20,
      vx: (Math.random() - 0.5) * 60,
      vy: -30 - Math.random() * 40,
      vie: 0.5,
      taille: 6,
      couleur: "#8a7a62",
      grav: 20,
    });
  if (me.glisse > 0 && Math.random() < 0.7)
    fx.particule({
      x: L / 2 + (Math.random() - 0.5) * 120,
      y: H - 24,
      vx: (Math.random() - 0.5) * 80,
      vy: -20,
      vie: 0.5,
      taille: 6,
      couleur: Math.random() < 0.5 ? "#9b5cff" : "#19e6ff",
      lueur: true,
    });
  if ((me.nitro > 0 || me.boost > 0) && Math.random() < 0.9)
    fx.particule({
      x: L / 2 + (Math.random() < 0.5 ? -22 : 22),
      y: H - 18,
      vx: (Math.random() - 0.5) * 30,
      vy: 70 + Math.random() * 60,
      vie: 0.3,
      taille: 5,
      couleur: "#4fd1c5",
      lueur: true,
    });

  // Lignes de vitesse pendant un turbo ou un boost
  if ((me.nitro > 0 || me.boost > 0) && me.v > 20) {
    ctx.strokeStyle = "rgba(190,250,255,0.35)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + fx.horloge * 0.3;
      const d1 = 90 + ((fx.horloge * 700 + k * 53) % 260);
      ctx.beginPath();
      ctx.moveTo(L / 2 + Math.cos(a) * d1, HORIZON + 40 + Math.sin(a) * d1 * 0.6);
      ctx.lineTo(L / 2 + Math.cos(a) * (d1 + 70), HORIZON + 40 + Math.sin(a) * (d1 + 70) * 0.6);
      ctx.stroke();
    }
  }

  // Ma voiture, vue de derrière
  const secousse = hors ? Math.sin(s.t * 60) * 3 : 0;
  const flam = me.boost > 0 || me.nitro > 0 ? 2 : me.v > 6 && !me.frein ? 0.6 : 0;
  dessinerVoiture(ctx, L / 2 + secousse, H - 12, 176, {
    couleur: moiJ.couleur,
    frein: me.frein,
    flammes: flam,
    incl: me.dir * 1.6 + (me.glisse > 0 ? Math.sin(fx.horloge * 14) * 2 : 0),
    t: fx.horloge,
  });

  fx.dessinerParticules(ctx);
  fx.dessinerPopups(ctx);
  fx.fin(ctx);
  fx.dessinerFlash(ctx, L, H);

  // Tableau de bord
  const classement = classer(s);
  const place = classement.find((x) => x.c.id === me.id)?.rang ?? 1;
  const tour = Math.min(TOURS, Math.floor(me.z / LONGUEUR_TOUR) + 1);
  panneau(ctx, 8, 8, 160, 76, COULEUR_EQUIPE[moiJ.equipe]);
  texte(ctx, `${place}/${s.v.length}`, 20, 28, 26, "#ffd166", "left");
  texte(ctx, `TOUR ${tour}/${TOURS}`, 20, 52, 13, "#fff", "left");
  texte(ctx, formaterChrono(me.fin >= 0 ? me.fin : s.t), 20, 70, 13, "#cfe", "left");
  panneau(ctx, L - 178, 8, 170, 60, "#19e6ff");
  texte(ctx, `${Math.round(Math.max(0, me.v) * 3.6)} km/h`, L - 20, 26, 22, "#19e6ff", "right");
  const k =
    me.boost > 0
      ? me.boost / 1.5
      : me.nitro > 0
        ? me.nitro / NITRO_DUREE
        : 1 - me.nitroCd / NITRO_RECHARGE;
  const actif = me.boost > 0 || me.nitro > 0;
  r(ctx, L - 168, 40, 150, 8, "#101018");
  r(ctx, L - 168, 40, 150 * k, 8, actif ? "#ffe14d" : k >= 1 ? "#19e6ff" : "#556");
  texte(
    ctx,
    me.boost > 0 ? "BOOST !" : me.nitro > 0 ? "TURBO !" : k >= 1 ? "TURBO PRÊT" : "TURBO…",
    L - 93,
    58,
    10,
    "#fff",
  );
  // Progression de la course : tous les pilotes sur une barre
  panneau(ctx, L / 2 - 150, 36, 300, 14, "#ff2fb4");
  for (let q = 1; q < TOURS; q++) r(ctx, L / 2 - 148 + (296 * q) / TOURS, 39, 2, 8, "#667");
  s.v.forEach((c, i) => {
    const p = Math.min(1, c.z / (LONGUEUR_TOUR * TOURS));
    const moi2 = c.id === me.id;
    r(
      ctx,
      L / 2 - 148 + 292 * p - (moi2 ? 3 : 2),
      40 - (moi2 ? 1 : 0),
      moi2 ? 7 : 5,
      moi2 ? 9 : 7,
      COULEUR_EQUIPE[s.joueurs[i]!.equipe],
    );
  });
  panneau(ctx, 8, 92, 152, 8 + Math.min(4, classement.length) * 16, "#667");
  classement.slice(0, 4).forEach((x, q) => {
    r(ctx, 14, 98 + q * 16, 5, 11, COULEUR_EQUIPE[x.j.equipe]);
    texte(
      ctx,
      `${x.rang}. ${x.j.pseudo.slice(0, 8)}${x.c.fin >= 0 ? " ✓" : ""}`,
      24,
      104 + q * 16,
      11,
      x.c.id === me.id ? "#ffd166" : "#fff",
      "left",
    );
  });
  if (me.fin >= 0 && s.phase === "jeu")
    texte(ctx, `ARRIVÉ ! ${formaterChrono(me.fin)}`, L / 2, 150, 34, "#ffd166");
  dessinerHud(ctx, s, L, H);
}

export const course: Jeu = {
  id: "course",
  nom: "Course de véhicules",
  icone: "🏎️",
  description:
    "3 tours d'un circuit néon à embranchements, vue derrière la voiture. Le meilleur temps gagne (3 min 30 max).",
  aide: ["Z / ↑ : accélérer", "S / ↓ : freiner", "Q D / ← → : tourner", "Espace : turbo"],
  boutons: { a: "Turbo", haut: "Gaz", bas: "Frein" },
  largeur: L,
  hauteur: H,
  creer,
  pas,
  termine,
  finir,
  dessiner,
};
