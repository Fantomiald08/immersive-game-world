import { hash, r } from "./pixel";

/** Éléments visuels de l'arène à armes : soldat en armure, circuits néon au sol, anneaux de télégraphe, douilles et éclats. */

const PALETTES: Record<number, { sombre: string; clair: string; visiere: string }> = {
  0: { sombre: "#1f4fa8", clair: "#4da3ff", visiere: "#9be7ff" },
  1: { sombre: "#a82a3a", clair: "#ff6b6b", visiere: "#ffd0a0" },
  2: { sombre: "#2f8f55", clair: "#6ee7a0", visiere: "#d6ffd6" },
  3: { sombre: "#b8871f", clair: "#ffd166", visiere: "#fff2b0" },
};

/** Soldat vu de dessus en 3/4 : casque à visière, épaulières, plastron et jambes qui marchent. (x, y) = pieds. */
export function dessinerSoldat(
  ctx: CanvasRenderingContext2D,
  o: { x: number; y: number; fx: number; fy: number; equipe: number; marche: number; mv: boolean; blanc?: boolean },
): void {
  const pal = PALETTES[o.equipe] ?? PALETTES[0]!;
  const w = (c: string) => (o.blanc ? "#ffffff" : c);
  const arriere = o.fy < -0.55 && Math.abs(o.fx) < 0.7;
  const x = Math.round(o.x);
  const y = Math.round(o.y);
  const pas = o.mv ? Math.sin(o.marche * 1.7) : 0;
  // Jambes
  r(ctx, x - 7, y - 10 + pas * 2, 6, 10 - pas * 2, w("#1a2030"));
  r(ctx, x + 1, y - 10 - pas * 2, 6, 10 + pas * 2, w("#1a2030"));
  r(ctx, x - 8, y - 3 + pas * 2, 8, 3, w(pal.sombre));
  r(ctx, x, y - 3 - pas * 2, 8, 3, w(pal.sombre));
  // Sac à dos
  if (!arriere) r(ctx, x - 6 - Math.sign(o.fx) * 3, y - 24, 12, 8, w("#141a28"));
  // Torse
  r(ctx, x - 9, y - 25, 18, 16, w("#10141f"));
  r(ctx, x - 8, y - 24, 16, 14, w(pal.sombre));
  r(ctx, x - 8, y - 24, 16, 3, w(pal.clair));
  r(ctx, x - 2, y - 20, 4, 8, w("#141a28"));
  r(ctx, x - 1, y - 19, 2, 2, w(pal.visiere));
  // Épaulières
  r(ctx, x - 12, y - 25, 6, 8, w("#10141f"));
  r(ctx, x - 11, y - 24, 4, 6, w(pal.clair));
  r(ctx, x + 6, y - 25, 6, 8, w("#10141f"));
  r(ctx, x + 7, y - 24, 4, 6, w(pal.clair));
  // Casque
  r(ctx, x - 7, y - 36, 14, 13, w("#10141f"));
  r(ctx, x - 6, y - 35, 12, 11, w(pal.sombre));
  r(ctx, x - 6, y - 35, 12, 3, w(pal.clair));
  if (!arriere) {
    const vx = Math.round(o.fx * 3);
    r(ctx, x - 5 + vx, y - 31, 10, 5, w("#0a0e18"));
    r(ctx, x - 4 + vx, y - 30, 8, 3, w(pal.visiere));
  } else r(ctx, x - 2, y - 33, 4, 6, w("#10141f"));
}

