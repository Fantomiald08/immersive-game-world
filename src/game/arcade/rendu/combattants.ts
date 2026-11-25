/**
 * Sprites pixel-art des combattants du mini-jeu « Combat 2D » (≈ 120 px de haut) :
 * 0 = ninja aux cheveux bleus et à la lame, 1 = bagarreur musclé en pantalon rouge.
 * Dessinés par code sur une grille de 3 px, tournés vers la droite puis retournés si besoin.
 */
export type PoseCombat =
  | "idle"
  | "marche"
  | "saut"
  | "garde"
  | "leger"
  | "lourd"
  | "special"
  | "degat"
  | "ko";
export type Genre = 0 | 1;
type P = readonly [number, number];

const U = 3;

type Squelette = {
  lean: number;
  hip: P;
  ff: P;
  bf: P;
  fh: P;
  bh: P;
  /** Direction de la lame (ninja). */
  lame: P;
};

function squelette(pose: PoseCombat, prog: number, marche: number, t: number, genre: Genre): Squelette {
  const e = Math.sin(Math.min(1, prog) * Math.PI);
  const bob = Math.sin(t * 4) * 0.5;
  const base: Squelette = {
    lean: 0,
    hip: [0, -16 + bob * 0.5],
    ff: [6, 0],
    bf: [-6, 0],
    fh: [10, -29 + bob],
    bh: [4, -25 + bob],
    lame: [1, 0.35],
  };
  switch (pose) {
    case "marche": {
      const p = marche * 1.6;
      return {
        ...base,
        ff: [6 + Math.sin(p) * 5, -Math.max(0, Math.cos(p)) * 3],
        bf: [-6 - Math.sin(p) * 5, -Math.max(0, -Math.cos(p)) * 3],
      };
    }
    case "saut":
      return { ...base, hip: [0, -18], ff: [7, -10], bf: [-4, -7], fh: [11, -33], bh: [-2, -31] };
    case "garde":
      return {
        ...base,
        lean: -1,
        hip: [0, -15],
        ff: [7, 0],
        bf: [-6, 0],
        fh: [9, -34],
        bh: [7, -30],
        lame: [0.3, -1],
      };
    case "leger":
      return {
        ...base,
        lean: e * 2,
        ff: [8, 0],
        fh: [9 + e * 15, -30],
        bh: [3, -27],
        lame: [1, 0],
      };
    case "lourd":
      return {
        ...base,
        lean: -e * 2.5,
        ff: [6 + e * 17, -e * 17],
        bf: [-5, 0],
        fh: [7, -32],
        bh: [0, -30],
        lame: [0.5, 0.8],
      };
    case "special": {
      if (genre === 0)
        return {
          ...base,
          lean: e * 3,
          hip: [1, -14],
          ff: [11, 0],
          bf: [-9, 0],
          fh: [11 + e * 13, -33 - e * 3],
          bh: [2, -28],
          lame: [1, -0.15 - e * 0.5],
        };
      return {
        ...base,
        lean: e * 3,
        hip: [1, -14],
        ff: [11, 0],
        bf: [-9, 0],
        fh: [12 + e * 10, -31],
        bh: [10 + e * 10, -27],
      };
    }
    case "degat":
      return { ...base, lean: -3.5, ff: [4, 0], bf: [-7, 0], fh: [2, -23], bh: [-3, -21] };
    case "ko":
      return { ...base, lean: -2, ff: [5, 0], bf: [-5, 0], fh: [4, -20], bh: [-4, -20] };
    default:
      return base;
  }
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x) * U, Math.round(y) * U, Math.round(w) * U, Math.round(h) * U);
}

/** Segment épais en « gros pixels » entre deux points (en unités). */
function membre(
  ctx: CanvasRenderingContext2D,
  a: P,
  b: P,
  ep: number,
  c: string,
  c2?: string,
): void {
  const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.5));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = a[0] + (b[0] - a[0]) * k - ep / 2;
    const y = a[1] + (b[1] - a[1]) * k - ep / 2;
    rect(ctx, x, y, ep, ep, c);
    if (c2) rect(ctx, x + ep - 1, y, 1, ep, c2);
  }
}

const milieuGenou = (h: P, f: P, avant: number): P => [
  (h[0] + f[0]) / 2 + avant,
  (h[1] + f[1]) / 2,
];

