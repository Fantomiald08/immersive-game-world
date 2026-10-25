import { cable, d, mural, obj, sol, sur, type Point, type Scene } from "../monde";

const rangs = [3, 6, 9],
  cols = [2, 5, 9, 12];
const bureaux = rangs.flatMap((y) => cols.map((x) => ({ x, y })));

export const Classe: Scene = {
  id: "classe",
  nom: "Salle de classe",
  l: 16,
  h: 12,
  sol: "tile-floor",
  decor: [
    d("mur", 0, 0, 16),
    d("tableau", 5, 0, 6),
    // Mur : fenêtres, horloge, posters, projecteur
    mural("🪟", 0),
    mural("🪟", 1),
    mural("🪟", 2),
    mural("🕐", 3, 1, { anim: "bob" }),
    mural("📽️", 4, 1, { anim: "blink" }),
    mural("🌐", 11),
    mural("🗺️", 12, 1, { txt: "RÉSEAU" }),
    mural("📡", 13),
    mural("📌", 14),
    mural("🧯", 15),
    // Bureau du professeur
    d("bureau", 1, 1, 3),
    sur("💻", 1, 1),
    sur("☕", 2, 1, { anim: "bob" }),
    sur("📝", 3, 1),
    // Rangées de bureaux : un ordinateur sur chacun
    ...bureaux.map((b) => d("bureau", b.x, b.y, 2)),
    ...bureaux.flatMap((b) => [
      sur("🖥️", b.x, b.y, b.x % 2 ? { anim: "blink" } : {}),
      sur(b.y === 6 ? "📓" : "🥤", b.x + 1, b.y),
    ]),
    // Rangements
    obj("📚", 13, 1),
    obj("📚", 14, 1),
    obj("🗄️", 0, 5),
    obj("🗄️", 0, 6),
    obj("🗄️", 0, 7),
    // Plantes, poubelle
    d("plante", 15, 1),
    d("plante", 0, 11),
    d("plante", 15, 5),
    obj("🗑️", 15, 10),
    obj("♻️", 15, 9),
    // Détails au sol : sacs, câbles, papiers
    sol("🎒", 4.2, 4.2),
    sol("🎒", 8.2, 7.2),
    sol("🎒", 11.2, 10.2),
    sol("📄", 7, 5),
    sol("📄", 10.5, 8),
    sol("🔌", 6.5, 4.5),
    cable("#60a5fa", 4, 5.5, 6),
    cable("#f87171", 8, 8.5, 5),
  ],
  portes: [{ x: 7, y: 11, w: 2, h: 1, vers: "hall", label: "HALL" }],
  entrees: { debut: { x: 8, y: 10.3 }, hall: { x: 8, y: 10.3 } },
};

/** Places assises des PNJ de cours (une par cours, dans l'ordre). */
export const PLACES_COURS: Point[] = bureaux.map((b) => ({ x: b.x + 1, y: b.y + 1.6 }));
export const PROF: Point = { x: 8, y: 1.8 };
