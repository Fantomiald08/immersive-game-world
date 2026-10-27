import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import { Fenetre } from "./Fenetre";
import { interactions, LEGENDE } from "@/game/carte/interactions";
import { estMur } from "@/game/carte/moteur";
import type { Pt, SalleId, ZoneId } from "@/game/carte/types";
import { ZONES } from "@/game/carte/zones";
import type { Present } from "@/game/multijoueur";

/** Carte interactive de l'école (d'après le plan officiel) : où sont les gens, et tout ce avec quoi on peut interagir. */
const SALLES: Record<SalleId, [number, number, number, number, string]> = {
  wc: [10, 30, 26, 90, "WC"],
  direction: [92, 80, 28, 120, "Direction"],
  commerce: [92, 200, 28, 46, "Commerce"],
  cafe: [76, 250, 44, 34, "Café"],
  soleil: [92, 288, 28, 52, "Soleil"],
  serveurs: [145, 80, 34, 34, "Serv."],
  developpeur: [179, 80, 70, 34, "Développeur"],
  referent: [249, 80, 70, 34, "Réf. Info"],
  labo: [319, 80, 150, 34, "Labo"],
  jupiter: [469, 80, 130, 34, "Jupiter"],
  pedagogie: [145, 150, 34, 44, "Péda."],
  venus: [179, 150, 100, 34, "Vénus"],
  lune: [279, 150, 80, 34, "Lune"],
  mercure: [359, 150, 120, 34, "Mercure"],
  saturne: [479, 150, 120, 34, "Saturne"],
  terre: [145, 194, 34, 54, "Terre"],
  uranus: [145, 248, 34, 54, "Uranus"],
  mars: [145, 302, 34, 38, "Mars"],
};
const COULOIRS: Record<string, [number, number, number, number]> = {
  accueil: [0, 20, 90, 330],
  couloir1: [145, 114, 215, 36],
  couloir2: [360, 114, 240, 36],
  aile: [145, 184, 34, 160],
};

const ICONES_ZONE = (id: ZoneId) => {
  const l = interactions(ZONES[id]).filter((i) => i.type !== "porte");
  const s = new Set(l.map((i) => i.icone));
  return [...s].slice(0, 3).join("");
};

