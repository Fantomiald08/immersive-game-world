import { melangeCouleur, nuance } from "./couleur";
import type { Sol } from "./types";

/** Motifs de sol dessinés en SVG pixel (32×32 px d'art = 2×2 cases), convertis en image de fond. */
const r = (x: number, y: number, w: number, h: number, f: string) =>
  `<rect x='${x}' y='${y}' width='${w}' height='${h}' fill='${f}'/>`;

function motif(s: Sol): string {
  const { type, c1, c2 } = s;
  let o = "";
  if (type === "parquet") {
    o += r(0, 0, 32, 32, c1);
    for (let i = 0; i < 4; i++) {
      const y = i * 8,
        dec = i % 2 ? 0 : 16;
      o += r(0, y, 32, 8, nuance(c1, i % 2 ? 0.95 : 1.05));
      o += r(0, y + 7, 32, 1, c2);
      o += r(dec, y, 1, 8, c2) + r((dec + 16) % 32, y, 1, 8, c2);
      o +=
        r((dec + 5) % 32, y + 3, 5, 1, nuance(c1, 0.88)) +
        r((dec + 21) % 32, y + 5, 4, 1, nuance(c1, 1.12));
    }
  } else if (type === "carrelage") {
    o += r(0, 0, 32, 32, c2);
    for (const [x, y, k] of [
      [0, 0, 1],
      [16, 0, 0.97],
      [0, 16, 0.97],
      [16, 16, 1],
    ] as const) {
      o += r(x + 1, y + 1, 15, 15, nuance(c1, k));
      o += r(x + 1, y + 1, 15, 1, nuance(c1, 1.18)) + r(x + 1, y + 15, 15, 1, nuance(c1, 0.88));
    }
  } else if (type === "damier") {
    for (const [x, y, c] of [
      [0, 0, c1],
      [16, 0, c2],
      [0, 16, c2],
      [16, 16, c1],
    ] as const) {
      o +=
        r(x, y, 16, 16, c) + r(x, y, 16, 1, nuance(c, 1.15)) + r(x, y + 15, 16, 1, nuance(c, 0.86));
    }
  } else if (type === "moquette") {
    o += r(0, 0, 32, 32, c1);
    for (const [x, y] of [
      [3, 2],
      [11, 6],
      [19, 3],
      [27, 8],
      [6, 13],
      [15, 17],
      [24, 14],
      [2, 22],
      [10, 27],
      [20, 24],
      [29, 29],
      [14, 10],
    ] as const)
      o += r(x, y, 2, 1, c2);
    o += r(0, 31, 32, 1, nuance(c1, 0.94));
  } else {
    o += r(0, 0, 32, 32, c1);
    for (const [x, y, w] of [
      [2, 3, 3],
      [12, 8, 2],
      [22, 5, 3],
      [6, 15, 2],
      [17, 19, 3],
      [27, 14, 2],
      [4, 26, 3],
      [24, 28, 2],
    ] as const) {
      o += r(x, y, w, 1, c2) + r(x + 1, y + 1, 1, 1, melangeCouleur(c1, "#ffffff", 0.35));
    }
    o += r(0, 0, 32, 1, nuance(c1, 0.92)) + r(0, 16, 32, 1, nuance(c1, 0.95));
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' shape-rendering='crispEdges'>${o}</svg>`;
}

export const fondSol = (s: Sol): string =>
  `url("data:image/svg+xml,${encodeURIComponent(motif(s))}")`;
