import { borne, dessinerHud, emettre, formaterChrono, meilleureEquipe } from "../moteur";
import type { Effets } from "../fx";
import { decorEnCache, halo, hash, ombre, OL, panneau, r, texte } from "../rendu/pixel";
import { glyphes } from "../rendu/dojo";
import { creerCamera, dessinerScene } from "../rendu/course3d";
import { dessinerFouleFond } from "../rendu/foule";
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
  profilCamera,
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
 * Mini-jeu : course de véhicules en vue joueur (caméra reculée derrière la voiture, route en perspective)
 * dans une immense arène néon à touche urbaine. 3 tours d'un circuit sinueux avec 3 embranchements,
 * obstacles, flaques d'huile et dalles de boost. Classement au temps ; les non-arrivés sont classés à la distance.
 */

export const L = 800;
export const H = 480;
/** Chronomètre rallongé pour permettre la boucle de 3 tours dans l'arène. */
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

/* ═════════════════════════ RENDU : l'arène néon urbaine ═════════════════════════ */

const HORIZON_BASE = 164;
/** Ligne d'horizon courante : elle monte et descend avec le relief du circuit (changements de caméra). */
let HORIZON = HORIZON_BASE;
let LIGNES = H - HORIZON;
/** Demi-largeur de la route (px) au bas de l'écran. */
const BAS = 340;
/** Recul de la caméra derrière le véhicule du joueur (m) pour une meilleure anticipation. */
const CAM_RECUL = 4.5;
/** Profondeur maximale dessinée et mètres par unité de profondeur. */
const PORTEE = 90;
const ECH = 16;
/** Intensité visuelle des virages (courbes franches et S visibles jusqu'à l'horizon). */
const KAPPA = 3.8e-4;
const BANDE = 12;
const NEONS = ["#19e6ff", "#ff2fb4", "#9b5cff", "#ffe14d"] as const;
const L_CIEL = L * 2;

const posMod = (n: number, m: number) => ((n % m) + m) % m;

type Ligne = {
  y: number;
  t: number;
  hw: number;
  cx: number;
  bande: number;
  zl: number;
  fork: Fork | null;
  courbe: number;
};

/** Projette la route devant la caméra (`camZ`, `camX`) : pour chaque ligne de l'écran, largeur, centre et bande. */
function calculerLignes(
  camZ: number,
  camX: number,
): { lignes: Ligne[]; parY: Array<Ligne | undefined> } {
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
    const zw = camZ + dz;
    const c = courbure(zw);
    pente += c * pasZ * KAPPA;
    decal += pente * pasZ;
    const hw = BAS * t;
    const l: Ligne = {
      y,
      t,
      hw,
      cx: L / 2 - camX * hw + decal * hw,
      bande: Math.floor(zw / BANDE),
      zl: modBoucle(zw),
      fork: forkA(zw),
      courbe: c,
    };
    lignes.push(l);
    parY[y] = l;
  }
  return { lignes, parY };
}

/** Ligne de l'écran où se projette un point situé `dz` mètres devant la caméra. */
const rowDe = (dz: number): number => HORIZON + LIGNES / (1 + dz / ECH);

/* ───── Illustration de fond (image fournie par le projet, public/arcade/course-fond.png) ───── */
let FOND: HTMLImageElement | null = null;
function fondPret(): HTMLImageElement | null {
  if (FOND === null && typeof Image !== "undefined") {
    FOND = new Image();
    FOND.src = "/arcade/course-fond.png";
  }
  return FOND && FOND.complete && FOND.naturalWidth > 0 ? FOND : null;
}

let SPRITE_VOITURE: HTMLImageElement | null = null;
function spriteVoiturePret(): HTMLImageElement | null {
  if (SPRITE_VOITURE === null && typeof Image !== "undefined") {
    SPRITE_VOITURE = new Image();
    SPRITE_VOITURE.src = "/arcade/voiture-joueur.png";
  }
  return SPRITE_VOITURE && SPRITE_VOITURE.complete && SPRITE_VOITURE.naturalWidth > 0 ? SPRITE_VOITURE : null;
}

/** Dessine l'illustration en plein cadre (cover) derrière la piste ; renvoie false si elle n'est pas chargée. */
function dessinerFondIllustre(ctx: CanvasRenderingContext2D, defil: number): boolean {
  const img = fondPret();
  if (!img) return false;
  const ratio = Math.max(L / img.naturalWidth, (HORIZON + 40) / img.naturalHeight);
  const w = img.naturalWidth * ratio;
  const h = img.naturalHeight * ratio;
  const dx = -((defil / L_CIEL) * (w - L)) % Math.max(1, w - L);
  ctx.drawImage(img, dx, HORIZON + 40 - h, w, h);
  return true;
}

