import { Fenetre } from "./Fenetre";
import type { SalleId, ZoneId } from "@/game/carte/types";

/** Plan de l'école (d'après le plan officiel) avec la position du joueur. */
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
const ZONES_RECT: Record<string, [number, number, number, number]> = {
  accueil: [0, 20, 90, 330],
  couloir1: [145, 114, 215, 36],
  couloir2: [360, 114, 240, 36],
  aile: [145, 184, 34, 160],
};

export function Plan({
  zone,
  lieu,
  onFermer,
}: {
  zone: ZoneId;
  lieu: ZoneId;
  onFermer: () => void;
}) {
  const ici = (id: string) => id === lieu;
  return (
    <Fenetre titre="🗺 Plan de l'école" onFermer={onFermer} large>
      <svg
        viewBox="0 0 610 350"
        className="w-full"
        style={{ background: "#f7f1e2", border: "4px solid #2a1810" }}
      >
        {Object.entries(ZONES_RECT).map(([id, [x, y, w, h]]) => (
          <rect
            key={id}
            x={x}
            y={y}
            width={w}
            height={h}
            fill={ici(id) || zone === id ? "#ffe3a8" : "#fbf7ec"}
            stroke="#d8cdb0"
          />
        ))}
        {(Object.entries(SALLES) as [SalleId, [number, number, number, number, string]][]).map(
          ([id, [x, y, w, h, nom]]) => (
            <g key={id}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={ici(id) ? "#e07a2b" : "#2b4b9a"}
                stroke="#142a63"
                strokeWidth={2}
              />
              <text
                x={x + w / 2}
                y={y + h / 2 + 3}
                textAnchor="middle"
                fontSize={h > w ? 8 : 9}
                fill="#fff"
                fontFamily="sans-serif"
                transform={h > w * 1.6 ? `rotate(-90 ${x + w / 2} ${y + h / 2})` : undefined}
              >
                {nom}
              </text>
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
          Isitech · Campus du numérique
        </text>
      </svg>
      <p className="mt-2 text-lg">
        Tu es ici : <b className="text-accent">dans {labelLieu(lieu)}</b>. La zone en jaune est
        celle où tu te trouves.
      </p>
      <button className="pixel-btn mt-3" onClick={onFermer}>
        Fermer
      </button>
    </Fenetre>
  );
}

const labelLieu = (id: ZoneId) =>
  id === "accueil"
    ? "l'accueil"
    : id === "couloir1"
      ? "le couloir ouest"
      : id === "couloir2"
        ? "le couloir est"
        : id === "aile"
          ? "l'aile des planètes"
          : `la salle « ${SALLES[id as SalleId][4]} »`;