export function Plan({
  zone,
  lieu,
  roster,
  positionsRef,
  noms,
  moiId,
  onFermer,
}: {
  zone: ZoneId;
  lieu: ZoneId;
  roster: Present[];
  positionsRef: MutableRefObject<() => { moi: Pt; autres: Array<Pt & { id: string }> }>;
  noms: Record<string, string>;
  moiId: string;
  onFermer: () => void;
}) {
  const [vue, setVue] = useState<"ecole" | "zone">("ecole");
  const [choix, setChoix] = useState<ZoneId>(lieu);
  const zc = ZONES[choix];
  const presents = (id: ZoneId) => roster.filter((p) => p.zone === id);

  return (
    <Fenetre titre="🗺 Carte de l'école" onFermer={onFermer} large>
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          className={`pixel-btn !px-2 !py-1 !text-[9px] ${vue === "ecole" ? "!bg-accent" : ""}`}
          onClick={() => setVue("ecole")}
        >
          🏫 Toute l'école
        </button>
        <button
          className={`pixel-btn !px-2 !py-1 !text-[9px] ${vue === "zone" ? "!bg-accent" : ""}`}
          onClick={() => setVue("zone")}
        >
          📍 Ici, en direct
        </button>
        <span className="self-center text-sm text-muted-foreground">
          👥 {roster.length} connecté{roster.length > 1 ? "s" : ""}
        </span>
      </div>

      {vue === "ecole" ? (
        <>
          <svg
            viewBox="0 0 610 350"
            className="mx-auto w-full"
            style={{ background: "#f7f1e2", border: "4px solid #2a1810", maxHeight: "42vh" }}
          >
            {Object.entries(COULOIRS).map(([id, [x, y, w, h]]) => (
              <g key={id} className="cursor-pointer" onClick={() => setChoix(id as ZoneId)}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={id === zone ? "#ffe3a8" : id === choix ? "#e9f2ff" : "#fbf7ec"}
                  stroke={id === choix ? "#e07a2b" : "#d8cdb0"}
                  strokeWidth={id === choix ? 2 : 1}
                />
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#8a7a55"
                  fontFamily="sans-serif"
                >
                  {ICONES_ZONE(id as ZoneId)}
                </text>
                {presents(id as ZoneId).length > 0 && (
                  <Badge x={x + w - 8} y={y + 8} n={presents(id as ZoneId).length} />
                )}
              </g>
            ))}
            {(Object.entries(SALLES) as [SalleId, [number, number, number, number, string]][]).map(
              ([id, [x, y, w, h, nom]]) => (
                <g key={id} className="cursor-pointer" onClick={() => setChoix(id)}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill={id === zone ? "#e07a2b" : "#2b4b9a"}
                    stroke={id === choix ? "#ffd166" : "#142a63"}
                    strokeWidth={id === choix ? 3 : 2}
                  />
                  <text
                    x={x + w / 2}
                    y={y + h / 2 + (h > w * 1.6 ? 0 : -2)}
                    textAnchor="middle"
                    fontSize={h > w ? 8 : 9}
                    fill="#fff"
                    fontFamily="sans-serif"
                    transform={h > w * 1.6 ? `rotate(-90 ${x + w / 2} ${y + h / 2})` : undefined}
                  >
                    {nom}
                  </text>
                  {w >= 30 && h >= 30 && h <= w * 1.6 && (
                    <text x={x + w / 2} y={y + h / 2 + 10} textAnchor="middle" fontSize={9}>
                      {ICONES_ZONE(id)}
                    </text>
                  )}
                  {presents(id).length > 0 && (
                    <Badge x={x + w - 6} y={y + 6} n={presents(id).length} />
                  )}
                </g>
              ),
            )}
            <rect
              x={55}
              y={110}
              width={20}
              height={64}
              fill="#2b4b9a"
              stroke="#142a63"
              strokeWidth={2}
            />
            <text
              x={65}
              y={146}
              textAnchor="middle"
              fontSize={8}
              fill="#fff"
              fontFamily="sans-serif"
              transform="rotate(-90 65 146)"
            >
              Entrée
            </text>
            <polygon points="18,132 38,132 38,124 52,142 38,160 38,152 18,152" fill="#d9483b" />
            <rect
              x={10}
              y={290}
              width={26}
              height={50}
              fill="#2b4b9a"
              stroke="#142a63"
              strokeWidth={2}
            />
            <text
              x={23}
              y={318}
              textAnchor="middle"
              fontSize={7}
              fill="#fff"
              fontFamily="sans-serif"
              transform="rotate(-90 23 318)"
            >
              Ascenseur
            </text>
            <text x={5} y={14} fontSize={10} fill="#2a1810" fontFamily="sans-serif">
              Clique sur une salle ou un couloir · 🟠 = tu es ici · pastille = joueurs présents
            </text>
          </svg>
          <Detail id={choix} presents={presents(choix)} moiId={moiId} />
        </>
      ) : (
        <ZoneLive zone={zone} positionsRef={positionsRef} noms={noms} />
      )}
      <Legende />
      <button className="pixel-btn mt-3" onClick={onFermer}>
        Fermer
      </button>
    </Fenetre>
  );
}

const Badge = ({ x, y, n }: { x: number; y: number; n: number }) => (
  <g>
    <circle cx={x} cy={y} r={7} fill="#d9483b" stroke="#fff" strokeWidth={1} />
    <text x={x} y={y + 3} textAnchor="middle" fontSize={9} fill="#fff" fontFamily="sans-serif">
      {n}
    </text>
  </g>
);

