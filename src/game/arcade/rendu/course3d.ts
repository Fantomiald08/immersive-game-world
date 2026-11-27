import {
  FORKS,
  LIMITE_INTERIEURE,
  LONGUEUR_TOUR,
  OBSTACLES,
  TOURS,
  TRONCONS,
  courbure,
  forkA,
  modBoucle,
} from "../jeux/circuit";
import { halo, hash, r, texte } from "./pixel";

/**
 * Rendu 3D du circuit néon : piste qui monte et redescend (ponts), rails lumineux en tube, tribunes avec public,
 * portiques holographiques, écrans à balayage, et voiture 3D éclairée. La physique reste celle du jeu.
 */

export const DEMI_LARGEUR = 14; // m (route élargie)
const PAS = 3; // m, pas de la polyligne précalculée
const DECALAGE = 240; // m de piste avant z = 0
const KT = 0.014; // rad par unité de courbure et par mètre
const FOCALE = 360; // champ de vision plus large
const CX = 400;
const CY = 236;
const NEAR = 0.6;
const PORTEE_M = 480;
const SEG = 8;
/** Au-delà de cette distance (m), on dessine moins de détails (niveau de détail) pour garder un bon rythme. */
const PROCHE_M = 230;

const NEON_G = "#19e6ff";
const NEON_D = "#ff2fb4";
const JAUNE = "#ffe14d";

type V3 = readonly [number, number, number];

/* ───── Tracé précalculé ───── */
let PX: Float32Array;
let PY: Float32Array;
let PHI: Float32Array;
let PH: Float32Array;
let SPIRALES: Array<[number, number]> = [];

function spirales(): Array<[number, number]> {
  const res: Array<[number, number]> = [];
  let z = 0;
  let debut = -1;
  let signe = 0;
  for (const [l, c] of TRONCONS) {
    const s = Math.abs(c) >= 1 ? Math.sign(c) : 0;
    if (!(s !== 0 && s === signe)) {
      if (debut >= 0 && z - debut >= 300) res.push([debut, z]);
      debut = s !== 0 ? z : -1;
      signe = s;
    }
    z += l;
  }
  if (debut >= 0 && z - debut >= 300) res.push([debut, z]);
  return res;
}

const lisse = (u: number) => {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
};

function altitude(zm: number): number {
  const m = modBoucle(zm);
  let h = 1.2 * Math.sin(m / 150);
  for (const [a, b] of SPIRALES) h += 19 * (lisse((m - a) / (b - a)) - lisse((m - b - 20) / 240));
  return h;
}

function preparer(): void {
  if (PX) return;
  SPIRALES = spirales();
  const n = Math.ceil((LONGUEUR_TOUR * (TOURS + 2) + DECALAGE) / PAS) + 2;
  PX = new Float32Array(n);
  PY = new Float32Array(n);
  PHI = new Float32Array(n);
  PH = new Float32Array(n);
  let x = 0;
  let y = 0;
  let phi = 0;
  for (let i = 0; i < n; i++) {
    const z = i * PAS - DECALAGE;
    PX[i] = x;
    PY[i] = y;
    PHI[i] = phi;
    PH[i] = altitude(z);
    x += Math.cos(phi) * PAS;
    y += Math.sin(phi) * PAS;
    phi -= courbure(z) * KT * PAS;
  }
}

export type Pt = { x: number; y: number; phi: number; h: number };
export function pt(z: number): Pt {
  preparer();
  const f = Math.max(0, Math.min(PX.length - 2.001, (z + DECALAGE) / PAS));
  const i = Math.floor(f);
  const u = f - i;
  const l = (a: Float32Array) => a[i]! + (a[i + 1]! - a[i]!) * u;
  return { x: l(PX), y: l(PY), phi: l(PHI), h: l(PH) };
}

function bord(p: Pt, lat: number, dh = 0): V3 {
  return [p.x + Math.sin(p.phi) * lat, p.y - Math.cos(p.phi) * lat, p.h + dh];
}

/* ───── Caméra ───── */
export type Camera = {
  x: number;
  y: number;
  h: number;
  phi: number;
  pitch: number;
  roulis: number;
  cosP: number;
  sinP: number;
  cosF: number;
  sinF: number;
  cosA: number;
  sinA: number;
  horizonY: number;
};

export function creerCamera(
  moiZ: number,
  moiX: number,
  recul: number,
  extraRecul: number,
  extraHaut: number,
  roulis: number,
): Camera {
  const camZ = moiZ - recul - extraRecul * 2.4;
  const p = pt(camZ);
  const ahead = pt(moiZ + 22);
  const phi = ahead.phi * 0.6 + p.phi * 0.4;
  const lat = moiX * DEMI_LARGEUR * 0.6;
  const cx = p.x + Math.sin(p.phi) * lat;
  const cy = p.y - Math.cos(p.phi) * lat;
  const pitch = 0.22 + extraHaut * 0.012;
  const h = p.h + 5.6 + extraHaut * 0.5;
  return {
    x: cx,
    y: cy,
    h,
    phi,
    pitch,
    roulis,
    cosP: Math.cos(phi),
    sinP: Math.sin(phi),
    cosF: Math.cos(pitch),
    sinF: Math.sin(pitch),
    cosA: Math.cos(pitch),
    sinA: Math.sin(pitch),
    horizonY: CY - FOCALE * Math.tan(pitch),
  };
}

