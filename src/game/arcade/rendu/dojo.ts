import { hash, r } from "./pixel";

/** Décor du dojo néon du combat 2D : plancher en lattes de bois, piliers sombres, cloisons, panneaux néon, lanternes. */

export const DOJO_L = 800;
export const DOJO_H = 480;
/** Ligne du plancher (haut du sol en bois). */
export const DOJO_SOL_Y = 327;
/** Lanternes suspendues (x, y du centre, rayon de halo). */
export const LANTERNES_DOJO: ReadonlyArray<{ x: number; y: number; t: number }> = [
  { x: 193, y: 126, t: 1.25 },
  { x: 253, y: 160, t: 1 },
  { x: 316, y: 189, t: 0.8 },
  { x: 455, y: 186, t: 0.8 },
  { x: 474, y: 186, t: 0.8 },
  { x: 626, y: 186, t: 0.8 },
  { x: 650, y: 186, t: 0.8 },
];

function neon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  col: string,
  fond: string,
  flou = 10,
): void {
  ctx.save();
  ctx.fillStyle = fond;
  ctx.fillRect(x, y, w, h);
  ctx.shadowColor = col;
  ctx.shadowBlur = flou;
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.restore();
}

/** Gribouillis façon idéogrammes lumineux. */
export function glyphes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  col: string,
  graine: number,
): void {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 3;
  ctx.shadowColor = col;
  ctx.shadowBlur = 6;
  ctx.lineCap = "square";
  for (let i = 0; i < 9; i++) {
    const a = hash(graine + i * 7);
    const b = hash(graine + i * 11 + 3);
    const c = hash(graine + i * 13 + 5);
    ctx.beginPath();
    ctx.moveTo(x + a * w, y + b * h);
    ctx.lineTo(x + (a + (c - 0.5) * 0.7) * w, y + (b + (hash(graine + i) - 0.4) * 0.5) * h);
    ctx.stroke();
  }
  ctx.restore();
}

function lanterne(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const w = 16 * t;
  const h = 24 * t;
  r(ctx, x - 1, 0, 2, y - h / 2, "#1a1010");
  r(ctx, x - w / 2 - 1, y - h / 2 - 3, w + 2, 4, "#2a1810");
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, "#c2561a");
  g.addColorStop(0.5, "#ffb04d");
  g.addColorStop(1, "#d86a1e");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(90,30,0,0.7)";
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(i) * w * 0.25 + 1, h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  r(ctx, x - w / 2 + 2, y - 3, w - 4, 6, "rgba(255,240,200,0.5)");
  r(ctx, x - w / 2 - 1, y + h / 2 - 1, w + 2, 3, "#2a1810");
}

function pilier(ctx: CanvasRenderingContext2D, x: number, w: number, haut: number): void {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, "#1c1216");
  g.addColorStop(0.35, "#3a2528");
  g.addColorStop(1, "#150d12");
  ctx.fillStyle = g;
  ctx.fillRect(x, haut, w, DOJO_SOL_Y - haut + 10);
  r(ctx, x + w * 0.35, haut, 2, DOJO_SOL_Y - haut, "rgba(255,160,120,0.14)");
  // Socle
  r(ctx, x - 10, DOJO_SOL_Y - 40, w + 20, 52, "#120b10");
  r(ctx, x - 10, DOJO_SOL_Y - 40, w + 20, 3, "#33222a");
  // Chapiteau
  r(ctx, x - 6, haut, w + 12, 8, "#201418");
}

