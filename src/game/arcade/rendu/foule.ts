import { hash, r, texte } from "./pixel";

/**
 * Public en pixel-art pour le fond de la course (dessiné une seule fois dans la bande en cache) :
 * rangées de spectateurs aux tenues colorées, bras levés avec des bâtons lumineux, et écrans de la foule.
 */

const TENUES = ["#ff3fb4", "#19e6ff", "#ffe14d", "#7a3cff", "#ff6b6b", "#6ee7a0", "#f4f4ff", "#2a2f4a", "#ff9a3c"];
const PEAUX = ["#f6d5b8", "#e0a97e", "#b97a4f", "#7a4e33", "#f0c8a0"];
const CHEVEUX = ["#1a1a24", "#3a2418", "#ffd166", "#ff3fb4", "#19e6ff", "#e8e8f4"];

/** Une personne en pixels (environ 7 × 12 px), bras levé optionnel avec bâton lumineux. */
export function personnePixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  graine: number,
  bras: boolean,
  lueur: boolean,
): void {
  const h = (k: number) => hash(graine * 13.7 + k);
  const tenue = TENUES[Math.floor(h(1) * TENUES.length)]!;
  const peau = PEAUX[Math.floor(h(2) * PEAUX.length)]!;
  const cheveux = CHEVEUX[Math.floor(h(3) * CHEVEUX.length)]!;
  // Corps et tête
  r(ctx, x - 3, y - 8, 7, 7, tenue);
  r(ctx, x - 2, y - 12, 5, 4, peau);
  r(ctx, x - 2, y - 13, 5, 2, cheveux);
  if (bras) {
    r(ctx, x - 4, y - 14, 2, 6, tenue);
    r(ctx, x + 3, y - 14, 2, 6, tenue);
    if (h(4) > 0.45) {
      const baton = h(5) > 0.5 ? "#19e6ff" : "#ff3fb4";
      r(ctx, x - 4, y - 21, 1, 7, baton);
      if (lueur) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        r(ctx, x - 5, y - 22, 3, 3, baton);
        ctx.restore();
      }
    }
  }
  // Jambes
  r(ctx, x - 3, y - 1, 2, 2, "#1a1a2c");
  r(ctx, x + 1, y - 1, 2, 2, "#1a1a2c");
}

/** Trois rangées de public sur toute la largeur du fond (coordonnées de la bande). */
export function dessinerFouleFond(ctx: CanvasRenderingContext2D, largeur: number, yBas: number): void {
  for (let rang = 0; rang < 3; rang++) {
    const y = yBas - rang * 12;
    // Bande lumineuse derrière chaque rangée
    ctx.fillStyle = rang % 2 ? "rgba(255,63,180,0.18)" : "rgba(25,230,255,0.16)";
    ctx.fillRect(0, y - 14, largeur, 3);
    for (let x = 0, k = rang * 1000; x < largeur; x += 6, k++) {
      const decal = hash(k * 0.37) * 2;
      personnePixel(ctx, x + decal, y, k, hash(k * 1.9) > 0.35, hash(k * 2.3) > 0.7);
    }
  }
  // Panneaux de foule et slogans aux abords de l'arène
  for (let x = 40; x < largeur; x += 260) {
    ctx.fillStyle = "rgba(10,20,40,0.85)";
    ctx.fillRect(x, yBas - 60, 70, 12);
    ctx.fillStyle = "#19e6ff";
    ctx.fillRect(x, yBas - 60, 70, 1);
    texte(ctx, "ISITECH", x + 35, yBas - 54, 8, "#bffaff");
  }
}
