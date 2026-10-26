/** Quêtes du jour, badges et série de jours. Sauvegardés sur cet appareil (navigateur), par joueur. */
export type Quete = { id: string; titre: string; xp: number };
export const QUETES: Quete[] = [
  { id: "reseau", titre: "Entrer sur le réseau Isitech", xp: 10 },
  { id: "quiz", titre: "Terminer un quiz", xp: 15 },
  { id: "monstre", titre: "Vaincre un monstre de la salle serveur", xp: 15 },
  { id: "explorer", titre: "Visiter 3 salles différentes", xp: 10 },
];
export const BADGES = [
  { id: "depot", nom: "Premier cours", desc: "Déposer un cours sur le réseau", icone: "📥" },
  { id: "quiz", nom: "Premier quiz", desc: "Terminer un quiz", icone: "❓" },
  { id: "parfait", nom: "Sans faute", desc: "Réussir un quiz avec 100 %", icone: "💯" },
  { id: "chasseur", nom: "Chasseur de virus", desc: "Vaincre un monstre", icone: "🦠" },
  { id: "explorateur", nom: "Tour de l'école", desc: "Visiter 10 salles différentes", icone: "🧭" },
  { id: "fidele", nom: "Fidèle", desc: "Venir 3 jours de suite", icone: "🔥" },
];

export type Prog = {
  jour: string;
  faites: string[];
  badges: string[];
  visites: string[];
  toutes: string[];
  serie: number;
};
export type Evenement =
  | { k: "reseau" }
  | { k: "depot" }
  | { k: "quiz"; score: number; total: number }
  | { k: "monstre" }
  | { k: "visite"; salle: string };
export type Gains = { xp: number; quetes: string[]; badges: string[] };

const cle = (uid: string) => `isitech.prog.v3.${uid}`;
const aujourdhui = () => new Date().toLocaleDateString("sv-SE");
const hier = () => new Date(Date.now() - 864e5).toLocaleDateString("sv-SE");
const vide = (): Prog => ({ jour: "", faites: [], badges: [], visites: [], toutes: [], serie: 0 });

function lire(uid: string): Prog {
  try {
    const b = typeof window !== "undefined" ? window.localStorage.getItem(cle(uid)) : null;
    return b ? { ...vide(), ...(JSON.parse(b) as Partial<Prog>) } : vide();
  } catch {
    return vide();
  }
}
function ecrire(uid: string, p: Prog) {
  try {
    window.localStorage.setItem(cle(uid), JSON.stringify(p));
  } catch {
    /* stockage indisponible */
  }
}

/** À appeler à l'arrivée dans le jeu : remet les quêtes à zéro chaque jour et compte la série. */
export function ouvrirJour(uid: string): { prog: Prog; gains: Gains } {
  const p = lire(uid),
    g: Gains = { xp: 0, quetes: [], badges: [] };
  const j = aujourdhui();
  if (p.jour !== j) {
    p.serie = p.jour === hier() ? p.serie + 1 : 1;
    p.jour = j;
    p.faites = [];
    p.visites = [];
    if (p.serie >= 3 && !p.badges.includes("fidele")) {
      p.badges.push("fidele");
      g.badges.push("Fidèle");
    }
    ecrire(uid, p);
  }
  return { prog: p, gains: g };
}

export function lireProg(uid: string): Prog {
  return lire(uid);
}

export function evenement(uid: string, ev: Evenement): { prog: Prog; gains: Gains } {
  const p = lire(uid),
    g: Gains = { xp: 0, quetes: [], badges: [] };
  const quete = (id: string) => {
    const q = QUETES.find((x) => x.id === id)!;
    if (!p.faites.includes(id)) {
      p.faites.push(id);
      g.xp += q.xp;
      g.quetes.push(q.titre);
    }
  };
  const badge = (id: string) => {
    const b = BADGES.find((x) => x.id === id)!;
    if (!p.badges.includes(id)) {
      p.badges.push(id);
      g.badges.push(b.nom);
    }
  };
  if (ev.k === "reseau") quete("reseau");
  else if (ev.k === "depot") badge("depot");
  else if (ev.k === "quiz") {
    quete("quiz");
    badge("quiz");
    if (ev.score === ev.total && ev.total > 0) badge("parfait");
  } else if (ev.k === "monstre") {
    quete("monstre");
    badge("chasseur");
  } else if (ev.k === "visite") {
    if (!p.visites.includes(ev.salle)) p.visites.push(ev.salle);
    if (p.visites.length >= 3) quete("explorer");
    // Le badge se débloque sur le total de salles visitées, tous jours confondus
    if (!p.toutes.includes(ev.salle)) p.toutes.push(ev.salle);
    if (p.toutes.length >= 10) badge("explorateur");
  }
  ecrire(uid, p);
  return { prog: p, gains: g };
}