export function dessinerCombattantPixel(
  ctx: CanvasRenderingContext2D,
  o: {
    x: number;
    y: number;
    face: 1 | -1;
    genre: Genre;
    pose: PoseCombat;
    progres: number;
    marche: number;
    temps: number;
    /** Couleur néon de l'équipe (liseré). */
    neon: string;
    blanc?: boolean;
  },
): void {
  const { genre, pose } = o;
  const w = (c: string) => (o.blanc ? "#ffffff" : c);
  const sq = squelette(pose, o.progres, o.marche, o.temps, genre);
  ctx.save();
  ctx.translate(Math.round(o.x), Math.round(o.y));
  if (pose === "ko") ctx.rotate((-o.face * Math.PI) / 2.1);
  ctx.scale(o.face, 1);

  const hip = sq.hip;
  const sh: P = [sq.lean + 1, hip[1] - 13];
  const head: P = [sq.lean + (pose === "degat" ? -1 : 2), sh[1] - 7];

  if (genre === 0) {
    // ───────── Ninja ─────────
    const SUIT = w("#1a2236");
    const SUIT2 = w("#2a3856");
    const CYAN = w(o.neon);
    const PEAU = w("#f3cdb0");
    const HAIR = w("#3f63ff");
    const HAIR2 = w("#7fa3ff");
    const BOOT = w("#2a56e8");
    // Queue de cheval (derrière)
    const qx = Math.sin(o.temps * 5) * 1.5;
    membre(ctx, [head[0] - 4, head[1] - 4], [head[0] - 11 + qx, head[1] + 1], 3, HAIR);
    membre(ctx, [head[0] - 11 + qx, head[1] + 1], [head[0] - 14 + qx, head[1] + 7], 2, HAIR2);
    // Fourreau dans le dos
    membre(ctx, [sh[0] - 3, sh[1] + 3], [sh[0] - 11, sh[1] - 6], 2, w("#0f1422"));
    // Bras arrière
    membre(ctx, [sh[0] - 2, sh[1] + 1], milieuGenou(sh, sq.bh, 0) as P, 3, SUIT2);
    membre(ctx, milieuGenou(sh, sq.bh, 0) as P, sq.bh, 3, SUIT);
    rect(ctx, sq.bh[0] - 1, sq.bh[1] - 1, 3, 3, PEAU);
    // Jambe arrière
    const kb = milieuGenou(hip, sq.bf, -1.5);
    membre(ctx, [hip[0] - 1, hip[1]], kb, 5, SUIT2);
    membre(ctx, kb, [sq.bf[0], sq.bf[1] - 3], 4, SUIT);
    rect(ctx, sq.bf[0] - 3, sq.bf[1] - 3, 7, 3, BOOT);
    // Torse
    membre(ctx, hip, [sh[0], sh[1] + 2], 8, SUIT, SUIT2);
    rect(ctx, sh[0] + 2, sh[1] + 2, 2, 10, CYAN);
    rect(ctx, hip[0] - 4, hip[1] - 2, 9, 2, w("#2a56e8"));
    // Jambe avant
    const kf = milieuGenou(hip, sq.ff, 2.5);
    membre(ctx, [hip[0] + 1, hip[1]], kf, 5, SUIT2);
    membre(ctx, kf, [sq.ff[0], sq.ff[1] - 3], 4, SUIT, CYAN);
    rect(ctx, sq.ff[0] - 3, sq.ff[1] - 3, 8, 3, BOOT);
    // Tête
    rect(ctx, head[0] - 5, head[1] - 5, 10, 10, PEAU);
    rect(ctx, head[0] - 6, head[1] - 7, 12, 5, HAIR);
    rect(ctx, head[0] - 6, head[1] - 7, 5, 8, HAIR);
    rect(ctx, head[0] + 1, head[1] - 4, 5, 2, HAIR2);
    rect(ctx, head[0] + 2, head[1] - 1, 2, 3, w("#10162a"));
    rect(ctx, head[0] + 2, head[1] - 1, 1, 1, w("#8fe9ff"));
    // Bras avant + lame
    const coude = milieuGenou(sh, sq.fh, 0);
    membre(ctx, [sh[0] + 2, sh[1] + 1], coude, 3, SUIT2);
    membre(ctx, coude, sq.fh, 3, SUIT, CYAN);
    rect(ctx, sq.fh[0] - 1, sq.fh[1] - 1, 3, 3, PEAU);
    const dl = sq.lame;
    const n = Math.hypot(dl[0], dl[1]) || 1;
    const lx = sq.fh[0] + (dl[0] / n) * 17;
    const ly = sq.fh[1] + (dl[1] / n) * 17;
    membre(ctx, [sq.fh[0] - (dl[0] / n) * 3, sq.fh[1] - (dl[1] / n) * 3], sq.fh, 2, w("#101626"));
    membre(ctx, sq.fh, [lx, ly], 2, w("#d9ecff"), CYAN);
  } else {
    // ───────── Bagarreur ─────────
    const PEAU = w("#e3a070");
    const PEAU2 = w("#b97a4f");
    const ROUGE = w("#c9281f");
    const ROUGE2 = w("#8f1b17");
    const HAIR = w("#ff8a1f");
    const HAIR2 = w("#ffc15a");
    const BANDE = w("#f4f0e6");
    // Bras arrière
    const cb = milieuGenou(sh, sq.bh, 0.5);
    membre(ctx, [sh[0] - 3, sh[1] + 2], cb, 5, PEAU2);
    membre(ctx, cb, sq.bh, 5, PEAU2);
    rect(ctx, sq.bh[0] - 2, sq.bh[1] - 3, 5, 5, w("#6b4a2b"));
    // Jambe arrière
    const kb = milieuGenou(hip, sq.bf, -1.5);
    membre(ctx, [hip[0] - 1, hip[1]], kb, 7, ROUGE2);
    membre(ctx, kb, [sq.bf[0], sq.bf[1] - 3], 6, ROUGE2);
    rect(ctx, sq.bf[0] - 3, sq.bf[1] - 3, 8, 3, PEAU2);
    // Torse : épaules larges, pectoraux et abdos
    membre(ctx, hip, [sh[0], sh[1] + 2], 11, PEAU, PEAU2);
    rect(ctx, sh[0] - 5, sh[1] + 1, 6, 4, PEAU2);
    rect(ctx, sh[0] + 1, sh[1] + 1, 5, 4, PEAU2);
    rect(ctx, sh[0], sh[1] + 6, 1, 5, PEAU2);
    rect(ctx, sh[0] - 3, sh[1] + 7, 7, 1, PEAU2);
    rect(ctx, hip[0] - 6, hip[1] - 3, 13, 3, w("#12121a"));
    rect(ctx, hip[0] - 3, hip[1], 3, 7, w("#12121a"));
    // Jambe avant
    const kf = milieuGenou(hip, sq.ff, 2.5);
    membre(ctx, [hip[0] + 1, hip[1]], kf, 7, ROUGE, ROUGE2);
    membre(ctx, kf, [sq.ff[0], sq.ff[1] - 3], 6, ROUGE, ROUGE2);
    rect(ctx, sq.ff[0] - 3, sq.ff[1] - 3, 9, 3, PEAU);
    // Tête : cheveux en pointes, bandeau blanc, sourcils froncés
    rect(ctx, head[0] - 5, head[1] - 5, 11, 11, PEAU);
    rect(ctx, head[0] - 6, head[1] - 8, 13, 5, HAIR);
    for (let i = 0; i < 5; i++) rect(ctx, head[0] - 6 + i * 3, head[1] - 11 + (i % 2) * 2, 3, 4, HAIR);
    rect(ctx, head[0] - 2, head[1] - 9, 4, 2, HAIR2);
    rect(ctx, head[0] - 6, head[1] - 4, 13, 2, BANDE);
    const tq = Math.sin(o.temps * 6) * 1.5;
    membre(ctx, [head[0] - 6, head[1] - 3], [head[0] - 12, head[1] - 1 + tq], 2, BANDE);
    rect(ctx, head[0] + 1, head[1] - 1, 5, 1, w("#2a1810"));
    rect(ctx, head[0] + 2, head[1], 2, 2, w("#2a1810"));
    rect(ctx, head[0] + 1, head[1] + 3, 4, 1, PEAU2);
    // Bras avant
    const cf = milieuGenou(sh, sq.fh, 0.5);
    membre(ctx, [sh[0] + 4, sh[1] + 2], cf, 5, PEAU);
    membre(ctx, cf, sq.fh, 5, PEAU, PEAU2);
    rect(ctx, sq.fh[0] - 1, sq.fh[1] - 3, 6, 6, w("#6b4a2b"));
    rect(ctx, sq.fh[0], sq.fh[1] - 3, 2, 6, BANDE);
  }
  ctx.restore();
}

/** Croissant lumineux d'un coup spécial (violet → rose → blanc). */
export function arcLumineux(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  face: 1 | -1,
  progres: number,
  rayon = 78,
): void {
  const a = Math.min(1, Math.max(0, progres));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face, 1);
  ctx.globalCompositeOperation = "lighter";
  const fin = -0.2 + a * 1.1;
  for (const [ep, col] of [
    [16, "rgba(122,60,255,0.45)"],
    [9, "rgba(255,63,180,0.75)"],
    [4, "rgba(255,255,255,0.95)"],
  ] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = ep;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(-6, 20, rayon, -2.4, -2.4 + (fin + 2.4 + 0.4) * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}