type Cam3 = readonly [number, number, number];
function versCamera(c: Camera, p: V3): Cam3 {
  const dx = p[0] - c.x;
  const dy = p[1] - c.y;
  const zf = dx * c.cosP + dy * c.sinP;
  const xr = dx * c.sinP - dy * c.cosP;
  const yh = p[2] - c.h;
  return [xr, zf * c.cosA - yh * c.sinA, yh * c.cosA + zf * c.sinA];
}
const ecran = (q: Cam3): [number, number] => [CX + (FOCALE * q[0]) / q[1], CY - (FOCALE * q[2]) / q[1]];

function polygone(c: Camera, pts: V3[]): Array<[number, number]> | null {
  let q = pts.map((p) => versCamera(c, p));
  if (q.every((v) => v[1] < NEAR)) return null;
  if (q.some((v) => v[1] < NEAR)) {
    const res: Cam3[] = [];
    for (let i = 0; i < q.length; i++) {
      const a = q[i]!;
      const b = q[(i + 1) % q.length]!;
      const ina = a[1] >= NEAR;
      const inb = b[1] >= NEAR;
      if (ina) res.push(a);
      if (ina !== inb) {
        const t = (NEAR - a[1]) / (b[1] - a[1]);
        res.push([a[0] + (b[0] - a[0]) * t, NEAR, a[2] + (b[2] - a[2]) * t]);
      }
    }
    q = res;
  }
  if (q.length < 3) return null;
  return q.map(ecran);
}