/** Câbles et circuits imprimés néon gravés dans le sol (cyan et magenta), avec des nœuds lumineux. */
export function circuitsNeon(ctx: CanvasRenderingContext2D, L: number, H: number, graine: number): void {
  ctx.save();
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  for (let i = 0; i < 16; i++) {
    const col = i % 2 === 0 ? "25,230,255" : "255,63,180";
    let px = Math.round((hash(graine + i * 5) * (L - 120) + 60) / 8) * 8;
    let py = Math.round((hash(graine + i * 5 + 2) * (H - 120) + 60) / 8) * 8;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let k = 0; k < 4; k++) {
      const horiz = k % 2 === 0;
      const d = (Math.round(hash(graine + i * 13 + k) * 8) - 3) * 16;
      if (horiz) px = Math.max(24, Math.min(L - 24, px + d));
      else py = Math.max(24, Math.min(H - 24, py + d));
      ctx.lineTo(px, py);
    }
    ctx.strokeStyle = `rgba(${col},0.18)`;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${col},0.55)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    r(ctx, px - 3, py - 3, 7, 7, `rgba(${col},0.85)`);
  }
  // Lueurs d'ambiance : magenta à gauche, cyan à droite
  ctx.globalCompositeOperation = "lighter";
  for (const [x, y, rad, col] of [
    [L * 0.12, H * 0.4, 240, "rgba(255,40,170,0.16)"],
    [L * 0.88, H * 0.7, 260, "rgba(25,200,255,0.13)"],
    [L * 0.5, H * 0.95, 220, "rgba(120,60,255,0.1)"],
  ] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, col);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  ctx.restore();
}

/** Anneaux concentriques lumineux (cyan + magenta) autour d'une arme qui apparaît ou qui attend d'être ramassée. */
export function anneauxTelegraphe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  fermeture: number,
): void {
  ctx.save();
  ctx.translate(x, y + 6);
  ctx.scale(1, 0.82);
  const base = 34 + fermeture * 26;
  const pulse = Math.sin(t * 4) * 1.5;
  for (const [rad, col, lw, a] of [
    [base + 10 + pulse, "rgba(255,63,180,0.45)", 8, 1],
    [base + pulse, "#ff3fb4", 3, 1],
    [base - 8 + pulse, "rgba(25,230,255,0.55)", 8, 1],
    [base - 12 + pulse, "#19e6ff", 3, 1],
    [base - 20 + pulse, "#ff3fb4", 2, 0.9],
  ] as const) {
    ctx.globalAlpha = a;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(4, rad), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/* ───── Douilles au sol et éclats en étoile (état visuel par instance d'effets) ───── */
type Douille = { x: number; y: number; a: number; age: number };
type Etoile = { x: number; y: number; age: number; taille: number; couleur: string };
const DOUILLES = new WeakMap<object, Douille[]>();
const ETOILES = new WeakMap<object, Etoile[]>();

export function ajouterDouille(cle: object, x: number, y: number, rnd: number): void {
  const l = DOUILLES.get(cle) ?? [];
  l.push({ x: x + (rnd - 0.5) * 26, y: y + 8 + hash(rnd * 99) * 14, a: rnd * 6, age: 0 });
  if (l.length > 70) l.shift();
  DOUILLES.set(cle, l);
}
export function viderDouilles(cle: object): void {
  DOUILLES.delete(cle);
}
export function ajouterEtoile(cle: object, x: number, y: number, taille: number, couleur: string): void {
  const l = ETOILES.get(cle) ?? [];
  l.push({ x, y, age: 0, taille, couleur });
  if (l.length > 24) l.shift();
  ETOILES.set(cle, l);
}

export function dessinerDouilles(ctx: CanvasRenderingContext2D, cle: object, dt: number): void {
  const l = DOUILLES.get(cle);
  if (!l) return;
  for (let i = l.length - 1; i >= 0; i--) {
    const d = l[i]!;
    d.age += dt;
    if (d.age > 9) {
      l.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = Math.min(1, (9 - d.age) / 2.5);
    ctx.translate(d.x, d.y);
    ctx.rotate(d.a);
    r(ctx, -3, -1, 6, 3, "#c98a2a");
    r(ctx, -3, -1, 2, 3, "#ffd166");
    ctx.restore();
  }
}

export function dessinerEtoiles(ctx: CanvasRenderingContext2D, cle: object, dt: number): void {
  const l = ETOILES.get(cle);
  if (!l) return;
  for (let i = l.length - 1; i >= 0; i--) {
    const e = l[i]!;
    e.age += dt;
    if (e.age > 0.22) {
      l.splice(i, 1);
      continue;
    }
    const k = 1 - e.age / 0.22;
    const s = e.taille * (0.6 + 0.8 * (1 - k));
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = k;
    ctx.fillStyle = e.couleur;
    ctx.beginPath();
    for (let p = 0; p < 8; p++) {
      const a = (p / 8) * Math.PI * 2 + 0.3;
      const rad = p % 2 === 0 ? s : s * 0.28;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
