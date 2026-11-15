import type { TypeMonstre } from "@/game/carte/types";

const OL = "#2a1810";
const rc = (x: number, y: number, w: number, h: number, f: string) => (
  <rect x={x} y={y} width={w} height={h} fill={f} />
);
const pb = (x: number, y: number, w: number, h: number, f: string) => (
  <g>
    {rc(x, y - 1, w, h + 2, OL)}
    {rc(x - 1, y, w + 2, h, OL)}
    {rc(x, y, w, h, f)}
  </g>
);

/** Les 4 monstres de la salle serveur, dessinés dans le même style pixel art que les personnages. */
export function Monstre({ type, taille = 64 }: { type: TypeMonstre; taille?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={taille}
      height={taille}
      shapeRendering="crispEdges"
      style={{ imageRendering: "pixelated", overflow: "visible" }}
    >
      <ellipse cx="8" cy="15" rx="6" ry="1.3" fill="#000" opacity="0.25" />
      {type === "virus" && (
        <>
          {[
            [7, 0],
            [7, 11],
            [0, 6],
            [14, 6],
            [2, 2],
            [12, 2],
            [2, 11],
            [12, 11],
          ].map(([x, y], i) => rc(x!, y!, 2, 3, "#2f8a45"))}
          {pb(3, 3, 10, 9, "#58c46a")}
          {rc(4, 4, 4, 1, "#a9f0b4")}
          {rc(5, 6, 2, 3, "#fff")}
          {rc(9, 6, 2, 3, "#fff")}
          {rc(6, 7, 1, 2, OL)}
          {rc(10, 7, 1, 2, OL)}
          {rc(6, 10, 4, 1, OL)}
        </>
      )}
      {type === "malware" && (
        <>
          {rc(3, 0, 1, 3, OL)}
          {rc(12, 0, 1, 3, OL)}
          {rc(2, 0, 2, 1, "#d9483b")}
          {rc(12, 0, 2, 1, "#d9483b")}
          {pb(3, 3, 10, 8, "#8b5fbf")}
          {rc(4, 4, 8, 1, "#c4a3f0")}
          {rc(5, 6, 2, 2, "#ff4d4d")}
          {rc(9, 6, 2, 2, "#ff4d4d")}
          {rc(5, 9, 6, 1, OL)}
          {rc(6, 9, 1, 1, "#fff")}
          {rc(9, 9, 1, 1, "#fff")}
          {rc(1, 11, 2, 3, "#6b3fa0")}
          {rc(4, 12, 2, 2, "#6b3fa0")}
          {rc(10, 12, 2, 2, "#6b3fa0")}
          {rc(13, 11, 2, 3, "#6b3fa0")}
        </>
      )}
      {type === "bug" && (
        <>
          {rc(5, 0, 1, 3, OL)}
          {rc(10, 0, 1, 3, OL)}
          {pb(4, 2, 8, 4, "#e07a2b")}
          {rc(5, 3, 6, 1, "#f5b06a")}
          {pb(2, 6, 12, 7, "#d9483b")}
          {rc(3, 7, 10, 1, "#f08278")}
          {rc(7, 6, 2, 7, OL)}
          {rc(4, 9, 2, 2, OL)}
          {rc(10, 9, 2, 2, OL)}
          {rc(5, 3, 1, 1, "#fff")}
          {rc(10, 3, 1, 1, "#fff")}
          {rc(0, 8, 2, 1, OL)}
          {rc(0, 11, 2, 1, OL)}
          {rc(14, 8, 2, 1, OL)}
          {rc(14, 11, 2, 1, OL)}
        </>
      )}
      {type === "ransomware" && (
        <>
          <rect x="4" y="0.5" width="8" height="7" rx="3" fill="none" stroke={OL} strokeWidth="3" />
          <rect
            x="4"
            y="0.5"
            width="8"
            height="7"
            rx="3"
            fill="none"
            stroke="#f2c14e"
            strokeWidth="1.5"
          />
          {pb(2, 6, 12, 8, "#d9483b")}
          {rc(3, 7, 10, 1, "#f08278")}
          {rc(4, 9, 3, 2, "#fff")}
          {rc(9, 9, 3, 2, "#fff")}
          {rc(5, 9, 1, 2, OL)}
          {rc(10, 9, 1, 2, OL)}
          {rc(3, 8, 3, 1, OL)}
          {rc(10, 8, 3, 1, OL)}
          {rc(6, 12, 4, 1, OL)}
        </>
      )}
    </svg>
  );
}
