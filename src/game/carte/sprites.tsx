import type { ReactNode } from "react";
import { nuance } from "./couleur";
import type { Objet } from "./types";

/** Tous les objets du décor sont dessinés ici en pixel art : mêmes contours, même lumière (en haut à gauche). */
const OL = "#2a1810";
const BOIS = "#c48a52",
  BOIS_F = "#8e5b33",
  BOIS_C = "#e0b27a",
  CREME = "#f3ead7",
  VERRE = "#a9dcef";

const rc = (x: number, y: number, w: number, h: number, f: string) => (
  <rect x={x} y={y} width={w} height={h} fill={f} />
);
/** Boîte avec contour, reflet en haut et ombre en bas. */
const bx = (x: number, y: number, w: number, h: number, f: string) => (
  <g>
    {rc(x, y, w, h, OL)}
    {rc(x + 1, y + 1, w - 2, h - 2, f)}
    {rc(x + 1, y + 1, w - 2, 1, nuance(f, 1.3))}
    {rc(x + 1, y + h - 2, w - 2, 1, nuance(f, 0.75))}
  </g>
);
const ombre = (W: number, H: number) => (
  <ellipse cx={W / 2} cy={H - 1} rx={W / 2 - 2} ry={1.5} fill="#000" opacity={0.18} />
);

type P = { W: number; H: number; o: Objet };

const Bureau = ({ W, H, o }: P, bois = o.c ?? BOIS) => (
  <>
    {ombre(W, H)}
    {bx(0, H - 14, W, 9, nuance(bois, 1.12))}
    {bx(1, H - 6, W - 2, 6, nuance(bois, 0.8))}
    {rc(2, H - 5, 1, 4, nuance(bois, 0.6))}
    {rc(W - 3, H - 5, 1, 4, nuance(bois, 0.6))}
  </>
);