/** Ciel nocturne, skyline urbaine, enceinte d'arène à gradins et projecteurs (couche en cache). */
function dessinerCiel(ctx: CanvasRenderingContext2D): void {
  // Voûte de l'arène fermée : noir profond, reflets violets près des gradins
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, "#020208");
  g.addColorStop(0.55, "#0b0a24");
  g.addColorStop(1, "#2a1250");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L_CIEL, HORIZON + 2);
  // Charpente métallique : poutres, croisillons et projecteurs
  ctx.strokeStyle = "#1c2040";
  ctx.lineWidth = 2;
  for (const y of [8, 30]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(L_CIEL, y);
    ctx.stroke();
  }
  for (let x = 0; x < L_CIEL; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x + 18, 30);
    ctx.lineTo(x + 36, 8);
    ctx.stroke();
  }
  for (let x = 20; x < L_CIEL; x += 120) r(ctx, x, 30, 6, 3, hash(x) > 0.5 ? "#eaf6ff" : "#ffd98a");
  // Piste suspendue au loin : rubans néon en spirale
  ctx.save();
  ctx.lineCap = "round";
  for (const cx of [L_CIEL * 0.25, L_CIEL * 0.75]) {
    for (let i = 0; i < 6; i++) {
      const col = i % 2 === 0 ? "#19e6ff" : "#ff3fb4";
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3 - i * 0.2;
      ctx.beginPath();
      ctx.ellipse(cx, 96 - i * 9, 150 - i * 15, 16 - i * 1.5, 0, Math.PI * 1.02, Math.PI * 2.02);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#171b3a";
    for (let k = -2; k <= 2; k++) ctx.fillRect(cx + k * 55 - 1, 100, 3, 40);
  }
  ctx.restore();
  // Écrans géants et enseignes néon cyan / magenta autour de l'arène
  for (let k = 0; k < 8; k++) {
    const x = 30 + k * 200 + hash(k) * 30;
    const rose = k % 3 === 1;
    const col = rose ? "#ff3fb4" : "#19e6ff";
    const w = 96 + hash(k + 40) * 60;
    const h = 44 + hash(k + 60) * 24;
    ctx.save();
    ctx.fillStyle = rose ? "#2a0a2a" : "#06303f";
    ctx.fillRect(x, 40, w, h);
    ctx.shadowColor = col;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, 41.5, w - 3, h - 3);
    ctx.restore();
    if (k % 2 === 0) {
      // Écran avec foule en liesse
      for (let i = 0; i < 34; i++) {
        const px = x + 6 + hash(k * 50 + i) * (w - 14);
        const py = 56 + hash(k * 70 + i) * (h - 26);
        r(ctx, px, py, 3, 4, ["#f6d5b8", "#c98d5f", "#ff3fb4", "#19e6ff"][i % 4]!);
        if (i % 3 === 0) r(ctx, px - 1, py - 4, 1, 4, "#ffe14d");
      }
    } else glyphes(ctx, x + 6, 48, w - 12, h - 14, rose ? "#ff9ad5" : "#bff6ff", k * 31 + 5);
  }
  // Public en pixel-art sur les gradins de fond
  dessinerFouleFond(ctx, L_CIEL, HORIZON_BASE - 4);
  // Panneaux étroits en kana lumineux
  for (let k = 0; k < 6; k++) {
    const x = 130 + k * 270 + hash(k + 9) * 40;
    ctx.save();
    ctx.fillStyle = "#16061f";
    ctx.fillRect(x, 98, 36, 12);
    ctx.shadowColor = "#ff3fb4";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#ff3fb4";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, 98.5, 35, 11);
    ctx.restore();
  }
  // Enceinte de l'arène : gradins + mur d'enceinte urbain
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
  r(ctx, 0, HORIZON - 10, L_CIEL, 10, "#1c1d2e");
  for (let x = 0; x < L_CIEL; x += 18) r(ctx, x, HORIZON - 9, 1, 9, "#2d2f45");
  // Pylônes d'éclairage d'arène
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
  const noir = "#0d0d14";
  const caisse = nuanceCouleur(o.couleur, 0.3);
  const caisse2 = nuanceCouleur(o.couleur, 0.5);
  const clair = nuanceCouleur(o.couleur, 1.5);
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
  // Ombre portée au sol + néon bleu sous le châssis
  ombre(ctx, 0, 0.6 * u, 17 * u, 3 * u, 0.6);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = o.couleur;
  ctx.beginPath();
  ctx.ellipse(0, -0.6 * u, 14.5 * u, 2.4 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  halo(ctx, 0, -1 * u, 12 * u, o.couleur, 0.35);
  // Pneus larges et jantes
  B(-15, -8, 5, 8, "#0a0a10");
  B(10, -8, 5, 8, "#0a0a10");
  R(-14.2, -6.8, 1.3, 4.6, "#6b6b84");
  R(10.9, -6.8, 1.3, 4.6, "#6b6b84");
  // Bas de caisse, diffuseur et échappements
  B(-13, -8.5, 26, 5, noir);
  for (let i = -5; i <= 5; i += 2.5) R(i, -4, 0.8, 3.6, "#1d1d2a");
  R(-12, -3.6, 24, 0.8, o.couleur);
  // Caisse très large et basse
  B(-14, -13.5, 28, 6, caisse);
  R(-14, -13.5, 28, 1, clair);
  R(-14, -8.8, 28, 0.9, noir);
  // Barre de feux arrière sur toute la largeur + deux optiques rondes
  const lum = o.frein ? "#ff9a9a" : "#ff2a2a";
  R(-13, -12.2, 26, 1.6, "#4a0508");
  R(-13, -12.2, 11, 1.6, lum);
  R(2, -12.2, 11, 1.6, lum);
  R(-13, -10.2, 4.5, 1.8, lum);
  R(8.5, -10.2, 4.5, 1.8, lum);
  if (o.frein) {
    halo(ctx, -8 * u, -11.5 * u, 9 * u, "#ff2020", 0.85);
    halo(ctx, 8 * u, -11.5 * u, 9 * u, "#ff2020", 0.85);
  } else {
    halo(ctx, -7 * u, -11.5 * u, 7 * u, "#ff2020", 0.5);
    halo(ctx, 7 * u, -11.5 * u, 7 * u, "#ff2020", 0.5);
  }
  // Coffre, aileron en queue de canard et habitacle bas à lunette inclinée
  B(-11.5, -16, 23, 2.7, caisse2);
  R(-11.5, -16, 23, 0.7, clair);
  B(-13, -19, 26, 1.9, "#0b0b12");
  R(-13, -19, 26, 0.6, o.couleur);
  R(-13, -20.5, 1.3, 3.2, "#0b0b12");
  R(11.7, -20.5, 1.3, 3.2, "#0b0b12");
  R(-6.5, -17, 1.2, 1.4, "#0b0b12");
  R(5.3, -17, 1.2, 1.4, "#0b0b12");
  B(-8, -22.5, 16, 6.2, "#0e1830");
  R(-7, -21.8, 14, 1, "#5b8ac4");
  R(-1, -21.8, 1.2, 4.4, "#1c3358");
  R(-8, -22.8, 16, 0.8, caisse2);
  // Échappements, flammes bleues
  R(-6.5, -5.8, 3, 2.2, "#8a8aa0");
  R(3.5, -5.8, 3, 2.2, "#8a8aa0");
  const f = o.flammes ?? 0;
  if (f > 0) {
    const fl = (Math.sin((o.t ?? 0) * 60) * 0.5 + 1) * f;
    for (const x of [-5, 5]) {
      R(x - 1.6, -4.2, 3.2, 3 + 3.4 * fl, "#1fa8ff");
      R(x - 0.9, -4.2, 1.8, 2 + 2.6 * fl, "#d6f6ff");
      halo(ctx, x * u, -2 * u, 7 * u, "#19c8ff", 0.65);
    }
  }
  // Plaque
  R(-3, -8, 6, 1.8, "#eeeef6");
  R(-2.2, -7.6, 4.4, 0.9, "#2a2a3a");
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
  camZ: number,
  parY: Array<Ligne | undefined>,
  horloge: number,
): void {
  const brut = modBoucle(o.z - camZ);
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

/** Gradins, barrières urbaines néon, lampadaires et public animé de chaque côté de la piste. */
function tribune(
  ctx: CanvasRenderingContext2D,
  yBas: number,
  yHaut: number,
  l: Ligne,
  cote: 1 | -1,
  fx: Effets,
  voitures: readonly Voiture[],
): void {
  const { hw, cx, t, bande, courbe } = l;
  const xin = cx + cote * hw * 1.15;
  const e = Math.max(2, hw * 0.12);
  const hMur = Math.max(3, 56 * t);
  const x0 = cote > 0 ? xin : xin - e;
  const neon = NEONS[posMod(bande >> 1, 4)]!;
  const pulse = 0.65 + 0.35 * Math.sin(fx.horloge * 4 + bande * 0.8);

  // Mur de béton urbain + barrière métallique à bande lumineuse néon
  r(ctx, x0, yBas - hMur, e, hMur, "#1b1c2a");
  r(ctx, x0, yBas - hMur, e, Math.max(1, hMur * 0.1), "#4a4d6a");
  const hRail = Math.max(2, 24 * t);
  const xr = cx + cote * hw * 1.07;
  const rx = cote > 0 ? xr : xr - Math.max(2, hw * 0.05);
  const rw = Math.max(2, hw * 0.05);
  r(ctx, rx, yBas - hRail, rw, hRail, "#4d5369");
  r(ctx, rx, yBas - hRail * 0.65, rw, Math.max(1, hRail * 0.25), "#8891ad");
  ctx.globalAlpha = pulse;
  r(ctx, rx, yBas - hRail * 0.52, rw, Math.max(1, hRail * 0.14), neon);
  ctx.globalAlpha = 1;

  // 3 niveaux de gradins + public animé
  const xStand = cote > 0 ? xin + e : xin - e;
  const larg = hw * 0.82;
  const zBande = bande * BANDE;
  const excite = voitures.some((c) => Math.abs(modBoucle(c.z) - modBoucle(zBande)) < 50 && c.v > 4);
  for (let k = 0; k < 3; k++) {
    const hT = hMur * 0.92;
    const yT = yBas - hMur - (k + 1) * hT;
    const xs = cote > 0 ? xStand + k * hw * 0.09 : xStand - larg - k * hw * 0.09;
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

  // Panneau fléché néon à l'extérieur des virages serrés (aide à l'anticipation)
  if (
    Math.abs(courbe) >= 0.9 &&
    ((courbe > 0 && cote < 0) || (courbe < 0 && cote > 0)) &&
    posMod(bande, 3) === 0
  ) {
    const px = cote > 0 ? xStand + hw * 0.04 : xStand - hw * 0.34;
    const pw = Math.max(6, hw * 0.3);
    const ph = Math.max(5, 42 * t);
    const py = yBas - hMur - ph;
    r(ctx, px, py, pw, ph, "#121320");
    r(ctx, px, py, pw, Math.max(1, ph * 0.12), "#ffe14d");
    r(ctx, px, py + ph - Math.max(1, ph * 0.12), pw, Math.max(1, ph * 0.12), "#ffe14d");
    if (pw > 10) {
      const clign = Math.sin(fx.horloge * 8 + bande) > -0.3;
      texte(
        ctx,
        courbe > 0 ? "▶▶" : "◀◀",
        px + pw / 2,
        py + ph / 2,
        Math.max(6, Math.round(18 * t)),
        clign ? "#ffe14d" : "#ff2fb4",
      );
    }
  }

  // Lampadaires urbains et grands pylônes d'éclairage
  const mod8 = posMod(bande, 8);
  if (mod8 === 0) {
    const px = cote > 0 ? xStand + larg * 0.95 : xStand - larg * 0.95;
    const top = yBas - 172 * t;
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
  } else if (posMod(bande, 4) === 2) {
    const px = cote > 0 ? xin + e * 0.5 : xin - e * 0.5;
    const top = yBas - 108 * t;
    const bras = -cote * Math.max(3, 18 * t);
    r(ctx, px - Math.max(1, 1.5 * t), top, Math.max(2, 3 * t), yBas - top, "#383e54");
    r(ctx, Math.min(px, px + bras), top, Math.abs(bras), Math.max(2, 3 * t), "#4e5672");
    const lampX = px + bras;
    const col = cote < 0 ? "#19e6ff" : "#ff2fb4";
    r(
      ctx,
      lampX - Math.max(1, 3 * t),
      top + Math.max(1, 2 * t),
      Math.max(3, 6 * t),
      Math.max(2, 3 * t),
      "#fff",
    );
    if (!fx.lent && t > 0.08) halo(ctx, lampX, top + 6 * t, 22 * t + 4, col, 0.42);
  }

  // Petit écran lumineux d'arène
  if (posMod(bande, 12) === 6 && yBas - yHaut >= 2) {
    const ex = cote > 0 ? xStand + larg * 0.2 : xStand - larg * 0.85;
    const ew = Math.max(8, larg * 0.65);
    const eh = Math.max(6, 48 * t);
    const ey = yBas - hMur * 2.4 - eh;
    r(ctx, ex, ey, ew, eh, "#080b18");
    r(ctx, ex, ey, ew, Math.max(1, eh * 0.1), "#19e6ff");
    if (ew > 18)
      texte(
        ctx,
        "ISITECH",
        ex + ew / 2,
        ey + eh / 2,
        Math.max(6, Math.round(11 * t)),
        "#ff2fb4",
      );
  }
}

function evenements(s: EtatCourse, moi: string, fx: Effets): void {
  for (const e of fx.nouveaux(s.ev)) {
    if (e.qui !== moi) continue;
    switch (e.k) {
      case "choc":
        fx.gerbe(L / 2 + (Math.random() - 0.5) * 120, H - 56, (e.v ?? 1) > 1 ? 22 : 12, {
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
        fx.popup(L / 2, 236, "RALENTI", "#ff8c42", 20);
        break;
      case "huile":
        fx.popup(L / 2, 236, "DÉRAPAGE !", "#c084fc", 22);
        fx.secouer(2);
        break;
      case "boost":
        fx.popup(L / 2, 224, "BOOST", "#19e6ff", 30);
        fx.flash = 0.35;
        break;
      case "tour":
        fx.popup(
          L / 2,
          208,
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

const CAM = { horizon: 0, recul: 0, roulis: 0 };

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

  // Caméra 3D reculée et surélevée derrière la voiture ; recul, hauteur et roulis suivent le tronçon
  const vit = Math.max(0, me.v) / VMAX;
  const cible = profilCamera(me.z);
  const kc = Math.min(1, fx.dt * 2.5);
  CAM.horizon += (cible.horizon - CAM.horizon) * kc;
  CAM.recul += (cible.recul - CAM.recul) * kc;
  CAM.roulis += (cible.roulis - CAM.roulis) * Math.min(1, fx.dt * 4);
  const boostCam = me.nitro > 0 || me.boost > 0 ? 1.2 : 0;
  const recul = 11 + boostCam * 2;
  const cam = creerCamera(me.z, me.x, recul, CAM.recul, CAM.recul * 1.5, CAM.roulis * 1.7);
  const camZ = me.z - recul - CAM.recul * 2.4;
  HORIZON = Math.round(cam.horizonY);
  LIGNES = H - HORIZON;

  const cibleX = -me.dir * 5 - courbure(me.z + 25) * 6 * vit;
  fx.cam.x += (cibleX - fx.cam.x) * Math.min(1, fx.dt * 6);
  fx.cam.y = Math.sin(fx.horloge * 19) * 1.2 * vit + (me.boost > 0 ? 1.8 : 0);

  fx.debut(ctx);
  ctx.translate(Math.round(fx.cam.x), Math.round(fx.cam.y));
  // Roulis de la caméra dans les virages (zoom léger pour cacher les coins)
  ctx.translate(L / 2, H * 0.72);
  ctx.rotate(cam.roulis);
  ctx.scale(1.1, 1.1);
  ctx.translate(-L / 2, -H * 0.72);
  r(ctx, -120, -120, L + 240, HORIZON + 122, "#020208");

  // Voûte de l'arène qui défile avec le cap de la caméra
  const scroll = ((((-Math.atan2(cam.sinP, cam.cosP) * 540 * 0.9) % L_CIEL) + L_CIEL) % L_CIEL);
  const dessinerCielDecale = (dx: number) => {
    if (!decorEnCache("course-ciel", L_CIEL, HORIZON_BASE + 2, dessinerCiel, ctx, dx, HORIZON - HORIZON_BASE)) {
      ctx.save();
      ctx.translate(dx, HORIZON - HORIZON_BASE);
      dessinerCiel(ctx);
      ctx.restore();
    }
  };
  const illustre = dessinerFondIllustre(ctx, scroll);
  if (!illustre) {
    dessinerCielDecale(-scroll);
    dessinerCielDecale(L_CIEL - scroll);
  }
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
  // Sol de l'arène sous l'horizon, avec reflets néon
  const sol = ctx.createLinearGradient(0, HORIZON, 0, H + 80);
  sol.addColorStop(0, "#1a1030");
  sol.addColorStop(0.25, "#0a0a18");
  sol.addColorStop(1, "#04040a");
  ctx.fillStyle = sol;
  ctx.fillRect(-120, HORIZON, L + 240, H + 200 - HORIZON);

  const { moiPx, moiPy } = dessinerScene(ctx, cam, {
    fondIllustre: illustre,
    voitureSprite: spriteVoiturePret(),
    camZ,
    horloge: fx.horloge,
    sprites: { voiture: dessinerVoiture, plot, bloc: blocBeton },
    voitures: s.v.map((c, i) => {
      const j = s.joueurs[i]!;
      const estMoi = c.id === me.id;
      const allie = !estMoi && j.equipe === moiJ.equipe;
      return {
        z: c.z,
        x: c.x,
        couleur: j.couleur,
        frein: c.frein,
        flammes: estMoi
          ? c.nitro > 0 || c.boost > 0
            ? 2
            : c.v > 6 && !c.frein
              ? 0.6
              : 0
          : c.nitro > 0 || c.boost > 0
            ? 1.4
            : 0.5,
        incl: estMoi ? c.dir * 1.6 + (c.glisse > 0 ? Math.sin(fx.horloge * 14) * 2 : 0) : c.dir,
        estMoi,
        etiquette: estMoi
          ? undefined
          : { texte: (allie ? "♦ " : "") + j.pseudo.slice(0, 8), couleur: COULEUR_EQUIPE[j.equipe] },
        secousse: estMoi && Math.abs(c.x) > 1.02 && c.v > 8 ? Math.sin(s.t * 60) * 3 : 0,
        dir: c.dir,
        derape: c.glisse > 0,
        vitesse: c.v,
      };
    }),
  });

  // Poussière, fumée et flammes derrière ma voiture
  const hors = Math.abs(me.x) > 1.02 && me.v > 8;
  if (hors && Math.random() < 0.8)
    fx.particule({
      x: moiPx + (Math.random() - 0.5) * 90,
      y: moiPy,
      vx: (Math.random() - 0.5) * 60,
      vy: -30 - Math.random() * 40,
      vie: 0.5,
      taille: 6,
      couleur: "#8a7a62",
      grav: 20,
    });
  if (me.v > 20 && (me.dir !== 0 || me.glisse > 0) && Math.random() < 0.9)
    for (let q = 0; q < 2; q++)
      fx.particule({
        x: moiPx + (Math.random() - 0.5) * 70,
        y: moiPy - 6,
        vx: (Math.random() - 0.5) * 140 - me.dir * 60,
        vy: -40 - Math.random() * 90,
        vie: 0.45,
        taille: 2,
        couleur: Math.random() < 0.5 ? "#ffb347" : "#ff7a2a",
        grav: 260,
        lueur: true,
      });
  if (me.v > 20 && me.dir !== 0 && Math.random() < 0.5)
    fx.particule({
      x: moiPx + (Math.random() - 0.5) * 80,
      y: moiPy - 2,
      vx: (Math.random() - 0.5) * 50,
      vy: -10 - Math.random() * 20,
      vie: 0.7,
      taille: 9,
      couleur: "#c9c9d8",
      grav: -10,
    });
  if (me.glisse > 0 && Math.random() < 0.7)
    fx.particule({
      x: moiPx + (Math.random() - 0.5) * 80,
      y: moiPy - 4,
      vx: (Math.random() - 0.5) * 80,
      vy: -20,
      vie: 0.5,
      taille: 6,
      couleur: Math.random() < 0.5 ? "#9b5cff" : "#19e6ff",
      lueur: true,
    });
  if ((me.nitro > 0 || me.boost > 0) && Math.random() < 0.9)
    fx.particule({
      x: moiPx + (Math.random() < 0.5 ? -16 : 16),
      y: moiPy,
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

  fx.dessinerParticules(ctx);
  fx.dessinerPopups(ctx);
  fx.fin(ctx);
  fx.dessinerFlash(ctx, L, H);

  // Tableau de bord
  const classement = classer(s);
  const place = classement.find((x) => x.c.id === me.id)?.rang ?? 1;
  const tour = Math.max(1, Math.min(TOURS, Math.floor(me.z / LONGUEUR_TOUR) + 1));
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
    const p = Math.max(0, Math.min(1, c.z / (LONGUEUR_TOUR * TOURS)));
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
