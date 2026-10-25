import { cable, d, mural, obj, sol, type Point, type Scene } from "../monde";

export const Serveur: Scene = {
  id: "serveur",
  nom: "Salle serveur",
  l: 16,
  h: 12,
  sol: "tile-tile",
  decor: [
    d("mur", 0, 0, 16),
    // Mur : écrans de supervision, clim, panneaux
    mural("📺", 2, 1, { anim: "blink" }),
    mural("📊", 3, 1, { anim: "blink" }),
    mural("⚠️", 5),
    mural("❄️", 7, 1, { anim: "bob" }),
    mural("❄️", 8, 1, { anim: "bob" }),
    mural("📈", 10, 1, { anim: "blink" }),
    mural("🔒", 12),
    mural("🧯", 13),
    mural("🪧", 15),
    // Baies de brassage (LED clignotantes)
    d("rack", 1, 1, 1, 4),
    d("rack", 4, 1, 1, 4),
    d("rack", 11, 1, 1, 4),
    d("rack", 14, 1, 1, 4),
    d("rack", 1, 7, 1, 3),
    d("rack", 14, 7, 1, 3),
    // Serveurs et équipement le long du mur du fond
    obj("🖥️", 6, 1, 1, 1, true, { anim: "blink" }),
    obj("🖥️", 7, 1),
    obj("🖥️", 8, 1, 1, 1, true, { anim: "blink" }),
    obj("🖥️", 9, 1),
    obj("🔌", 2, 1),
    obj("🔌", 13, 1),
    // Onduleurs, caisses, outils
    obj("🔋", 5, 10),
    obj("🔋", 10, 10),
    obj("📦", 0, 11),
    obj("📦", 15, 11),
    obj("📦", 0, 10),
    obj("🧰", 15, 6),
    obj("🛠️", 0, 6),
    obj("🪜", 15, 3),
    obj("🌡️", 0, 5, 1, 1, false),
    // Câbles colorés au sol
    cable("#22d3ee", 2, 5.5, 5),
    cable("#f472b6", 8, 5.5, 5),
    cable("#facc15", 3, 10.6, 3),
    cable("#4ade80", 10, 7, 4),
    cable("#a78bfa", 5, 2.5, 6),
    cable("#fb923c", 6, 9.3, 2),
    sol("💡", 7, 6, 1, 1, { anim: "blink" }),
    sol("📎", 3, 7),
    sol("🔩", 12, 9),
  ],
  portes: [{ x: 7, y: 11, w: 2, h: 1, vers: "hall", label: "HALL" }],
  entrees: { debut: { x: 8, y: 10.3 }, hall: { x: 8, y: 10.3 } },
};

export const PLACES_MONSTRES: Point[] = [
  { x: 8, y: 6 },
  { x: 2.8, y: 3.6 },
  { x: 12.6, y: 3.6 },
  { x: 6.5, y: 4.2 },
  { x: 9.5, y: 4.2 },
  { x: 5, y: 8.5 },
  { x: 11, y: 8.5 },
  { x: 2.8, y: 9.5 },
  { x: 13, y: 9.5 },
];
/** Les 4 familles de monstres de la salle serveur. */
export const MONSTRES = [
  { nom: "Virus", emoji: "🦠" },
  { nom: "Malware", emoji: "👾" },
  { nom: "Bug", emoji: "🐛" },
  { nom: "Ransomware", emoji: "💀" },
];