const ART: Record<string, (p: P) => ReactNode> = {
  pcgamer: ({ W, H }) => (
    <>
      {ombre(W, H)}
      {bx(0, H - 14, W, 9, "#2b2250")}
      {bx(1, H - 6, W - 2, 6, "#1a1438")}
      {rc(2, H - 5, W - 4, 1, "#a35cff")}
      {bx(3, H - 30, W - 6, 15, "#17122e")}
      {rc(5, H - 28, W - 10, 11, "#5b2fd1")}
      {rc(5, H - 28, W - 10, 4, "#8a5cff")}
      {rc(7, H - 22, 8, 1, "#ffd166")}
      {rc(7, H - 20, 12, 1, "#4fd1c5")}
      {rc(W - 14, H - 24, 6, 5, "#ff5c8a")}
      {bx(W / 2 - 2, H - 15, 4, 2, "#17122e")}
      {bx(5, H - 13, W - 10, 3, "#1a1438")}
      {rc(6, H - 12, W - 12, 1, "#4fd1c5")}
      {rc(6, H - 11, W - 16, 1, "#ff5c8a")}
      {bx(W - 8, H - 12, 5, 3, "#a35cff")}
    </>
  ),
  poste: (p) => {
    const { W, H } = p;
    return (
      <>
        {Bureau(p)}
        {bx(W / 2 - 7, H - 29, 14, 12, "#3a5aa0")}
        {rc(W / 2 - 5, H - 27, 10, 7, "#8fe3d0")}
        {rc(W / 2 - 5, H - 27, 10, 1, "#c9f5ea")}
        {rc(W / 2 - 3, H - 25, 5, 1, "#2f8f86")}
        {rc(W / 2 - 3, H - 23, 3, 1, "#2f8f86")}
        {bx(W / 2 - 2, H - 17, 4, 3, "#3a5aa0")}
        {bx(W / 2 - 8, H - 13, 16, 3, CREME)}
        {bx(W - 8, H - 12, 5, 3, "#d9483b")}
      </>
    );
  },
  bureau: (p) => (
    <>
      {Bureau(p)}
      {rc(5, p.H - 12, 7, 4, "#fff")}
      {rc(5, p.H - 12, 7, 1, "#cfd8e8")}
      {rc(7, p.H - 11, 4, 1, "#7a8cc4")}
      {bx(p.W - 9, p.H - 13, 4, 4, "#e8a33d")}
    </>
  ),
  grandbureau: (p) => (
    <>
      {Bureau(p, "#7a4a2a")}
      {bx(p.W / 2 - 6, p.H - 12, 12, 3, "#f2c14e")}
      {bx(4, p.H - 20, 4, 8, "#2f9e5a")}
      {rc(3, p.H - 22, 6, 3, "#f2e6a0")}
      {rc(p.W - 12, p.H - 12, 7, 3, "#fff")}
    </>
  ),
  table: ({ W, H, o }) => (
    <>
      {ombre(W, H)}
      {bx(1, 3, W - 2, H - 10, nuance(o.c ?? BOIS, 1.1))}
      {bx(3, H - 8, W - 6, 5, nuance(o.c ?? BOIS, 0.7))}
      {bx(W / 2 - 8, 9, 7, 5, "#fff")}
      {bx(W / 2 + 2, 11, 5, 6, "#d9483b")}
      {rc(W / 2 - 5, 10, 3, 1, "#cfd8e8")}
    </>
  ),
  chaise: ({ W, H, o }) => (
    <>
      {ombre(W, H)}
      {bx(3, H - 14, 10, 4, nuance(o.c ?? "#d9483b", 1.1))}
      {bx(4, H - 20, 8, 7, o.c ?? "#d9483b")}
      {rc(4, H - 9, 1, 8, OL)}
      {rc(11, H - 9, 1, 8, OL)}
    </>
  ),
  casiers: ({ W, H, o }) => {
    const c = o.c ?? "#3b7bd1";
    return (
      <>
        {ombre(W, H)}
        {bx(1, 2, W - 2, H - 3, c)}
        {rc(8, 4, 1, H - 7, OL)}
        {rc(3, 6, 4, 1, nuance(c, 0.55))}
        {rc(10, 6, 4, 1, nuance(c, 0.55))}
        {rc(3, 8, 4, 1, nuance(c, 0.55))}
        {rc(10, 8, 4, 1, nuance(c, 0.55))}
        {rc(6, H / 2, 1, 4, "#f2c14e")}
        {rc(10, H / 2, 1, 4, "#f2c14e")}
        {rc(3, H - 10, 4, 5, nuance(c, 0.8))}
        {rc(10, H - 10, 4, 5, nuance(c, 0.8))}
      </>
    );
  },
  plante: ({ W, H }) => (
    <>
      {ombre(W, H)}
      {bx(4, H - 12, 8, 11, "#c4673a")}
      {rc(3, H - 13, 10, 2, "#8e3f1f")}
      {bx(1, H - 22, 7, 10, "#2f8a45")}
      {bx(8, H - 24, 7, 12, "#3f9e55")}
      {bx(4, H - 29, 8, 12, "#58b968")}
      {rc(6, H - 25, 2, 6, "#8fdc9a")}
      {rc(10, H - 20, 1, 5, "#8fdc9a")}
    </>
  ),
  canape: ({ W, H, o }) => {
    const c = o.c ?? "#d9483b";
    return (
      <>
        {ombre(W, H)}
        {bx(2, 1, W - 4, 8, nuance(c, 0.85))}
        {bx(0, 5, 6, H - 5, c)}
        {bx(W - 6, 5, 6, H - 5, c)}
        {bx(5, 7, W - 10, H - 8, nuance(c, 1.15))}
        {rc(W / 2, 8, 1, H - 10, nuance(c, 0.8))}
      </>
    );
  },
  comptoir: ({ W, H, o }) => (
    <>
      {ombre(W, H)}
      {bx(0, 1, W, 8, nuance(o.c ?? BOIS_C, 1.05))}
      {bx(0, 9, W, H - 9, nuance(o.c ?? BOIS, 0.85))}
      {Array.from({ length: Math.floor(W / 16) }, (_, i) => (
        <g key={i}>
          {rc(i * 16 + 3, 11, 10, H - 14, nuance(o.c ?? BOIS, 0.72))}
          {rc(i * 16 + 3, 11, 10, 1, nuance(o.c ?? BOIS, 1.1))}
        </g>
      ))}
      {bx(6, -1, 5, 4, "#fff")}
      {bx(W - 14, -2, 7, 5, "#e8a33d")}
    </>
  ),
  machinecafe: ({ W, H }) => (
    <>
      {ombre(W, H)}
      {bx(2, 2, 12, H - 3, "#b3402a")}
      {bx(4, 5, 8, 6, "#2a1810")}
      {rc(5, 6, 6, 1, "#8fe3d0")}
      {bx(4, 14, 8, 3, "#f2c14e")}
      {rc(6, 17, 4, 2, OL)}
      {bx(5, H - 10, 6, 6, "#fff")}
      {rc(6, H - 9, 4, 2, "#7a4a2a")}
    </>
  ),
  distributeur: ({ W, H }) => (
    <>
      {ombre(W, H)}
      {bx(1, 2, 14, H - 3, "#2f6fd1")}
      {bx(3, 5, 10, 16, VERRE)}
      {rc(4, 7, 3, 4, "#d9483b")}
      {rc(8, 7, 3, 4, "#f2c14e")}
      {rc(4, 13, 3, 4, "#2f9e5a")}
      {rc(8, 13, 3, 4, "#f4f4f4")}
      {rc(3, 23, 10, 1, "#f2c14e")}
      {bx(4, 25, 8, 4, "#1b3f7a")}
    </>
  ),
  frigo: ({ W, H }) => (
    <>
      {ombre(W, H)}
      {bx(2, 2, 12, H - 3, "#f1ead6")}
      {rc(2, 13, 12, 1, OL)}
      {rc(11, 5, 1, 6, nuance("#f1ead6", 0.6))}
      {rc(11, 16, 1, 8, nuance("#f1ead6", 0.6))}
      {rc(4, 4, 4, 3, "#e8a33d")}
    </>
  ),
  baie: ({ W, H }) => (
    <>
      {ombre(W, H)}
      {bx(1, 1, 14, H - 2, "#1f4a66")}
      {Array.from({ length: Math.floor((H - 6) / 5) }, (_, i) => (
        <g key={i}>
          {bx(3, 3 + i * 5, 10, 4, "#2f6a8a")}
          {rc(10, 4 + i * 5, 1, 1, i % 3 ? "#5dde7a" : "#f2c14e")}
          {rc(11, 4 + i * 5, 1, 1, i % 2 ? "#5dde7a" : "#d9483b")}
        </g>
      ))}
    </>
  ),
  etagere: ({ W, H }) => (
    <>
      {ombre(W, H)}
      {bx(0, 2, W, H - 3, BOIS_F)}
      {[0, 1, 2].map((r) => (
        <g key={r}>
          {rc(2, 4 + r * 9, W - 4, 8, nuance(BOIS_F, 0.6))}
          {Array.from({ length: Math.floor((W - 6) / 3) }, (_, i) =>
            rc(
              3 + i * 3,
              5 + r * 9 + ((i + r) % 3),
              2,
              7 - ((i + r) % 3),
              ["#d9483b", "#2f6fd1", "#f2c14e", "#2f9e5a", "#8b5fbf"][(i + r * 2) % 5]!,
            ),
          )}
        </g>
      ))}
    </>
  ),
  armoire: ({ W, H, o }) => (
    <>
      {ombre(W, H)}
      {bx(1, 2, 14, H - 3, o.c ?? BOIS)}
      {rc(8, 4, 1, H - 7, OL)}
      {rc(6, H / 2, 1, 4, "#f2c14e")}
      {rc(10, H / 2, 1, 4, "#f2c14e")}
      {rc(3, 5, 4, 8, nuance(o.c ?? BOIS, 0.85))}
      {rc(10, 5, 4, 8, nuance(o.c ?? BOIS, 0.85))}
    </>
  ),
  banc: ({ W, H }) => (
    <>
      {ombre(W, H)}
      {bx(1, 4, W - 2, 6, BOIS)}
      {rc(3, 10, 2, 5, OL)}
      {rc(W - 5, 10, 2, 5, OL)}
      {rc(2, 5, W - 4, 1, BOIS_C)}
    </>
  ),
  tapis: ({ W, H, o }) => (
    <>
      {rc(0, 0, W, H, nuance(o.c ?? "#a8322b", 0.7))}
      {rc(1, 1, W - 2, H - 2, o.c ?? "#a8322b")}
      {rc(3, 3, W - 6, H - 6, nuance(o.c ?? "#a8322b", 1.18))}
      {rc(4, 4, W - 8, H - 8, o.c2 ?? "#f2c14e")}
      {rc(5, 5, W - 10, H - 10, o.c ?? "#a8322b")}
    </>
  ),
  lavabo: ({ W, H }) => (
    <>
      {ombre(W, H)}
      {bx(0, H - 15, W, 14, BOIS_C)}
      {bx(2, H - 16, 12, 6, "#f4f0e4")}
      {rc(7, H - 22, 2, 6, "#5aa6c8")}
      {rc(5, H - 23, 6, 2, "#5aa6c8")}
      {rc(0, H - 5, W, 4, nuance(BOIS_C, 0.8))}
    </>
  ),
  cabine: ({ W, H, o }) => (
    <>
      {ombre(W, H)}
      {bx(1, 2, 14, H - 5, o.c ?? "#5aa6c8")}
      {bx(3, 5, 10, H - 12, nuance(o.c ?? "#5aa6c8", 1.15))}
      {rc(11, H / 2 - 1, 2, 3, "#f2c14e")}
      {rc(1, H - 3, 14, 2, OL)}
    </>
  ),
  poubelle: ({ W, H, o }) => (
    <>
      {ombre(W, H)}
      {bx(4, 5, 8, 10, o.c ?? "#3f9a4a")}
      {bx(3, 3, 10, 3, nuance(o.c ?? "#3f9a4a", 1.2))}
      {rc(7, 8, 2, 4, nuance(o.c ?? "#3f9a4a", 0.7))}
    </>
  ),
  imprimante: ({ W, H }) => (
    <>
      {ombre(W, H)}
      {bx(2, 6, 12, 8, CREME)}
      {rc(4, 3, 8, 4, "#fff")}
      {rc(4, 10, 8, 2, "#2f6fd1")}
    </>
  ),
  tableau: ({ W, H }) => (
    <>
      {bx(2, 5, W - 4, H - 18, "#f6f1e0")}
      {rc(3, 6, W - 6, 1, "#fff")}
      {rc(7, 10, 14, 1, "#2f6fd1")}
      {rc(7, 14, 22, 1, "#d9483b")}
      {rc(7, 18, 10, 1, "#2f6fd1")}
      {rc(W - 22, 12, 12, 8, "#8fe3d0")}
      {bx(W / 2 - 10, H - 13, 20, 3, BOIS_F)}
      {rc(W / 2 - 6, H - 15, 4, 2, "#d9483b")}
    </>
  ),
  fenetre: ({ W, H }) => (
    <>
      {bx(2, 3, W - 4, H - 6, BOIS_C)}
      {rc(4, 5, W - 8, H - 10, "#7fc4e8")}
      {rc(4, 5, W - 8, (H - 10) / 2, "#a9dcef")}
      {rc(W / 2 - 1, 5, 2, H - 10, BOIS_C)}
      {rc(4, H / 2 - 1, W - 8, 2, BOIS_C)}
      {rc(5, 6, 3, 1, "#fff")}
      {bx(0, H - 5, W, 3, nuance(BOIS_C, 0.9))}
    </>
  ),
  horloge: ({ W, H }) => (
    <>
      <circle cx={W / 2} cy={H / 2} r={6} fill={OL} />
      <circle cx={W / 2} cy={H / 2} r={5} fill="#fff8e6" />
      <rect x={W / 2 - 0.5} y={H / 2 - 4} width={1} height={4} fill={OL} />
      <rect x={W / 2} y={H / 2} width={3} height={1} fill={OL} />
    </>
  ),
  affiche: ({ W, H, o }) => (
    <>
      {bx(3, 4, W - 6, H - 10, o.c ?? "#f6f1e0")}
      {rc(5, 7, W - 10, 3, o.c2 ?? "#2f6fd1")}
      {rc(5, 12, W - 10, 1, o.c2 ?? "#2f6fd1")}
      {rc(5, 15, W - 14, 1, o.c2 ?? "#2f6fd1")}
      {o.v === "reseau" && (
        <>
          {rc(6, 18, 3, 3, "#d9483b")}
          {rc(11, 18, 3, 3, "#2f9e5a")}
          {rc(9, 15, 1, 3, OL)}
        </>
      )}
    </>
  ),
  planete: ({ W, H, o }) => (
    <>
      {bx(2, 3, W - 4, H - 8, "#1b2a52")}
      {[
        [4, 6],
        [12, 9],
        [6, 17],
        [11, 19],
      ].map(([x, y], i) => rc(x!, y!, 1, 1, "#fff"))}
      <circle cx={W / 2} cy={H / 2 - 1} r={5} fill={OL} />
      <circle cx={W / 2} cy={H / 2 - 1} r={4} fill={o.c ?? "#d9483b"} />
      <circle cx={W / 2 - 1} cy={H / 2 - 2} r={1.5} fill={nuance(o.c ?? "#d9483b", 1.4)} />
      {o.v === "anneau" && <rect x={W / 2 - 8} y={H / 2} width={16} height={2} fill="#f2c14e" />}
      {o.v === "soleil" &&
        [
          [-8, -1],
          [7, -1],
          [-1, -8],
          [-1, 6],
        ].map(([x, y], i) => rc(W / 2 + x!, H / 2 + y!, 2, 2, "#f2c14e"))}
    </>
  ),
  ecranmur: ({ W, H }) => (
    <>
      {bx(2, 4, W - 4, H - 14, "#fff8e6")}
      {rc(6, 8, 18, 1, "#2f6fd1")}
      {rc(6, 12, 28, 1, "#d9483b")}
      {rc(6, 16, 14, 1, "#2f6fd1")}
      {rc(W - 22, 8, 14, 10, "#8fe3d0")}
      {rc(W / 2 - 1, H - 10, 2, 6, OL)}
    </>
  ),
  panneau: ({ W, H }) => (
    <>
      {bx(1, 5, W - 2, H - 12, "#c98d5f")}
      {rc(5, 9, 7, 7, "#fff")}
      {rc(15, 8, 7, 8, "#f2c14e")}
      {rc(W - 12, 10, 7, 6, "#8fe3d0")}
      {rc(7, 8, 1, 1, "#d9483b")}
      {rc(17, 7, 1, 1, "#d9483b")}
    </>
  ),
  logo: ({ W, H }) => (
    <>
      {bx(2, 6, W - 4, H - 16, "#2b4b9a")}
      {rc(4, H - 14, W - 8, 2, "#e07a2b")}
      <text
        x={W / 2}
        y={H / 2 - 1}
        textAnchor="middle"
        fontFamily="'Press Start 2P', monospace"
        fontSize={8}
        fill="#fff"
      >
        ISITECH
      </text>
    </>
  ),
  ascenseur: ({ W, H }) => (
    <>
      {bx(1, 1, W - 2, H - 2, "#7fb0d9")}
      {rc(W / 2, 3, 1, H - 6, OL)}
      {bx(2, 3, W / 2 - 2, H - 7, "#a9d0ee")}
      {bx(W / 2 + 1, 3, W / 2 - 3, H - 7, "#a9d0ee")}
      {bx(W - 5, H / 2 - 4, 3, 6, "#f2c14e")}
      {rc(W / 2 - 2, 0, 4, 2, "#d9483b")}
    </>
  ),
  entree: ({ W, H }) => (
    <>
      {bx(1, 1, W - 2, H - 2, "#8e5b33")}
      {bx(3, 3, W - 6, H - 6, VERRE)}
      {rc(W / 2, 3, 1, H - 6, "#8e5b33")}
      {rc(4, 5, 3, 1, "#fff")}
      {rc(W - 7, H / 2, 2, 5, "#f2c14e")}
    </>
  ),
  fleche: ({ W, H }) => (
    <polygon
      points={`2,${H / 2 - 4} ${W - 8},${H / 2 - 4} ${W - 8},${H / 2 - 9} ${W - 1},${H / 2} ${W - 8},${H / 2 + 9} ${W - 8},${H / 2 + 4} 2,${H / 2 + 4}`}
      fill="#d9483b"
      stroke={OL}
      strokeWidth={1}
    />
  ),
  porteH: ({ W, H, o }) => (
    <>
      {bx(1, 2, W - 2, 8, "#2b4b9a")}
      {rc(3, 3, W - 6, 1, "#4f74c9")}
      {bx(4, 11, W - 8, H - 11, o.c ?? BOIS)}
      {rc(W / 2, 13, 1, H - 14, OL)}
      {rc(6, 14, W / 2 - 8, H - 18, nuance(o.c ?? BOIS, 1.18))}
      {rc(W / 2 + 3, 14, W / 2 - 8, H - 18, nuance(o.c ?? BOIS, 1.18))}
      {rc(W / 2 - 3, H / 2 + 4, 2, 3, "#f2c14e")}
      {rc(W / 2 + 2, H / 2 + 4, 2, 3, "#f2c14e")}
    </>
  ),
  porteV: ({ W, H, o }) => (
    <>
      {bx(1, 1, W - 2, H - 2, o.c ?? BOIS)}
      {bx(3, 3, W - 6, H - 6, nuance(o.c ?? BOIS, 1.15))}
      {rc(W - 6, H / 2, 2, 4, "#f2c14e")}
    </>
  ),
  clim: ({ W, H }) => (
    <>
      {bx(2, 6, W - 4, H - 16, "#f1ead6")}
      {Array.from({ length: 4 }, (_, i) => rc(5, 9 + i * 2, W - 10, 1, nuance("#f1ead6", 0.7)))}
    </>
  ),
  miroir: ({ W, H }) => (
    <>
      {bx(2, 4, W - 4, H - 10, BOIS_C)}
      {rc(4, 6, W - 8, H - 14, "#c8ecf8")}
      {rc(5, 7, 2, 5, "#fff")}
    </>
  ),
  lampadaire: ({ W, H }) => (
    <>
      {ombre(W, H)}
      {rc(7, 10, 2, H - 13, OL)}
      {bx(4, H - 4, 8, 3, BOIS_F)}
      <polygon points={`3,10 13,10 11,3 5,3`} fill="#f2c14e" stroke={OL} strokeWidth={1} />
    </>
  ),
  tableauHeros: ({ W, H }) => (
    <>
      {bx(1, 5, W - 2, H - 10, "#7a4a2a")}
      {bx(4, 8, W - 8, H - 17, "#1f5a3a")}
      <polygon
        points={`${W / 2 - 5},${H / 2 - 5} ${W / 2 + 5},${H / 2 - 5} ${W / 2 + 3},${H / 2 + 2} ${W / 2 - 3},${H / 2 + 2}`}
        fill="#f2c14e"
        stroke={OL}
        strokeWidth={1}
      />
      {rc(W / 2 - 1, H / 2 + 2, 2, 3, "#f2c14e")}
      {rc(W / 2 - 4, H / 2 + 5, 8, 2, "#b8841a")}
    </>
  ),
};

export function Sprite({ o }: { o: Objet }) {
  const W = o.w * 16,
    H = (o.h + o.hh + o.hb) * 16;
  const f = ART[o.kind];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      style={{ display: "block", imageRendering: "pixelated" }}
    >
      {f ? f({ W, H, o }) : null}
    </svg>
  );
}
