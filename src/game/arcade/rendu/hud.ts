import { r, texte } from "./pixel";

/** HUD « arcade néon » partagé par le combat et l'arène (cadres obliques, barres dégradées, chrono encadré). */

const CYAN = "#19e6ff";
const ROSE = "#ff3fb4";
const VIOLET = "#7a3cff";

function polygone(ctx: CanvasRenderingContext2D, pts: ReadonlyArray<readonly [number, number]>): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/** Cadre oblique (parallélogramme) : fond sombre, contour pixel et liseré néon. */
export function cadreOblique(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pente: number,
  neon: string,
  sens: 1 | -1 = 1,
): void {
  const p = sens * pente;
  const pts: Array<readonly [number, number]> = [
    [x + Math.max(0, p), y],
    [x + w + Math.min(0, p), y],
    [x + w - Math.max(0, p), y + h],
    [x - Math.min(0, p), y + h],
  ];
  ctx.save();
  polygone(ctx, pts);
  ctx.fillStyle = "rgba(8,10,26,0.88)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = neon;
  ctx.shadowColor = neon;
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.restore();
}

/** Barre de vie dégradée violet → rose, remplie de la gauche (ou de la droite). */
export function barreVie(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  k: number,
  traine: number,
  versGauche: boolean,
): void {
  r(ctx, x, y, w, h, "#12082a");
  const lt = w * Math.max(0, Math.min(1, traine));
  const lp = w * Math.max(0, Math.min(1, k));
  r(ctx, versGauche ? x + w - lt : x, y, lt, h, "#ffd9f0");
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  if (versGauche) {
    g.addColorStop(0, ROSE);
    g.addColorStop(1, VIOLET);
  } else {
    g.addColorStop(0, VIOLET);
    g.addColorStop(1, ROSE);
  }
  ctx.fillStyle = g;
  ctx.fillRect(Math.round(versGauche ? x + w - lp : x), y, Math.round(lp), h);
  r(ctx, versGauche ? x + w - lp : x, y + 1, lp, 2, "rgba(255,255,255,0.4)");
}

/** Chronomètre central : hexagone néon cyan avec un grand nombre. */
export function chronoHexagone(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  valeur: string,
  urgent: boolean,
): void {
  const neon = urgent ? "#ff6b6b" : CYAN;
  const pts: Array<readonly [number, number]> = [
    [cx - 22, cy - 24],
    [cx + 22, cy - 24],
    [cx + 38, cy],
    [cx + 22, cy + 24],
    [cx - 22, cy + 24],
    [cx - 38, cy],
  ];
  ctx.save();
  polygone(ctx, pts);
  ctx.fillStyle = "#070b1e";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = neon;
  ctx.shadowColor = neon;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  polygone(
    ctx,
    pts.map(([x, y]) => [cx + (x - cx) * 0.86, cy + (y - cy) * 0.86] as const),
  );
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = neon;
  ctx.shadowBlur = 8;
  texte(ctx, valeur, cx, cy + 1, valeur.length > 2 ? 24 : 30, urgent ? "#ff9b9b" : "#7ff3ff");
  ctx.restore();
}

export type FaceHud = {
  nom: string;
  pv: number;
  traine: number;
  special: number;
  specialPret: boolean;
  manchesGagnees: number;
  manchesTotal: number;
  /** Dessine le portrait dans le cadre (déjà clippé). */
  portrait: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
};

