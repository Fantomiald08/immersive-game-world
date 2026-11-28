/**
 * Boutique ISITECH et monnaie unifiée (ISICoins).
 * Module pur : catalogue, règles de solde et de niveau. La vérité (solde, achats, équipements)
 * est côté serveur ; les fonctions SQL reprennent exactement les mêmes prix et les mêmes règles.
 */

export const NOM_MONNAIE = "ISICoins";

export type CategorieArticle = "badge" | "titre" | "couleur" | "animal" | "tenue";

export type ArticleBoutique = {
  id: string;
  categorie: CategorieArticle;
  nom: string;
  description: string;
  prix: number;
  /** Valeur d'affichage : emoji du badge, titre affiché, couleur hexadécimale du pseudo, nom de l'animal ou de la tenue. */
  valeur: string;
};

export const CATEGORIES: Array<{ id: CategorieArticle; libelle: string; equipable: boolean }> = [
  { id: "badge", libelle: "Badges", equipable: true },
  { id: "titre", libelle: "Titres", equipable: true },
  { id: "couleur", libelle: "Couleurs de pseudo", equipable: true },
  { id: "animal", libelle: "Animaux de compagnie", equipable: true },
  { id: "tenue", libelle: "Tenues", equipable: true },
];

/** Catalogue complet. Uniquement de la personnalisation : aucun article n'améliore la progression. */
export const CATALOGUE: ArticleBoutique[] = [
  { id: "badge-cafe", categorie: "badge", nom: "Badge Café", description: "Un café à la main, pour les nuits de révision.", prix: 40, valeur: "☕" },
  { id: "badge-hacker", categorie: "badge", nom: "Badge Hacker", description: "Pour ceux qui lisent les logs sans cligner.", prix: 80, valeur: "💻" },
  { id: "badge-quiz", categorie: "badge", nom: "Badge Quiz d'or", description: "Décroché à force de bonnes réponses.", prix: 120, valeur: "🧠" },
  { id: "titre-stagiaire", categorie: "titre", nom: "Stagiaire motivé", description: "Un titre pour les débuts en entreprise.", prix: 30, valeur: "Stagiaire motivé" },
  { id: "titre-noctambule", categorie: "titre", nom: "Noctambule", description: "Toujours connecté tard le soir.", prix: 60, valeur: "Noctambule" },
  { id: "titre-admin", categorie: "titre", nom: "Administrateur système", description: "Le titre des gens qui gardent les serveurs debout.", prix: 150, valeur: "Administrateur système" },
  { id: "couleur-cyan", categorie: "couleur", nom: "Pseudo cyan", description: "Ton pseudo en néon cyan au-dessus de ton personnage.", prix: 50, valeur: "#19e6ff" },
  { id: "couleur-or", categorie: "couleur", nom: "Pseudo or", description: "Ton pseudo en or.", prix: 80, valeur: "#ffd166" },
  { id: "couleur-rose", categorie: "couleur", nom: "Pseudo rose", description: "Ton pseudo en rose fluo.", prix: 80, valeur: "#ff3fb4" },
  { id: "couleur-vert", categorie: "couleur", nom: "Pseudo vert", description: "Ton pseudo en vert terminal.", prix: 50, valeur: "#6ee7a0" },
  { id: "animal-chat", categorie: "animal", nom: "Chat de bureau", description: "Un compagnon qui te suit partout sur le campus.", prix: 200, valeur: "Chat de bureau" },
  { id: "animal-robot", categorie: "animal", nom: "Petit robot", description: "Un robot de service, très serviable.", prix: 250, valeur: "Petit robot" },
  { id: "animal-hibou", categorie: "animal", nom: "Hibou du campus", description: "Il veille sur les révisions de nuit.", prix: 180, valeur: "Hibou du campus" },
  { id: "tenue-veste-neon", categorie: "tenue", nom: "Veste néon", description: "Une veste aux liserés néon.", prix: 120, valeur: "Veste néon" },
  { id: "tenue-capuche", categorie: "tenue", nom: "Capuche sombre", description: "Une capuche pour passer inaperçu.", prix: 90, valeur: "Capuche sombre" },
  { id: "tenue-sweat", categorie: "tenue", nom: "Sweat ISITECH", description: "Le sweat officiel du campus.", prix: 100, valeur: "Sweat ISITECH" },
];

const PAR_ID = new Map(CATALOGUE.map((a) => [a.id, a]));

export const articleParId = (id: string): ArticleBoutique | undefined => PAR_ID.get(id);

/** Valeur d'affichage d'un article équipé, ou undefined si l'article n'existe pas. */
export const valeurDe = (id: string | undefined): string | undefined => (id ? PAR_ID.get(id)?.valeur : undefined);

/** Une ISICoin par tranche de 2 XP gagnés (au moins 1 dès qu'il y a un gain). Doit rester identique à la fonction SQL. */
export function isicoinsPourXp(xp: number): number {
  if (xp <= 0) return 0;
  return Math.max(1, Math.floor(xp / 2));
}

/** Niveau selon l'XP : un niveau tous les 100 XP, à partir du niveau 1. Identique à la fonction SQL. */
export function niveauPourXp(xp: number): number {
  return 1 + Math.floor(Math.max(0, xp) / 100);
}

/** Vérifie un achat avant de l'envoyer au serveur. Renvoie null si l'achat est possible, sinon le motif. */
export function motifRefusAchat(args: { solde: number; prix: number; possede: boolean }): string | null {
  if (args.possede) return "Tu possèdes déjà cet article.";
  if (args.solde < args.prix) return `Solde insuffisant : il te manque ${args.prix - args.solde} ${NOM_MONNAIE}.`;
  return null;
}

/** Couleur de pseudo équipée, ou undefined (pseudo blanc par défaut). */
export function couleurPseudoEquipee(equipes: Record<string, string> | undefined): string | undefined {
  return valeurDe(equipes?.["couleur"]);
}

/** Badge équipé (emoji), ou undefined. */
export function badgeEquipe(equipes: Record<string, string> | undefined): string | undefined {
  return valeurDe(equipes?.["badge"]);
}