function Detail({ id, presents, moiId }: { id: ZoneId; presents: Present[]; moiId: string }) {
  const z = ZONES[id];
  const liste = interactions(z).filter((i) => i.type !== "porte" || id === "accueil" || true);
  const groupes = useMemo(() => {
    const m = new Map<string, { icone: string; nom: string; n: number }>();
    for (const i of liste) {
      const k = i.icone + i.nom;
      const g = m.get(k);
      if (g) g.n++;
      else m.set(k, { icone: i.icone, nom: i.nom, n: 1 });
    }
    return [...m.values()];
  }, [liste]);
  return (
    <div className="mt-2 grid gap-3 text-lg sm:grid-cols-2">
      <div className="pixel-box p-3">
        <div className="mb-1 font-pixel text-[9px] text-accent">
          {z.nom.toUpperCase()} · À FAIRE ICI
        </div>
        <ul className="space-y-0.5">
          {groupes.map((g) => (
            <li key={g.icone + g.nom}>
              {g.icone} {g.nom}
              {g.n > 1 ? ` ×${g.n}` : ""}
            </li>
          ))}
        </ul>
      </div>
      <div className="pixel-box p-3">
        <div className="mb-1 font-pixel text-[9px] text-accent">
          JOUEURS PRÉSENTS ({presents.length})
        </div>
        {presents.length === 0 ? (
          <p className="text-muted-foreground">Personne pour l'instant.</p>
        ) : (
          <ul className="space-y-0.5">
            {presents.map((p) => (
              <li key={p.id}>
                👤 {p.pseudo}
                {p.id === moiId ? " (toi)" : ""}{" "}
                <span className="text-sm text-muted-foreground">Nv {p.niveau}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Vue case par case de la zone actuelle, avec les joueurs en temps réel. */
function ZoneLive({
  zone,
  positionsRef,
  noms,
}: {
  zone: ZoneId;
  positionsRef: MutableRefObject<() => { moi: Pt; autres: Array<Pt & { id: string }> }>;
  noms: Record<string, string>;
}) {
  const z = ZONES[zone],
    C = 14;
  const [, rendre] = useState(0);
  useEffect(() => {
    const t = setInterval(() => rendre((v) => v + 1), 150);
    return () => clearInterval(t);
  }, []);
  const pos = positionsRef.current();
  const inter = useMemo(() => interactions(z), [z]);
  const murs = useMemo(() => {
    const r: Array<[number, number]> = [];
    for (let y = 0; y < z.h; y++) for (let x = 0; x < z.l; x++) if (estMur(z, x, y)) r.push([x, y]);
    return r;
  }, [z]);
  return (
    <div className="overflow-auto">
      <svg
        viewBox={`0 0 ${z.l * C} ${z.h * C}`}
        className="mx-auto w-full"
        style={{ maxWidth: z.l * C * 1.6, maxHeight: "50vh", border: "4px solid #2a1810" }}
      >
        <rect width={z.l * C} height={z.h * C} fill={z.theme.sol.c1} />
        {murs.map(([x, y]) => (
          <rect key={`${x},${y}`} x={x * C} y={y * C} width={C} height={C} fill={z.theme.murBas} />
        ))}
        {z.objets
          .filter((o) => o.solide && !o.plat)
          .map((o, i) => (
            <rect
              key={i}
              x={o.x * C + 1}
              y={o.y * C + 1}
              width={o.w * C - 2}
              height={o.h * C - 2}
              fill="#8e5b33"
              opacity={0.55}
            />
          ))}
        {inter.map((i, k) => (
          <text
            key={k}
            x={(i.x + i.w / 2) * C}
            y={(i.y + i.h / 2) * C + 5}
            textAnchor="middle"
            fontSize={C * 0.95}
          >
            {i.icone}
          </text>
        ))}
        {pos.autres.map((p) => (
          <g key={p.id}>
            <circle
              cx={(p.x + 0.5) * C}
              cy={(p.y + 0.5) * C}
              r={C * 0.42}
              fill="#2b7bd1"
              stroke="#fff"
              strokeWidth={1.5}
            />
            <text
              x={(p.x + 0.5) * C}
              y={(p.y + 0.5) * C - C * 0.6}
              textAnchor="middle"
              fontSize={7}
              fill="#fff"
              stroke="#000"
              strokeWidth={0.4}
              fontFamily="sans-serif"
            >
              {noms[p.id] ?? ""}
            </text>
          </g>
        ))}
        <circle
          cx={(pos.moi.x + 0.5) * C}
          cy={(pos.moi.y + 0.5) * C}
          r={C * 0.48}
          fill="#e07a2b"
          stroke="#fff"
          strokeWidth={2}
        />
      </svg>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        🟠 toi · 🔵 les autres joueurs (positions en direct) · {z.nom}
      </p>
    </div>
  );
}

function Legende() {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {LEGENDE.map(([i, n]) => (
        <span key={n}>
          {i} {n}
        </span>
      ))}
    </div>
  );
}
