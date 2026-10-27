import type { Zone } from "./types";

export type Interaction = {
  x: number;
  y: number;
  w: number;
  h: number;
  icone: string;
  nom: string;
  type: "porte" | "ordinateur" | "classement" | "tableau" | "info" | "personnage" | "monstre";
};

/** Tout ce avec quoi on peut interagir dans une zone (portes, ordinateurs, personnages, monstres...). Sert à la carte. */
export function interactions(z: Zone): Interaction[] {
  const r: Interaction[] = [];
  for (const o of z.objets) {
    if (!o.agir) continue;
    const base = { x: o.x, y: o.y, w: o.w, h: o.h };
    switch (o.agir.k) {
      case "porte":
        r.push({ ...base, icone: "🚪", nom: `Porte : ${o.agir.nom}`, type: "porte" });
        break;
      case "terminal":
        r.push({ ...base, icone: "💻", nom: "Ordinateur (réseau Isitech)", type: "ordinateur" });
        break;
      case "classement":
        r.push({ ...base, icone: "🏆", nom: "Classement des élèves", type: "classement" });
        break;
      case "tableau":
        r.push({ ...base, icone: "📋", nom: "Tableau d'affichage", type: "tableau" });
        break;
      case "texte":
        r.push({ ...base, icone: "🔎", nom: o.agir.titre, type: "info" });
        break;
    }
  }
  for (const p of z.pnjs)
    r.push({
      x: p.x,
      y: p.y,
      w: 1,
      h: 1,
      icone: p.monstre ? "⚔️" : "💬",
      nom: p.monstre ? `Monstre : ${p.nom}` : p.nom,
      type: p.monstre ? "monstre" : "personnage",
    });
  return r;
}

export const LEGENDE: Array<[string, string]> = [
  ["🚪", "Porte"],
  ["💻", "Ordinateur"],
  ["🏆", "Classement"],
  ["📋", "Tableau d'affichage"],
  ["💬", "Personnage"],
  ["⚔️", "Monstre"],
  ["🔎", "À examiner"],
];