export function dessinerDojo(ctx: CanvasRenderingContext2D): void {
  // Mur du fond
  const mur = ctx.createLinearGradient(0, 0, 0, DOJO_SOL_Y);
  mur.addColorStop(0, "#080d22");
  mur.addColorStop(0.55, "#161236");
  mur.addColorStop(1, "#231640");
  ctx.fillStyle = mur;
  ctx.fillRect(0, 0, DOJO_L, DOJO_SOL_Y + 4);

  // Poutre du plafond et néons obliques
  r(ctx, 0, 0, DOJO_L, 26, "#0b0a18");
  r(ctx, 0, 26, DOJO_L, 3, "#2a1a30");
  ctx.save();
  ctx.lineCap = "round";
  for (const [x0, y0, x1, y1, col, lw] of [
    [255, 0, 362, 162, "#19e6ff", 5],
    [292, 0, 386, 150, "rgba(25,230,255,0.45)", 10],
    [470, 0, 500, 78, "#ff3fb4", 3],
    [0, 40, 90, 6, "#19e6ff", 3],
    [560, 0, 640, 40, "#19e6ff", 3],
  ] as const) {
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();

  // Couloir de gauche : écran cyan géant avec calligraphie rose
  r(ctx, 0, 120, 190, 207, "#0a1226");
  neon(ctx, 70, 143, 114, 134, "#19e6ff", "#0a3a4e", 14);
  glyphes(ctx, 80, 155, 94, 110, "#ff4fb8", 11);
  glyphes(ctx, 84, 160, 88, 100, "#bff6ff", 23);
  neon(ctx, 0, 150, 48, 130, "#19b8d6", "#0b2c3e", 8);
  glyphes(ctx, 4, 160, 40, 110, "#19e6ff", 41);
  neon(ctx, 253, 76, 44, 34, "#19e6ff", "#0a2a40", 10);
  glyphes(ctx, 258, 82, 34, 22, "#ffffff", 57);

  // Cloisons en bois quadrillées
  for (const [x, y, w, h] of [
    [190, 150, 90, 150],
    [360, 95, 135, 140],
  ] as const) {
    r(ctx, x, y, w, h, "#171024");
    ctx.strokeStyle = "#4a2f2a";
    ctx.lineWidth = 2;
    for (let i = 0; i <= w; i += 18) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i, y + h);
      ctx.stroke();
    }
    for (let j = 0; j <= h; j += 18) {
      ctx.beginPath();
      ctx.moveTo(x, y + j);
      ctx.lineTo(x + w, y + j);
      ctx.stroke();
    }
    r(ctx, x + 2, y + 2, w - 4, h - 4, "rgba(30,20,60,0.45)");
  }

  // Enseignes : rose vertical, grand écran cyan, grande enseigne rose
  neon(ctx, 402, 99, 36, 84, "#ff3fb4", "#2a0c2a", 14);
  glyphes(ctx, 407, 106, 26, 70, "#ff9ad5", 71);
  neon(ctx, 500, 71, 128, 109, "#19e6ff", "#08354a", 16);
  glyphes(ctx, 512, 84, 104, 84, "#bff6ff", 83);
  neon(ctx, 714, 80, 84, 71, "#ff3fb4", "#2a0c2a", 14);
  glyphes(ctx, 722, 90, 68, 52, "#ff9ad5", 97);
  neon(ctx, 750, 164, 46, 18, "#19e6ff", "#082a38", 8);

  // Piliers
  pilier(ctx, 137, 50, 64);
  pilier(ctx, 652, 22, 60);

  // Lanternes
  for (const l of LANTERNES_DOJO) lanterne(ctx, l.x, l.y, l.t);

  // Bandeau bas du mur
  r(ctx, 0, DOJO_SOL_Y - 8, DOJO_L, 8, "#1a0f14");
  r(ctx, 0, DOJO_SOL_Y - 8, DOJO_L, 2, "#4a2f2a");

  // ───── Plancher en lattes de bois, vu en perspective ─────
  const sol = ctx.createLinearGradient(0, DOJO_SOL_Y, 0, DOJO_H);
  sol.addColorStop(0, "#5a2f1c");
  sol.addColorStop(1, "#8a4a2a");
  ctx.fillStyle = sol;
  ctx.fillRect(0, DOJO_SOL_Y, DOJO_L, DOJO_H - DOJO_SOL_Y);
  const teintes = ["#7a4228", "#8c5230", "#6a381f", "#935a35", "#74401f"];
  let y = DOJO_SOL_Y;
  let k = 0;
  while (y < DOJO_H) {
    const hl = 8 + (y - DOJO_SOL_Y) * 0.09;
    const dec = hash(k * 3.1) * 90;
    const larg = 90 + (y - DOJO_SOL_Y) * 0.9;
    for (let x = -dec; x < DOJO_L; x += larg) {
      const t = teintes[Math.floor(hash(k * 19 + x * 0.013) * teintes.length)]!;
      r(ctx, x, y, larg - 1, hl - 1, t);
      r(ctx, x, y, larg - 1, 1, "rgba(255,200,150,0.15)");
      for (let g = 0; g < 3; g++)
        r(ctx, x + hash(k * 7 + g) * larg, y + 2 + g * (hl / 4), 18 + hash(g + k) * 24, 1, "rgba(60,25,10,0.35)");
    }
    r(ctx, 0, y + hl - 1, DOJO_L, 1, "#2a1208");
    y += hl;
    k++;
  }
  // Reflets néon sur le bois
  for (const [x, yy, rx, ry, col] of [
    [90, 372, 150, 26, "rgba(25,230,255,0.22)"],
    [330, 350, 80, 14, "rgba(255,63,180,0.18)"],
    [560, 360, 110, 16, "rgba(25,230,255,0.14)"],
    [700, 345, 90, 12, "rgba(255,63,180,0.14)"],
  ] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, yy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const vig = ctx.createLinearGradient(0, DOJO_SOL_Y, 0, DOJO_H);
  vig.addColorStop(0, "rgba(0,0,0,0.35)");
  vig.addColorStop(0.4, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, DOJO_SOL_Y, DOJO_L, DOJO_H - DOJO_SOL_Y);
}

