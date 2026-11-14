/** Petits outils de couleur partagés par les sprites et les sols. */
const lire = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const ecrire = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

/** Assombrit (f < 1) ou éclaircit (f > 1) une couleur. */
export const nuance = (hex: string, f: number) => {
  const [r, g, b] = lire(hex);
  return f <= 1
    ? ecrire(r * f, g * f, b * f)
    : ecrire(r + (255 - r) * (f - 1), g + (255 - g) * (f - 1), b + (255 - b) * (f - 1));
};
/** Mélange deux couleurs (t = 0 → a, t = 1 → b). */
export const melangeCouleur = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = lire(a),
    [r2, g2, b2] = lire(b);
  return ecrire(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
};