/** Un côté du HUD de combat : portrait encadré, nom, barre de vie, jauge spéciale cyan, manches. */
export function faceCombat(
  ctx: CanvasRenderingContext2D,
  f: FaceHud,
  gauche: boolean,
  largeur: number,
  etiquette: string,
): void {
  const px = gauche ? 6 : largeur - 6 - 44;
  // Portrait
  ctx.save();
  cadreOblique(ctx, px, 6, 44, 44, 0, gauche ? CYAN : "#ffb84d");
  ctx.beginPath();
  ctx.rect(px + 2, 8, 40, 40);
  ctx.clip();
  r(ctx, px + 2, 8, 40, 40, gauche ? "#16264f" : "#4a1a22");
  f.portrait(ctx, px + 2, 8, 40, 40);
  ctx.restore();

  const bx = gauche ? px + 52 : 400 + 46;
  const bw = 302;
  cadreOblique(ctx, bx - 4, 8, bw + 8, 22, 8, ROSE, gauche ? 1 : -1);
  barreVie(ctx, bx + 4, 12, bw - 8, 14, f.pv, f.traine, !gauche);
  texte(ctx, etiquette, gauche ? bx + 10 : bx + bw - 10, 19, 9, "#ffffff", gauche ? "left" : "right");
  // Jauge spéciale cyan, sous la barre de vie
  const sw = bw - 60;
  const sx = gauche ? bx + 40 : bx + 20;
  cadreOblique(ctx, sx - 2, 33, sw + 4, 10, 4, f.specialPret ? CYAN : "#2b4a66", gauche ? 1 : -1);
  r(ctx, sx + 2, 36, (sw - 4) * f.special, 4, f.specialPret ? "#7ff3ff" : "#1fb3cc");
  // Manches gagnées (petits ronds)
  for (let m = 0; m < f.manchesTotal; m++) {
    const cx = (gauche ? bx + 8 : bx + bw - 8) + (gauche ? 1 : -1) * m * 13;
    ctx.beginPath();
    ctx.arc(cx, 52, 4, 0, Math.PI * 2);
    ctx.fillStyle = m < f.manchesGagnees ? "#ffd166" : "#0b0f24";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = m < f.manchesGagnees ? "#fff3b0" : "#3b4a70";
    ctx.stroke();
  }
  // Icône d'état : spécial prêt
  const ix = gauche ? bx + 44 : bx + bw - 44 - 16;
  cadreOblique(ctx, ix, 47, 16, 12, 0, f.specialPret ? CYAN : "#33415f");
  r(ctx, ix + 5, 50, 6, 6, f.specialPret ? CYAN : "#33415f");
}

export type Carte = { nom: string; couleur: string; touche?: string; actif: boolean };

/** Cartes d'armes en bas au centre (arène) : arme équipée et arme de l'adversaire le plus proche. */
export function cartesArmes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bas: number,
  cartes: Array<{
    carte: Carte;
    sousTitre: string;
    icone: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  }>,
): void {
  const w = 74;
  const h = 34;
  const ecart = 8;
  const total = cartes.length * w + (cartes.length - 1) * ecart;
  cartes.forEach((c, i) => {
    const x = cx - total / 2 + i * (w + ecart);
    const y = bas - h - 14;
    cadreOblique(ctx, x, y, w, h, 0, c.carte.couleur);
    if (c.carte.actif) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      r(ctx, x, y, w, h, c.carte.couleur);
      ctx.restore();
    }
    c.icone(ctx, x + w / 2, y + h / 2);
    if (c.carte.touche) {
      cadreOblique(ctx, x - 10, y + 2, 12, 12, 0, "#6b7fd6");
      texte(ctx, c.carte.touche, x - 4, y + 8, 8, "#aab8ff");
    }
    texte(ctx, c.sousTitre, x + w / 2, bas - 5, 8, "#cfe9ff");
  });
}

/** Chrono trapézoïdal de l'arène avec le score d'équipe dessous (« TEAM BLUE 12 - TEAM RED 9 »). */
export function chronoTrapeze(
  ctx: CanvasRenderingContext2D,
  cx: number,
  valeur: string,
  urgent: boolean,
  scores: Array<{ nom: string; score: number; couleur: string }>,
): void {
  ctx.save();
  polygone(ctx, [
    [cx - 150, 0],
    [cx + 150, 0],
    [cx + 128, 40],
    [cx - 128, 40],
  ]);
  ctx.fillStyle = "rgba(6,12,30,0.9)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = CYAN;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.restore();
  texte(ctx, valeur, cx, 14, 22, urgent ? "#ff9b9b" : "#ffffff");
  const pas = 240 / scores.length;
  scores.forEach((s, i) => {
    const x = cx - 120 + pas * (i + 0.5);
    texte(ctx, `${s.nom} ${s.score}`, x, 32, 10, s.couleur);
  });
}