function remplir(ctx: CanvasRenderingContext2D, c: Camera, pts: V3[], couleur: string, trait = false): void {
  const s = polygone(c, pts);
  if (!s) return;
  ctx.fillStyle = couleur;
  ctx.beginPath();
  s.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
  if (trait) {
    ctx.strokeStyle = couleur;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** Couleur hexadécimale → rgba avec transparence (pour les halos additifs). */
function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Éclaircit ou assombrit une couleur hexadécimale (k = 1 : inchangée). */
function teinte(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  const h = (v: number) => c(v).toString(16).padStart(2, "0");
  return `#${h((n >> 16) & 255)}${h((n >> 8) & 255)}${h(n & 255)}`;
}

/* ───── Voiture 3D éclairée ───── */
export type VoitureScene = {
  z: number;
  x: number;
  couleur: string;
  frein: boolean;
  flammes: number;
  incl: number;
  estMoi: boolean;
  etiquette?: { texte: string; couleur: string } | undefined;
  secousse: number;
  dir: number;
  derape: boolean;
  vitesse: number;
};

export type Sprites = {
  voiture: unknown;
  plot: (ctx: CanvasRenderingContext2D, x: number, y: number, larg: number, t: number, h: number) => void;
  bloc: (ctx: CanvasRenderingContext2D, x: number, y: number, larg: number, neon: string, hmul?: number) => void;
};

type Loc = readonly [number, number, number];
type Solide = { v: Loc[]; col: [string, string, string, string, string]; neon?: string };

function boite(u0: number, u1: number, w0: number, w1: number, z0: number, z1: number, col: Solide["col"], neon?: string): Solide {
  const s: Solide = {
    v: [
      [u0, w1, z0],
      [u0, w0, z0],
      [u1, w0, z0],
      [u1, w1, z0],
      [u0, w1, z1],
      [u0, w0, z1],
      [u1, w0, z1],
      [u1, w1, z1],
    ],
    col,
  };
  if (neon) s.neon = neon;
  return s;
}

const LUMIERE_DIR = (() => {
  const v = [0.45, -0.55, 0.7];
  const n = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / n, v[1]! / n, v[2]! / n] as const;
})();

function dessinerVoiture3D(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  v: { x: number; y: number; h: number; yaw: number; couleur: string; frein: boolean; flammes: number; t: number },
): void {
  const fx = Math.cos(v.yaw);
  const fy = Math.sin(v.yaw);
  const rx = Math.sin(v.yaw);
  const ry = -Math.cos(v.yaw);
  const mon = (l: Loc): V3 => [v.x + fx * l[0] + rx * l[1], v.y + fy * l[0] + ry * l[1], v.h + l[2]];

  // Ombre portée et néon bleu sous le châssis
  const sol = (u0: number, u1: number, w0: number, w1: number, col: string, dh: number) =>
    remplir(ctx, cam, [mon([u0, w0, dh]), mon([u1, w0, dh]), mon([u1, w1, dh]), mon([u0, w1, dh])], col);
  sol(-3.1, 3.6, -1.9, 2.1, "rgba(0,0,0,0.5)", 0.03);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  sol(-2.7, 2.7, -1.45, 1.45, "rgba(30,120,255,0.22)", 0.05);
  sol(-2.3, 2.3, -1.15, 1.15, "rgba(70,180,255,0.35)", 0.06);
  ctx.restore();

  const c = v.couleur;
  const carro: Solide["col"] = [teinte(c, 0.45), teinte(c, 0.3), teinte(c, 0.38), teinte(c, 0.34), teinte(c, 0.7)];
  const verre: Solide["col"] = ["#1a3358", "#10203a", "#162a48", "#10203a", "#2a4a78"];
  const noir: Solide["col"] = ["#0c0c16", "#08080f", "#0c0c16", "#2c2c40", "#16162a"];
  const jante: Solide["col"] = ["#8a8aa6", "#6a6a86", "#7a7a96", "#6a6a86", "#b0b0c8"];
  const lum = v.frein ? "#ff9a9a" : "#ff2a2a";
  const feu: Solide["col"] = [lum, lum, lum, lum, "#ffd0d0"];
  const parts: Solide[] = [];
  // Roues : pneu, jante avec rayons, de chaque côté
  for (const u of [-1.45, 1.5])
    for (const s of [-1, 1]) {
      const wo = s > 0 ? 0.86 : -1.14;
      const wi = s > 0 ? 1.14 : -0.86;
      parts.push(boite(u - 0.46, u + 0.46, wo, wi, 0, 0.74, noir));
      parts.push(boite(u - 0.3, u + 0.3, s > 0 ? 1.14 : -1.16, s > 0 ? 1.16 : -1.14, 0.18, 0.56, jante));
    }
  // Caisse basse et large, pare-chocs avant effilé
  const bas = boite(-2.2, 2.2, -0.98, 0.98, 0.2, 0.8, carro);
  bas.v[6] = [1.85, -0.9, 0.78];
  bas.v[7] = [1.85, 0.9, 0.78];
  bas.v[4] = [-2.2, 0.94, 0.8];
  bas.v[5] = [-2.2, -0.94, 0.8];
  parts.push(bas);
  // Jupes latérales sombres
  parts.push(boite(-1.7, 1.6, -1.02, -0.98, 0.2, 0.36, noir));
  parts.push(boite(-1.7, 1.6, 0.98, 1.02, 0.2, 0.36, noir));
  // Bande de couleur sur le capot
  parts.push(boite(-1.2, 0.8, -0.84, 0.84, 0.78, 1.0, carro));
  // Habitacle à lunette inclinée
  const hab = boite(-1.15, 0.85, -0.82, 0.82, 0.8, 1.34, verre);
  hab.v[4] = [-0.7, 0.66, 1.34];
  hab.v[5] = [-0.7, -0.66, 1.34];
  hab.v[6] = [0.25, -0.66, 1.34];
  hab.v[7] = [0.25, 0.66, 1.34];
  parts.push(hab);
  // Aileron sur deux jambes, bande néon sur le bord
  parts.push(boite(-2.3, -1.9, -1.0, 1.0, 1.12, 1.2, noir, c));
  parts.push(boite(-2.15, -2.05, -0.55, -0.45, 0.8, 1.12, noir));
  parts.push(boite(-2.15, -2.05, 0.45, 0.55, 0.8, 1.12, noir));
  // Barre de feux arrière + optiques
  parts.push(boite(-2.24, -2.2, -0.92, 0.92, 0.5, 0.64, feu));
  parts.push(boite(-2.26, -2.2, -0.9, -0.55, 0.66, 0.78, feu));
  parts.push(boite(-2.26, -2.2, 0.55, 0.9, 0.66, 0.78, feu));
  // Échappements et flammes bleues
  if (v.flammes > 0) {
    const l = 0.5 + v.flammes * 0.55 + Math.sin(v.t * 55) * 0.18;
    for (const s of [-0.55, 0.55])
      parts.push(boite(-2.2 - l, -2.2, s - 0.14, s + 0.14, 0.26, 0.42, ["#1fa8ff", "#1fa8ff", "#1fa8ff", "#1fa8ff", "#d6f6ff"]));
  }

  const items = parts.map((p) => {
    const w = p.v.map(mon);
    const centre = w.reduce(
      (a, q) => [a[0] + q[0] / 8, a[1] + q[1] / 8, a[2] + q[2] / 8] as [number, number, number],
      [0, 0, 0] as [number, number, number],
    );
    return { p, w, centre, d: versCamera(cam, centre)[1] };
  });
  items.sort((a, b) => b.d - a.d);
  const faces: Array<[number[], number]> = [
    [[0, 1, 5, 4], 0],
    [[1, 2, 6, 5], 1],
    [[2, 3, 7, 6], 2],
    [[3, 0, 4, 7], 3],
    [[4, 5, 6, 7], 4],
  ];
  for (const { p, w, centre } of items) {
    for (const [idx, ci] of faces) {
      const q = idx.map((i) => w[i]!);
      const fc = q.reduce(
        (a, t) => [a[0] + t[0] / 4, a[1] + t[1] / 4, a[2] + t[2] / 4] as [number, number, number],
        [0, 0, 0] as [number, number, number],
      );
      const a = [q[1]![0] - q[0]![0], q[1]![1] - q[0]![1], q[1]![2] - q[0]![2]];
      const b = [q[3]![0] - q[0]![0], q[3]![1] - q[0]![1], q[3]![2] - q[0]![2]];
      let n = [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
      if (n[0]! * (fc[0] - centre[0]) + n[1]! * (fc[1] - centre[1]) + n[2]! * (fc[2] - centre[2]) < 0) n = n.map((t) => -t);
      const nl = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
      const nn = [n[0]! / nl, n[1]! / nl, n[2]! / nl];
      // Face visible ?
      if (nn[0]! * (cam.x - fc[0]) + nn[1]! * (cam.y - fc[1]) + nn[2]! * (cam.h - fc[2]) <= 0) continue;
      // Éclairage : lumière venant du haut et de l'avant-gauche
      const dot = nn[0]! * LUMIERE_DIR[0] + nn[1]! * LUMIERE_DIR[1] + nn[2]! * LUMIERE_DIR[2];
      const lumiere = 0.55 + 0.55 * Math.max(0, dot);
      remplir(ctx, cam, q, teinte(p.col[ci]!, lumiere));
      if (ci === 4 && dot > 0.5) {
        // Reflet spéculaire sur le toit
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const s = polygone(cam, q.map((t) => [t[0], t[1], t[2]] as V3));
        if (s) {
          ctx.fillStyle = "rgba(200,230,255,0.22)";
          ctx.beginPath();
          s.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    }
    if (p.neon) {
      const q = [4, 5, 6, 7].map((i) => w[i]!);
      const s = polygone(cam, q);
      if (s) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = alpha(p.neon, 0.35);
        ctx.lineWidth = 4;
        ctx.beginPath();
        s.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
        ctx.stroke();
        ctx.strokeStyle = p.neon;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    }
    void centre;
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  remplir(ctx, cam, [mon([-0.6, -0.45, 1.36]), mon([0.15, -0.45, 1.36]), mon([0.15, 0.45, 1.36]), mon([-0.6, 0.45, 1.36])], "rgba(170,210,255,0.22)");
  remplir(ctx, cam, [mon([-2.2, -0.8, 0.82]), mon([-2.2, 0.8, 0.82]), mon([-1.2, 0.8, 0.82]), mon([-1.2, -0.8, 0.82])], "rgba(255,220,220,0.12)");
  ctx.restore();
  // Halo des feux arrière
  const lo = mon([-2.25, 0, 0.6]);
  const [hx, hy] = ecran(versCamera(cam, lo));
  const dl = versCamera(cam, lo)[1];
  if (dl > NEAR) halo(ctx, hx, hy, (FOCALE * 0.9) / dl, v.frein ? "#ff5050" : "#ff2020", 0.5);
}

/* ───── Scène ───── */
type Item = { d: number; dessin: () => void };

function nuancePublic(i: number): string {
  return ["#f6d5b8", "#c98d5f", "#7a4e33", "#e6b896"][i % 4]!;
}
const PALETTE_PUBLIC = [NEON_D, NEON_G, JAUNE, "#7a3cff", "#ff6b6b", "#6ee7a0", "#ffffff"];

/** Une personne de tribune : corps, tête, et bâton lumineux levé quand le public s'excite. */
function personne(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  sz: number,
  tenue: string,
  bras: number,
  baton: string,
  lueur: boolean,
): void {
  r(ctx, sx - sz * 0.5, sy - sz * 1.05, sz, sz * 1.1, tenue);
  r(ctx, sx - sz * 0.32, sy - sz * 1.55, sz * 0.64, sz * 0.52, nuancePublic(Math.floor(sz * 7) % 4));
  if (bras > 0) {
    r(ctx, sx - sz * 0.62, sy - sz * (1.1 + bras), sz * 0.16, sz * (0.9 + bras * 0.4), tenue);
    r(ctx, sx + sz * 0.46, sy - sz * (1.1 + bras), sz * 0.16, sz * (0.9 + bras * 0.4), tenue);
    r(ctx, sx - sz * 0.62, sy - sz * (1.1 + bras) - sz * 0.5, sz * 0.2, sz * 0.5, baton);
    if (lueur && sz > 5) halo(ctx, sx - sz * 0.54, sy - sz * (1.1 + bras) - sz * 0.5, sz * 1.1, baton, 0.5);
  }
}

export function dessinerScene(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  o: { camZ: number; horloge: number; voitures: VoitureScene[]; sprites: Sprites; fondIllustre?: boolean; voitureSprite?: HTMLImageElement | null },
): { moiPx: number; moiPy: number } {
  preparer();
  const { camZ, horloge } = o;
  const items: Item[] = [];
  const profondeur = (p: V3) => versCamera(cam, p)[1];
  const z0 = Math.floor((camZ - 12) / SEG) * SEG;
  const n = Math.ceil((PORTEE_M + 12) / SEG);
  const pts: Pt[] = [];
  for (let k = 0; k <= n; k++) pts.push(pt(z0 + k * SEG));

  // Quadrillage néon au sol de l'arène (échelle et hauteur des ponts)
  if (!o.fondIllustre) {
    const G = 36;
    const gx0 = Math.floor((cam.x - 300) / G) * G;
    const gy0 = Math.floor((cam.y - 300) / G) * G;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 17; i++)
      for (const axe of [0, 1]) {
        const a: V3 = axe === 0 ? [gx0 + i * G, gy0, 0] : [gx0, gy0 + i * G, 0];
        const b: V3 = axe === 0 ? [gx0 + i * G, gy0 + 17 * G, 0] : [gx0 + 17 * G, gy0 + i * G, 0];
        const qa = versCamera(cam, a);
        const qb = versCamera(cam, b);
        if (qa[1] < NEAR && qb[1] < NEAR) continue;
        const s = polygone(cam, [a, b]);
        if (!s) continue;
        ctx.strokeStyle = (i + axe) % 4 === 0 ? alpha(NEON_D, 0.3) : alpha(NEON_G, 0.14);
        ctx.beginPath();
        ctx.moveTo(s[0]![0], s[0]![1]);
        ctx.lineTo(s[1]![0], s[1]![1]);
        ctx.stroke();
      }
  }

  for (let k = 0; k < n; k++) {
    const za = z0 + k * SEG;
    const a = pts[k]!;
    const b = pts[k + 1]!;
    const m = modBoucle(za);
    const bande = Math.floor(za / 8);
    const pair = bande % 2 === 0;
    const fork = forkA(za);
    const d = profondeur(bord(a, 0));
    if (d < -SEG * 2) continue;
    const proche = d < PROCHE_M;

    // Ruban de piste : asphalte à deux teintes, reflets, sous-face pour les ponts
    items.push({
      d,
      dessin: () => {
        const q = (l1: number, l2: number, dh1: number, dh2: number, col: string, trait = false) =>
          remplir(ctx, cam, [bord(a, l1, dh1), bord(a, l2, dh2), bord(b, l2, dh2), bord(b, l1, dh1)], col, trait);
        if (a.h > 1.5) {
          q(-DEMI_LARGEUR, DEMI_LARGEUR, -0.02, -0.02, "#0d0b1a");
          q(-DEMI_LARGEUR * 0.9, DEMI_LARGEUR * 0.9, -0.5, -0.5, "#150f2a");
        }
        q(-DEMI_LARGEUR, DEMI_LARGEUR, 0, 0, pair ? "#24242f" : "#2a2a37", true);
        // Reflets de lumière sur l'asphalte
        if (bande % 3 === 0) q(-DEMI_LARGEUR * 0.55, -DEMI_LARGEUR * 0.2, 0.01, 0.01, "rgba(140,150,255,0.07)");
        if (bande % 5 === 2) q(DEMI_LARGEUR * 0.2, DEMI_LARGEUR * 0.6, 0.01, 0.01, "rgba(255,120,220,0.06)");
        // Vibreurs bicolores et lignes de rive
        q(-DEMI_LARGEUR, -DEMI_LARGEUR + 0.7, 0.02, 0.02, pair ? NEON_G : NEON_D);
        q(DEMI_LARGEUR - 0.7, DEMI_LARGEUR, 0.02, 0.02, pair ? NEON_D : NEON_G);
        q(-DEMI_LARGEUR + 0.8, -DEMI_LARGEUR + 1.0, 0.02, 0.02, "#e8e8f4");
        q(DEMI_LARGEUR - 1.0, DEMI_LARGEUR - 0.8, 0.02, 0.02, "#e8e8f4");
        if (fork) {
          q(-DEMI_LARGEUR * 0.07, DEMI_LARGEUR * 0.07, 0.02, 0.02, "#0b0b13");
          q(DEMI_LARGEUR * LIMITE_INTERIEURE, DEMI_LARGEUR - 0.7, 0.02, 0.02, pair ? "#d9a300" : "#17171f");
          q(DEMI_LARGEUR * LIMITE_INTERIEURE - 0.15, DEMI_LARGEUR * LIMITE_INTERIEURE, 0.03, 0.03, NEON_D);
        } else if (bande % 4 < 2) q(-0.14, 0.14, 0.02, 0.02, "#e8e8f4");
        if (proche && bande % 6 === 3) {
          q(-0.35, 0.35, 0.03, 0.03, "rgba(255,225,77,0.55)");
          q(-0.9, -0.5, 0.035, 0.035, "rgba(255,225,77,0.35)");
          q(0.5, 0.9, 0.035, 0.035, "rgba(255,225,77,0.35)");
        }
        if (m < 8)
          for (let i = 0; i < 12; i++) {
            const l1 = -DEMI_LARGEUR + (i * 2 * DEMI_LARGEUR) / 12;
            q(l1, l1 + (2 * DEMI_LARGEUR) / 12, 0.03, 0.03, (i + Math.floor(m / 4)) % 2 === 0 ? "#f6f6ff" : "#101018");
          }
        // Rails : tubes lumineux (halo + cœur brillant) et muret sombre
        for (const cote of [-1, 1] as const) {
          const l = cote * (DEMI_LARGEUR + 0.5);
          const col = cote < 0 ? NEON_G : NEON_D;
          remplir(ctx, cam, [bord(a, l, 0), bord(a, l, 1.5), bord(b, l, 1.5), bord(b, l, 0)], "#080818");
          if (proche) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            remplir(ctx, cam, [bord(a, l, 0.9), bord(a, l, 1.9), bord(b, l, 1.9), bord(b, l, 0.9)], alpha(col, 0.18));
            remplir(ctx, cam, [bord(a, l, 1.05), bord(a, l, 1.7), bord(b, l, 1.7), bord(b, l, 1.05)], alpha(col, 0.42));
            ctx.restore();
          }
          remplir(ctx, cam, [bord(a, l, 1.2), bord(a, l, 1.42), bord(b, l, 1.42), bord(b, l, 1.2)], col);
          if (proche) remplir(ctx, cam, [bord(a, l, 1.3), bord(a, l, 1.36), bord(b, l, 1.36), bord(b, l, 1.3)], "#ffffff");
          remplir(ctx, cam, [bord(a, l, 0.35), bord(a, l, 0.5), bord(b, l, 0.5), bord(b, l, 0.35)], cote < 0 ? NEON_D : NEON_G);
          remplir(ctx, cam, [bord(a, l, 1.5), bord(a, l + cote * 0.6, 1.5), bord(b, l + cote * 0.6, 1.5), bord(b, l, 1.5)], "#1a1a3a");
        }
      },
    });

    // Rubans néon suspendus au-dessus des ponts (comme les tubes de l'illustration)
    if (a.h > 3 && proche && Math.floor(za / SEG) % 2 === 0) {
      items.push({
        d: d - 0.5,
        dessin: () => {
          const hz = a.h + 6 + Math.sin(za * 0.02) * 1.5;
          const col = Math.floor(za / 40) % 2 ? NEON_D : NEON_G;
          const ruban = (w: number, c: string) =>
            remplir(ctx, cam, [bord(a, -w, hz), bord(a, w, hz), bord(b, w, hz), bord(b, -w, hz)], c);
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ruban(2.2, alpha(col, 0.14));
          ruban(1.2, alpha(col, 0.35));
          ctx.restore();
          ruban(0.45, col);
          ruban(0.15, "#ffffff");
        },
      });
    }

    // Piliers sous les ponts
    if (a.h > 2.5 && Math.floor(za / SEG) % 6 === 0 && proche) {
      items.push({
        d: d - 0.2,
        dessin: () => {
          const haut = versCamera(cam, bord(a, 0, -0.4));
          const bas = versCamera(cam, [a.x, a.y, 0]);
          if (haut[1] < NEAR || bas[1] < NEAR) return;
          const [hx, hy] = ecran(haut);
          const [bx, by] = ecran(bas);
          const w = (FOCALE * 1.3) / haut[1];
          r(ctx, hx - w / 2, hy, w, by - hy, "#151534");
          r(ctx, hx - w / 2, hy, Math.max(1, w * 0.12), by - hy, NEON_G);
          r(ctx, hx + w / 2 - Math.max(1, w * 0.12), hy, Math.max(1, w * 0.12), by - hy, NEON_D);
        },
      });
    }

    // Tribunes étagées avec public et bâtons lumineux (niveau de détail selon la distance)
    if (!o.fondIllustre && a.h < 7 && d < 110 && Math.floor(za / SEG) % 2 === 0) {
      const b2 = pts[Math.min(n, k + 2)]!;
      for (const cote of [-1, 1] as const) {
        items.push({
          d: d - 0.4,
          dessin: () => {
            const gp = (p: Pt, l: number, h: number): V3 => [p.x + Math.sin(p.phi) * l, p.y - Math.cos(p.phi) * l, h];
            const niveaux = proche ? 5 : 3;
            for (let t = 0; t < niveaux; t++) {
              const l0 = cote * (DEMI_LARGEUR + 6 + t * 3.2);
              const l1 = cote * (DEMI_LARGEUR + 9.2 + t * 3.2);
              const hh = 2.8 * (t + 1);
              // Gradin : face avant sombre, marche éclairée, rampe de sécurité néon
              remplir(ctx, cam, [gp(a, l0, 0), gp(b2, l0, 0), gp(b2, l0, hh), gp(a, l0, hh)], t % 2 ? "#2c2262" : "#221a4e");
              remplir(ctx, cam, [gp(a, l0, hh), gp(b2, l0, hh), gp(b2, l1, hh), gp(a, l1, hh)], "#3a3272");
              // Lueur de la rangée : éclairage ambiant des projecteurs
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              remplir(ctx, cam, [gp(a, l0, hh + 0.3), gp(b2, l0, hh + 0.3), gp(b2, l1, hh + 1.2), gp(a, l1, hh + 1.2)], alpha(t % 2 ? NEON_D : NEON_G, 0.12));
              ctx.restore();
              remplir(ctx, cam, [gp(a, l0, hh - 0.25), gp(b2, l0, hh - 0.25), gp(b2, l0, hh), gp(a, l0, hh)], t % 2 ? NEON_D : NEON_G);
              if (d < 90) {
                // Public : rangées de personnes, couleurs de tenue variées, bâtons qui s'agitent
                for (let j = 0; j < 11; j++) {
                  const u = (j + 0.5) / 11;
                  const px = a.x + (b2.x - a.x) * u + Math.sin(a.phi) * (l0 + cote * 1.4);
                  const py = a.y + (b2.y - a.y) * u - Math.cos(a.phi) * (l0 + cote * 1.4);
                  const hs = hash(Math.floor(za) * 13 + t * 7 + j + (cote > 0 ? 3 : 0));
                  const levee = Math.max(0, Math.sin(horloge * 5 + za * 0.3 + j * 2 + t));
                  const qq = versCamera(cam, [px, py, hh + 0.3]);
                  if (qq[1] < NEAR) continue;
                  const [sx, sy] = ecran(qq);
                  const sz = Math.min(10, Math.max(2, (FOCALE * 0.42) / qq[1]));
                  personne(
                    ctx,
                    sx,
                    sy,
                    sz,
                    PALETTE_PUBLIC[Math.floor(hs * PALETTE_PUBLIC.length)]!,
                    hs > 0.35 ? 0.5 + levee * 0.6 : 0,
                    PALETTE_PUBLIC[Math.floor(hs * 13) % PALETTE_PUBLIC.length]!,
                    levee > 0.5 && sz > 3,
                  );
                }
              } else {
                // Lointain : une bande de couleur vive, sans détail
                remplir(ctx, cam, [gp(a, l0, hh + 0.2), gp(b2, l0, hh + 0.2), gp(b2, l1, hh + 0.2), gp(a, l1, hh + 0.2)], alpha(PALETTE_PUBLIC[(t + (cote > 0 ? 2 : 0)) % PALETTE_PUBLIC.length]!, 0.55));
              }
            }
          },
        });
      }
    }

    // Écrans géants et enseignes sur les côtés, avec cadre néon et balayage
    if (!o.fondIllustre && Math.floor(m / 4) % 24 === 0 && d < 110) {
      for (const cote of [-1, 1] as const) {
        items.push({
          d: d - 0.3,
          dessin: () => {
            const l = cote * (DEMI_LARGEUR + 15);
            const b3 = pt(za + 30);
            const gp = (p: Pt, h: number): V3 => [p.x + Math.sin(p.phi) * l, p.y - Math.cos(p.phi) * l, h];
            const idx = Math.floor(m / 96);
            const col = (idx + (cote > 0 ? 1 : 0)) % 2 ? NEON_D : NEON_G;
            const base = 15 + hash(idx) * 4;
            // Cadre : deux épaisseurs lumineuses, puis écran sombre
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            remplir(ctx, cam, [gp(a, base - 2.2), gp(b3, base - 2.2), gp(b3, base + 15), gp(a, base + 15)], alpha(col, 0.14));
            ctx.restore();
            remplir(ctx, cam, [gp(a, base - 0.9), gp(b3, base - 0.9), gp(b3, base + 13), gp(a, base + 13)], col);
            remplir(ctx, cam, [gp(a, base), gp(b3, base), gp(b3, base + 12), gp(a, base + 12)], col === NEON_G ? "#06263a" : "#240a24");
            // Balayage : lignes horizontales plus claires en alternance
            for (let g = 0; g < 4; g++) {
              const hz = base + 1.5 + g * 2.8;
              remplir(ctx, cam, [gp(a, hz), gp(b3, hz), gp(b3, hz + 0.25), gp(a, hz + 0.25)], alpha(col, 0.35));
            }
            // Contenu : silhouettes de public sur l'écran
            for (let g = 0; g < 9; g++) {
              const u1 = hash(idx + g * 3);
              const u2 = hash(idx + g * 5 + 1);
              const pa = pt(za + 30 * u1);
              const pb = pt(za + 30 * Math.min(1, u1 + 0.18));
              remplir(ctx, cam, [gp(pa, base + 1 + u2 * 8), gp(pb, base + 1.2 + u2 * 8), gp(pb, base + 2.1 + u2 * 8), gp(pa, base + 1.9 + u2 * 8)], g % 3 ? "#ffffff" : col);
            }
            const mid = versCamera(cam, [(gp(a, 0)[0] + gp(b3, 0)[0]) / 2, (gp(a, 0)[1] + gp(b3, 0)[1]) / 2, base + 6]);
            if (mid[1] > 6 && proche) {
              const [lx, ly] = ecran(mid);
              const noms = ["ワイチバーコン", "デバー", "アントラホーテ", "ISITECH"];
              texte(ctx, noms[Math.floor(hash(idx * 3.7) * 4)]!, lx, ly, Math.max(9, Math.min(34, (FOCALE * 3.6) / mid[1])), "#ffffff");
            }
          },
        });
      }
    }
  }

  // Portiques lumineux au-dessus de la piste (tous les 160 m)
  for (let g = Math.floor(camZ / 110) * 110; g < camZ + PORTEE_M; g += 110) {
    const dz = g - camZ;
    if (dz < 2) continue;
    const p = pt(g);
    const p2 = pt(g + 3);
    const q = versCamera(cam, bord(p, 0, 8));
    if (q[1] < NEAR) continue;
    items.push({
      d: q[1] - 0.6,
      dessin: () => {
        const L = DEMI_LARGEUR + 2.5;
        // Piliers
        for (const cote of [-1, 1] as const)
          remplir(ctx, cam, [bord(p, cote * L, 0), bord(p, cote * (L + 0.6), 0), bord(p2, cote * (L + 0.6), 8), bord(p2, cote * L, 8)], "#15153a");
        // Poutre et bande lumineuse
        remplir(ctx, cam, [bord(p, -L, 8), bord(p, L, 8), bord(p2, L, 8.8), bord(p2, -L, 8.8)], "#1a1a44");
        remplir(ctx, cam, [bord(p, -L, 7.7), bord(p, L, 7.7), bord(p2, L, 7.7), bord(p2, -L, 7.7)], NEON_G);
        for (let i = 0; i < 6; i++) {
          const lat = -L + (2 * L * i) / 5;
          const lamp = versCamera(cam, bord(p, lat, 7.5));
          if (lamp[1] > NEAR) {
            const [lx, ly] = ecran(lamp);
            r(ctx, lx - 1.5, ly - 1.5, 3, 3, i % 2 ? JAUNE : "#ffffff");
          }
        }
        // Panneau holographique central
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        remplir(ctx, cam, [bord(p, -2, 4.6), bord(p, 2, 4.6), bord(p2, 2, 6.8), bord(p2, -2, 6.8)], alpha(NEON_D, 0.18));
        remplir(ctx, cam, [bord(p, -1.5, 4.9), bord(p, 1.5, 4.9), bord(p2, 1.5, 6.5), bord(p2, -1.5, 6.5)], alpha(NEON_G, 0.22));
        ctx.restore();
        const c = versCamera(cam, bord(p, 0, 5.8));
        if (c[1] > NEAR) {
          const [sx, sy] = ecran(c);
          texte(ctx, "ISITECH", sx, sy, Math.max(7, Math.min(16, (FOCALE * 1.2) / c[1])), NEON_G);
        }
      },
    });
  }

  // Dalles de boost et flaques d'huile à plat
  for (const ob of OBSTACLES) {
    if (ob.type !== "huile" && ob.type !== "boost") continue;
    const dz = modBoucle(ob.z - camZ + 12) - 12;
    if (dz < -10 || dz > PORTEE_M) continue;
    const zw = camZ + dz;
    const p1 = pt(zw);
    const p2 = pt(zw + ob.prof);
    const larg = Math.max(2.8, ob.w * DEMI_LARGEUR);
    const lat = ob.x * DEMI_LARGEUR;
    const d = profondeur(bord(p1, lat));
    items.push({
      d: d - 0.1,
      dessin: () => {
        const quad = (e: number, col: string, dz2 = 0) => {
          const l1 = lat - larg / 2 + e;
          const l2 = lat + larg / 2 - e;
          remplir(ctx, cam, [bord(p1, l1, 0.04 + dz2), bord(p1, l2, 0.04 + dz2), bord(p2, l2, 0.04 + dz2), bord(p2, l1, 0.04 + dz2)], col);
        };
        if (ob.type === "boost") {
          quad(0, "#0a4a5c");
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          quad(0.05, alpha(NEON_G, 0.4), 0.01);
          ctx.restore();
          quad(0.3, NEON_G, 0.01);
          quad(0.65, "#7ff3ff", 0.02);
          const c = Math.floor(horloge * 6) % 3;
          for (let g = 0; g < 3; g++) {
            const pz = pt(zw + (ob.prof * (g + 0.5)) / 3);
            const pz2 = pt(zw + (ob.prof * (g + 0.5)) / 3 + 1.2);
            const col = g === c ? "#ffffff" : "#2aa6c4";
            remplir(ctx, cam, [bord(pz, lat - larg * 0.35, 0.05), bord(pz2, lat, 0.05), bord(pz, lat + larg * 0.35, 0.05), bord(pz2, lat, 0.05)], col);
          }
          const mid = versCamera(cam, bord(pt(zw + ob.prof / 2), lat, 0.3));
          if (mid[1] > NEAR) {
            const [sx, sy] = ecran(mid);
            for (let g = 0; g < 9; g++) {
              const ph = (horloge * 1.4 + g * 0.31) % 1;
              r(ctx, sx + (hash(g + ob.id) - 0.5) * ((FOCALE * larg) / mid[1]), sy - (ph * FOCALE * 2.2) / mid[1], 2, 2, g % 2 ? "#bffaff" : JAUNE);
            }
          }
        } else {
          quad(0, "#120a24");
          quad(0.4, "#1c1034", 0.01);
          quad(1, "#2a1a4a", 0.02);
        }
      },
    });
  }

  // Obstacles debout : plots et blocs néon
  for (const ob of OBSTACLES) {
    if (ob.type === "huile" || ob.type === "boost") continue;
    const dz = modBoucle(ob.z - camZ + 12) - 12;
    if (dz < 0 || dz > PORTEE_M) continue;
    const p = pt(camZ + dz);
    const q = versCamera(cam, bord(p, ob.x * DEMI_LARGEUR));
    if (q[1] < NEAR) continue;
    items.push({
      d: q[1] - 0.2,
      dessin: () => {
        const [sx, sy] = ecran(q);
        if (ob.type === "plot") o.sprites.plot(ctx, sx, sy, (FOCALE * 1.0) / q[1], 1, horloge);
        else o.sprites.bloc(ctx, sx, sy, (FOCALE * ob.w * DEMI_LARGEUR) / q[1], NEON_D);
      },
    });
  }

  // Muret central des embranchements (lumineux)
  for (const f of FORKS) {
    for (let z = f.debut; z <= f.fin; z += 6) {
      const dz = modBoucle(z - camZ + 12) - 12;
      if (dz < 0 || dz > PORTEE_M) continue;
      const p = pt(camZ + dz);
      const p2 = pt(camZ + dz + 6);
      const q = versCamera(cam, bord(p, 0));
      items.push({
        d: q[1] - 0.3,
        dessin: () => {
          remplir(ctx, cam, [bord(p, -0.5, 0), bord(p, 0.5, 0), bord(p2, 0.5, 0), bord(p2, -0.5, 0)], "#0b1f33");
          remplir(ctx, cam, [bord(p, -0.5, 0), bord(p, -0.5, 1.2), bord(p2, -0.5, 1.2), bord(p2, -0.5, 0)], "#16385a");
          remplir(ctx, cam, [bord(p, 0.5, 0), bord(p, 0.5, 1.2), bord(p2, 0.5, 1.2), bord(p2, 0.5, 0)], "#0f2a46");
          remplir(ctx, cam, [bord(p, -0.5, 1.2), bord(p, 0.5, 1.2), bord(p2, 0.5, 1.2), bord(p2, -0.5, 1.2)], NEON_G);
        },
      });
    }
  }

  // Voitures
  let moiPx = CX;
  let moiPy = 430;
  for (const v of o.voitures) {
    const p = pt(v.z);
    const wp = bord(p, v.x * DEMI_LARGEUR);
    const q = versCamera(cam, wp);
    if (q[1] < 1.2 || q[1] > PORTEE_M) continue;
    const [sx, sy] = ecran(q);
    if (v.estMoi) {
      moiPx = sx;
      moiPy = sy;
    }
    items.push({
      // La voiture du joueur est toujours dessinée en dernier, par-dessus la route et les tribunes
      d: v.estMoi ? -100 : q[1] - 0.8,
      dessin: () => {
        const larg = (FOCALE * 3.3) / q[1];
        // Traces de dérapage blanches derrière la voiture du joueur
        if (v.estMoi && (v.derape || Math.abs(v.dir) > 0) && v.vitesse > 14) {
          for (const cl of [-1.0, 1.0]) {
            const lat = v.x * DEMI_LARGEUR + cl;
            const pa = pt(v.z - 1.5);
            const pb = pt(v.z - 34);
            remplir(
              ctx,
              cam,
              [bord(pa, lat - 0.12, 0.07), bord(pa, lat + 0.12, 0.07), bord(pb, lat + 0.12 + v.dir * 1.1, 0.07), bord(pb, lat - 0.12 + v.dir * 1.1, 0.07)],
              "rgba(235,235,248,0.55)",
            );
          }
        }
        const yaw = p.phi - v.dir * (v.estMoi ? 0.42 : 0.2) - (v.derape ? 0.25 : 0);
        const sp = o.voitureSprite;
        if (v.estMoi && sp) {
          // Voiture du joueur : sprite pixel-art tirée de l'illustration, à l'échelle de la distance
          const sw = (FOCALE * 4.6) / q[1];
          const sh = (sw * 145) / 330;
          ctx.drawImage(sp, Math.round(sx - sw / 2 + v.secousse), Math.round(sy - sh * 0.8), sw, sh);
          if (v.flammes > 0) halo(ctx, sx, sy - sh * 0.2, sw * 0.12, "#19c8ff", 0.5);
        } else dessinerVoiture3D(ctx, cam, {
          x: wp[0],
          y: wp[1],
          h: wp[2],
          yaw,
          couleur: v.couleur,
          frein: v.frein,
          flammes: v.flammes,
          t: horloge,
        });
        if (v.etiquette && larg > 30)
          texte(ctx, v.etiquette.texte, sx, sy - larg * 0.95, Math.max(8, Math.min(13, larg * 0.16)), v.etiquette.couleur);
      },
    });
  }

  items.sort((x, y) => y.d - x.d);
  for (const it of items) it.dessin();
  return { moiPx, moiPy };
}
