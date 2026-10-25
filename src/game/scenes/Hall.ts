import { cable, d, mural, obj, sol, sur, type Scene } from "../monde";

/** Hall d'accueil d'Isitech. Tout le décor est une liste de données : ajoute une ligne pour ajouter un objet. */
export const Hall: Scene = {
  id: "hall",
  nom: "Hall d'Isitech",
  l: 20,
  h: 14,
  sol: "tile-tile",
  decor: [
    // Murs
    d("mur", 0, 0, 3),
    d("mur", 5, 0, 10),
    d("mur", 17, 0, 3),
    // Décor mural (rangée du haut)
    mural("🪟", 0),
    mural("🖼️", 1),
    mural("🕐", 2, 1, { anim: "bob" }),
    mural("📌", 5, 2, { txt: "ANNONCES" }),
    mural("🪟", 7),
    mural("🪟", 12),
    mural("📺", 13, 1, { anim: "blink" }),
    { type: "mural", x: 8, y: 0, w: 4, h: 1, solide: false, txt: "ISITECH", anim: "blink" },
    mural("🧯", 14),
    mural("🖼️", 17),
    mural("🎓", 18),
    mural("🪟", 19),
    // Casiers (colorés par l'alternance du motif)
    d("casier", 6, 1, 3),
    d("casier", 11, 1, 3),
    d("casier", 0, 4, 1, 3),
    d("casier", 0, 8, 1, 3),
    // Accueil : comptoir + matériel
    d("accueil", 8, 5, 4),
    sur("💻", 8, 5),
    sur("🔔", 11, 5),
    sur("📞", 9, 5),
    sur("🗂️", 10, 5),
    // Plantes
    d("plante", 1, 1),
    d("plante", 18, 1),
    d("plante", 1, 12),
    d("plante", 18, 12),
    d("plante", 2, 2),
    d("plante", 5, 2),
    d("plante", 14, 5),
    // Bancs + affaires posées dessus
    d("banc", 3, 10, 3),
    d("banc", 14, 10, 3),
    sur("🎒", 4, 10),
    sur("🧥", 15, 10),
    sur("📱", 16, 10),
    // Tapis d'entrée
    d("tapis", 8, 11, 4, 3, false),
    // Équipements
    obj("🥤", 18, 3),
    obj("🥤", 18, 4),
    obj("🧃", 18, 9),
    obj("♻️", 18, 10),
    obj("🗑️", 18, 11),
    obj("🖨️", 1, 3),
    obj("🧥", 1, 7),
    obj("☂️", 2, 7),
    obj("🛋️", 1, 11, 2, 1),
    obj("🛋️", 3, 6, 2, 1),
    sol("☕", 3, 7),
    obj("🛋️", 15, 6, 2, 1),
    sol("📰", 15, 7),
    obj("🪴", 6, 4),
    obj("🪴", 13, 8),
    obj("🏆", 16, 12),
    obj("📚", 15, 12),
    obj("🪑", 12, 10),
    // Détails au sol
    sol("⬆️", 4, 4, 1, 1, { anim: "bob" }),
    sol("⬆️", 16, 4, 1, 1, { anim: "bob" }),
    sol("➡️", 17, 7, 1, 1, { anim: "bob" }),
    sol("👣", 9, 9),
    sol("👣", 10, 8),
    sol("📄", 6, 8),
    sol("🍂", 13, 8),
    sol("🥤", 7, 12),
    cable("#4ade80", 6, 7, 3),
    cable("#facc15", 12, 6.5, 2),
  ],
  portes: [
    { x: 3, y: 0, w: 2, h: 1, vers: "classe", label: "CLASSE" },
    { x: 15, y: 0, w: 2, h: 1, vers: "serveur", label: "SERVEUR" },
    { x: 19, y: 6, w: 1, h: 2, vers: "cafeteria", label: "CAFÉT" },
  ],
  entrees: {
    debut: { x: 10, y: 9 },
    classe: { x: 4, y: 1.9 },
    serveur: { x: 16, y: 1.9 },
    cafeteria: { x: 18.2, y: 7 },
  },
};

/** Réceptionniste (clic ou touche E). */
export const ACCUEIL_PNJ = { x: 9.5, y: 4.6 };
