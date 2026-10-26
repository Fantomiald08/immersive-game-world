import { useEffect, useState } from "react";
import type { Apparence, Direction } from "@/game/apparence";
import { nuance } from "@/game/carte/couleur";

/**
 * Personnage « chibi » façon jeux DS : grosse tête, petit corps, tous de la même taille.
 * Dessiné en pixel art (SVG 16×25) : 4 directions, marche à 4 images, couches personnalisables.
 */
const OL = "#2a1810";
const rc = (x: number, y: number, w: number, h: number, f: string) => (
  <rect x={x} y={y} width={w} height={h} fill={f} />
);
/** Boîte pixel arrondie avec contour. */
const pb = (x: number, y: number, w: number, h: number, f: string) => (
  <g>
    {rc(x, y - 1, w, h + 2, OL)}
    {rc(x - 1, y, w + 2, h, OL)}
    {rc(x, y, w, h, f)}
  </g>
);

export function Personnage({
  a,
  dir = "bas",
  marche = false,
  taille = 96,
  pseudo,
  niveau,
}: {
  a: Apparence;
  dir?: Direction;
  marche?: boolean;
  taille?: number;
  pseudo?: string;
  niveau?: number;
}) {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (!marche) {
      setF(0);
      return;
    }
    setF(1);
    const t = setInterval(() => setF((x) => (x + 1) % 4), 130);
    return () => clearInterval(t);
  }, [marche]);

  const cote = dir === "gauche" || dir === "droite";
  const dos = dir === "haut";
  const bob = f % 2 === 1 ? -1 : 0;
  const peauO = nuance(a.peau, 0.82);
  const hautO = nuance(a.hautCouleur, 0.8);
  const manches = a.haut === "tshirt";

  /* Jambes : une jambe se lève à chaque pas */
  const leve1 = f === 1 ? 1 : 0,
    leve2 = f === 3 ? 1 : 0;
  const o1 = f === 1 ? -2 : f === 3 ? 2 : 0;
  const jambeCouleur = a.bas === "jupe" || a.bas === "short" ? a.peau : a.basCouleur;
  const jambe = (x: number, lev: number, c: string, k: number) => (
    <g key={k}>
      {pb(x, 17, 3, 5 - lev, c)}
      {a.bas === "short" && rc(x, 17, 3, 2, a.basCouleur)}
      {a.bas === "jogging" && rc(x + 1, 18, 1, 3, nuance(a.basCouleur, 1.4))}
      {pb(x - 1, 21 - lev, 4, 2, a.chaussures)}
      {rc(x - 1, 21 - lev, 4, 1, nuance(a.chaussures, 1.25))}
    </g>
  );

  const flip = dir === "droite" ? "translate(16,0) scale(-1,1)" : undefined;

  return (
    <div
      className="relative inline-flex flex-col items-center"
      style={{ width: taille * (16 / 25) }}
    >
      {pseudo && (
        <div className="mb-1 whitespace-nowrap bg-background/85 px-1 font-pixel text-[8px] leading-tight text-primary">
          {pseudo}
          {niveau !== undefined && <span className="text-accent"> Nv{niveau}</span>}
        </div>
      )}
      <svg
        viewBox="0 0 16 25"
        width={taille * (16 / 25)}
        height={taille}
        shapeRendering="crispEdges"
        style={{ imageRendering: "pixelated", overflow: "visible" }}
      >
        <ellipse cx="8" cy="23.4" rx="5.5" ry="1.4" fill="#000" opacity="0.25" />
        <g transform={flip}>
          {/* Sac à dos côté : derrière le corps */}
          {a.accessoire === "sac" && cote && pb(10, 14 + bob, 3, 5, "#3a3a52")}
          {/* Jambes */}
          {cote ? (
            <>
              {jambe(7 - o1 / 2, leve2, nuance(jambeCouleur, 0.85), 1)}
              {jambe(6 + o1 / 2, leve1, jambeCouleur, 2)}
            </>
          ) : (
            <>
              {jambe(5, leve1, jambeCouleur, 1)}
              {jambe(8, leve2, nuance(jambeCouleur, 0.88), 2)}
            </>
          )}
          {a.bas === "jupe" && pb(cote ? 5 : 4, 17, cote ? 6 : 8, 3, a.basCouleur)}

          {/* Torse + bras */}
          <g transform={`translate(0,${bob})`}>
            {cote ? (
              <>
                {pb(5, 13, 6, 6, a.hautCouleur)}
                {rc(5, 17, 6, 2, hautO)}
                {a.haut === "sweat" && rc(6, 16, 3, 2, hautO)}
                {a.haut === "chemise" && rc(5, 13, 2, 1, "#fff")}
                {a.haut === "veste" && rc(5, 13, 1, 6, "#f4f4f4")}
              </>
            ) : (
              <>
                {pb(4, 13, 8, 6, a.hautCouleur)}
                {rc(4, 17, 8, 2, hautO)}
                {a.haut === "sweat" && !dos && (
                  <>
                    {rc(5, 13, 6, 1, nuance(a.hautCouleur, 1.3))}
                    {rc(6, 16, 4, 2, hautO)}
                  </>
                )}
                {a.haut === "chemise" && !dos && (
                  <>
                    {rc(6, 13, 4, 1, "#fff")}
                    {rc(8, 14, 1, 4, hautO)}
                  </>
                )}
                {a.haut === "veste" && !dos && (
                  <>
                    {rc(7, 13, 2, 6, "#f4f4f4")}
                    {rc(4, 13, 3, 6, nuance(a.hautCouleur, 0.9))}
                  </>
                )}
                {a.accessoire === "badge" && !dos && (
                  <>
                    {rc(9, 15, 2, 2, "#fff")}
                    {rc(10, 16, 1, 1, "#2f9e5a")}
                  </>
                )}
                {a.accessoire === "sac" && !dos && (
                  <>
                    {rc(5, 13, 1, 5, "#3a3a52")}
                    {rc(10, 13, 1, 5, "#3a3a52")}
                  </>
                )}
                {a.accessoire === "sac" && dos && pb(4, 13, 8, 6, "#3a3a52")}
              </>
            )}
            {/* Bras */}
            {cote ? (
              <g transform={`translate(${f === 1 ? -1 : f === 3 ? 1 : 0},0)`}>
                {pb(6, 14, 3, 4, manches ? a.hautCouleur : nuance(a.hautCouleur, 0.92))}
                {rc(6, 17, 3, 1, a.peau)}
              </g>
            ) : (
              <>
                {pb(
                  1,
                  14 + (f === 3 ? 1 : 0),
                  2,
                  4,
                  manches ? a.hautCouleur : nuance(a.hautCouleur, 0.92),
                )}
                {rc(1, 17 + (f === 3 ? 1 : 0), 2, 1, a.peau)}
                {pb(13, 14 + (f === 1 ? 1 : 0), 2, 4, manches ? hautO : nuance(a.hautCouleur, 0.8))}
                {rc(13, 17 + (f === 1 ? 1 : 0), 2, 1, peauO)}
              </>
            )}

            {/* Tête */}
            {cote ? pb(3, 3, 10, 10, a.peau) : pb(2, 3, 12, 10, a.peau)}
            {!dos && !cote && (
              <>
                {rc(4, 7, 2, 3, a.yeux)}
                {rc(10, 7, 2, 3, a.yeux)}
                {rc(4, 7, 1, 1, "#fff")}
                {rc(10, 7, 1, 1, "#fff")}
                {rc(7, 11, 2, 1, nuance(a.peau, 0.55))}
                {rc(3, 10, 2, 1, "#f0a090")}
                {rc(11, 10, 2, 1, "#f0a090")}
              </>
            )}
            {!dos && cote && (
              <>
                {rc(4, 7, 2, 3, a.yeux)}
                {rc(4, 7, 1, 1, "#fff")}
                {rc(3, 9, 1, 1, peauO)}
                {rc(4, 11, 2, 1, nuance(a.peau, 0.55))}
                {rc(5, 10, 1, 1, "#f0a090")}
              </>
            )}

            <Cheveux a={a} dir={dir} />

            {/* Accessoires de tête */}
            {a.accessoire === "lunettes" &&
              !dos &&
              (cote ? (
                <>
                  <rect
                    x="3.5"
                    y="7.5"
                    width="4"
                    height="3"
                    fill="none"
                    stroke={OL}
                    strokeWidth="1"
                  />
                  {rc(7, 8, 3, 1, OL)}
                </>
              ) : (
                <>
                  <rect
                    x="3.5"
                    y="7.5"
                    width="4"
                    height="3"
                    fill="none"
                    stroke={OL}
                    strokeWidth="1"
                  />
                  <rect
                    x="8.5"
                    y="7.5"
                    width="4"
                    height="3"
                    fill="none"
                    stroke={OL}
                    strokeWidth="1"
                  />
                  {rc(7, 8, 2, 1, OL)}
                </>
              ))}
            {a.accessoire === "casquette" && (
              <>
                {pb(cote ? 3 : 1, 2, cote ? 10 : 14, 4, "#d9483b")}
                {rc(cote ? 4 : 2, 3, 3, 1, "#f0847a")}
                {!dos && (cote ? rc(0, 5, 5, 2, "#a8352b") : rc(2, 6, 12, 1, "#a8352b"))}
              </>
            )}
            {a.accessoire === "casque" && (
              <>
                {rc(2, 2, 12, 1, "#2a2a40")}
                {!cote && (
                  <>
                    {pb(0, 7, 2, 4, "#2a2a40")}
                    {pb(14, 7, 2, 4, "#2a2a40")}
                  </>
                )}
                {cote && pb(7, 7, 3, 4, "#2a2a40")}
              </>
            )}
          </g>
        </g>
      </svg>
    </div>
  );
}

