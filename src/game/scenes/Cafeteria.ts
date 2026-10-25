import { cable, d, mural, obj, sol, sur, type Point, type Scene } from "../monde";

const tables = [
  { x: 4, y: 5 },
  { x: 9, y: 5 },
  { x: 4, y: 8.5 },
  { x: 9, y: 8.5 },
];

export const Cafeteria: Scene = {
  id: "cafeteria",
  nom: "Cafétéria",
  l: 16,
  h: 12,
  sol: "tile-floor",
  decor: [
    d("mur", 0, 0, 16),
    d("tableau", 12, 0, 3),
    // Mur : fenêtres, horloge, menu, lumières
    mural("🪟", 0),
    mural("🪟", 1),
    mural("💡", 2, 1, { anim: "blink" }),
    mural("🕐", 7, 1, { anim: "bob" }),
    mural("🍽️", 8, 2, { txt: "MENU" }),
    mural("💡", 10, 1, { anim: "blink" }),
    mural("🖼️", 11),
    mural("🪟", 15),
    // Comptoir de service et machines
    d("comptoir", 1, 2, 6),
    sur("☕", 1, 2, { anim: "bob" }),
    sur("🍲", 6, 2),
    obj("🧊", 8, 1, 1, 1),
    obj("🥤", 9, 1),
    obj("🥤", 10, 1),
    obj("☕", 11, 1, 1, 1, true, { anim: "bob" }),
    // Tables, chaises et couverts
    ...tables.map((t) => d("table", t.x, t.y, 2, 2)),
    ...tables.flatMap((t) => [
      sol("🪑", t.x - 1, t.y + 0.5),
      sol("🪑", t.x + 2, t.y + 0.5),
      sur("🍽️", t.x, t.y + 1),
      sur("🥤", t.x + 1, t.y + 1),
    ]),
    // Espace détente
    { type: "babyfoot", x: 13, y: 5, w: 2, h: 1, solide: true },
    obj("🛋️", 12, 10, 3, 1),
    obj("📺", 13, 8, 1, 1, true, { anim: "blink" }),
    d("plante", 15, 11),
    d("plante", 15, 1),
    d("plante", 0, 11),
    d("plante", 0, 1),
    obj("🗑️", 15, 3),
    obj("♻️", 15, 4),
    // Détails au sol
    sol("🔌", 12, 7),
    sol("🍎", 7, 4.2),
    sol("📱", 8.5, 7.8),
    sol("🧻", 2, 9),
    sol("🪴", 1.5, 7.5),
    cable("#f59e0b", 12, 8, 3),
  ],
  portes: [{ x: 0, y: 5, w: 1, h: 2, vers: "hall", label: "HALL" }],
  entrees: { debut: { x: 1.6, y: 6 }, hall: { x: 1.6, y: 6 } },
};

export const BARMAN: Point = { x: 4, y: 1.9 };
export const TABLEAU_HEROS: Point = { x: 13.5, y: 1.8 };