/** Spectateurs cyber derrière la rambarde, à droite : ils lèvent le poing quand l'action s'intensifie. */
export function dessinerSpectateursDojo(
  ctx: CanvasRenderingContext2D,
  horloge: number,
  excitation: number,
  lent: boolean,
): void {
  const pers = lent ? 5 : 8;
  const tenues = ["#2a3140", "#3a2a4a", "#1f3a44", "#4a2a2a"];
  const cheveux = ["#ff3fb4", "#19e6ff", "#2a1a1a", "#c9a24d", "#e8e8f0", "#3f63ff"];
  for (let i = 0; i < pers; i++) {
    const x = 592 + i * (lent ? 42 : 27);
    const saute = excitation > 0.05 ? Math.abs(Math.sin(horloge * 8 + i * 1.7)) * 8 * excitation : Math.sin(horloge * 1.4 + i) * 0.8;
    const base = 268 - saute;
    const larg = 22;
    r(ctx, x - larg / 2, base - 30, larg, 32, tenues[i % 4]!);
    r(ctx, x - larg / 2 - 3, base - 30, 6, 8, "#4a5568");
    r(ctx, x + larg / 2 - 3, base - 30, 6, 8, "#4a5568");
    r(ctx, x - 4, base - 18, 8, 2, i % 2 ? "#19e6ff" : "#ff3fb4");
    r(ctx, x - 7, base - 46, 14, 16, ["#e6b896", "#b98560", "#7a4e33"][i % 3]!);
    r(ctx, x - 8, base - 50, 16, 7, cheveux[i % cheveux.length]!);
    if (i % 3 === 0) r(ctx, x - 6, base - 40, 12, 3, "#19e6ff");
    if (excitation > 0.25) {
      r(ctx, x - 17, base - 44 - saute * 0.4, 5, 14, tenues[i % 4]!);
      r(ctx, x + 12, base - 44 - saute * 0.4, 5, 14, tenues[i % 4]!);
    }
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x - larg / 2, base + 2, larg, 4);
  }
  // Rambarde en bois
  r(ctx, 570, 268, 235, 6, "#6b3a1f");
  r(ctx, 570, 268, 235, 2, "#a8693a");
  r(ctx, 570, 300, 235, 5, "#5a2f19");
  for (let x = 574; x < 800; x += 38) r(ctx, x, 268, 5, 56, "#4a2813");
  r(ctx, 570, 322, 235, 3, "rgba(0,0,0,0.35)");
}