function Cheveux({ a, dir }: { a: Apparence; dir: Direction }) {
  const c = a.cheveux,
    cl = nuance(c, 1.25),
    cs = nuance(c, 0.8);
  const cote = dir === "gauche" || dir === "droite";
  const dos = dir === "haut";
  const frange =
    !dos && !cote ? (
      <>
        {rc(3, 6, 3, 1, c)}
        {rc(9, 6, 4, 1, c)}
        {rc(2, 6, 1, 3, c)}
        {rc(13, 6, 1, 3, c)}
      </>
    ) : null;
  if (cote) {
    const fond = (
      <>
        {rc(9, 6, 4, 5, c)}
        {rc(4, 5, 5, 1, c)}
      </>
    );
    switch (a.coiffure) {
      case "rase":
        return <>{pb(4, 3, 8, 2, nuance(c, 1.0))}</>;
      case "longue":
        return (
          <>
            {pb(3, 2, 10, 4, c)}
            {fond}
            {pb(9, 6, 4, 9, c)}
            {rc(4, 3, 3, 1, cl)}
          </>
        );
      case "herisse":
        return (
          <>
            {pb(3, 3, 10, 3, c)}
            {rc(3, 1, 2, 2, c)}
            {rc(6, 0, 2, 3, c)}
            {rc(9, 1, 2, 2, c)}
            {fond}
          </>
        );
      case "chignon":
        return (
          <>
            {pb(3, 2, 10, 4, c)}
            {fond}
            {pb(11, 0, 4, 3, c)}
            {rc(4, 3, 3, 1, cl)}
          </>
        );
      case "boucles":
        return (
          <>
            {pb(2, 2, 12, 5, c)}
            {fond}
            {rc(10, 7, 4, 4, c)}
            {rc(5, 1, 3, 2, c)}
            {rc(9, 1, 3, 2, c)}
          </>
        );
      default:
        return (
          <>
            {pb(3, 2, 10, 4, c)}
            {fond}
            {rc(4, 3, 3, 1, cl)}
          </>
        );
    }
  }
  if (dos) {
    switch (a.coiffure) {
      case "rase":
        return <>{pb(2, 3, 12, 5, c)}</>;
      case "longue":
        return (
          <>
            {pb(2, 2, 12, 13, c)}
            {rc(4, 4, 3, 1, cl)}
            {rc(8, 12, 1, 3, cs)}
          </>
        );
      case "herisse":
        return (
          <>
            {pb(2, 3, 12, 8, c)}
            {rc(2, 1, 2, 2, c)}
            {rc(5, 0, 2, 3, c)}
            {rc(8, 0, 2, 3, c)}
            {rc(11, 1, 2, 2, c)}
          </>
        );
      case "chignon":
        return (
          <>
            {pb(2, 2, 12, 9, c)}
            {pb(6, 0, 4, 3, c)}
            {rc(4, 4, 3, 1, cl)}
          </>
        );
      case "boucles":
        return (
          <>
            {pb(1, 2, 14, 9, c)}
            {rc(3, 1, 3, 2, c)}
            {rc(9, 1, 3, 2, c)}
          </>
        );
      default:
        return (
          <>
            {pb(2, 2, 12, 9, c)}
            {rc(4, 4, 3, 1, cl)}
            {rc(8, 9, 1, 2, cs)}
          </>
        );
    }
  }
  switch (a.coiffure) {
    case "rase":
      return <>{pb(3, 3, 10, 2, c)}</>;
    case "longue":
      return (
        <>
          {pb(2, 2, 12, 4, c)}
          {frange}
          {pb(1, 6, 2, 9, c)}
          {pb(13, 6, 2, 9, c)}
          {rc(4, 3, 3, 1, cl)}
        </>
      );
    case "herisse":
      return (
        <>
          {pb(2, 3, 12, 3, c)}
          {rc(2, 1, 2, 2, c)}
          {rc(5, 0, 2, 3, c)}
          {rc(8, 0, 2, 3, c)}
          {rc(11, 1, 2, 2, c)}
          {frange}
        </>
      );
    case "chignon":
      return (
        <>
          {pb(2, 2, 12, 4, c)}
          {pb(6, 0, 4, 3, c)}
          {frange}
          {rc(4, 3, 3, 1, cl)}
        </>
      );
    case "boucles":
      return (
        <>
          {pb(1, 2, 14, 5, c)}
          {rc(3, 1, 3, 2, c)}
          {rc(9, 1, 3, 2, c)}
          {rc(0, 5, 2, 3, c)}
          {rc(14, 5, 2, 3, c)}
          {rc(3, 7, 2, 1, c)}
        </>
      );
    default:
      return (
        <>
          {pb(2, 2, 12, 4, c)}
          {frange}
          {rc(4, 3, 3, 1, cl)}
        </>
      );
  }
}
