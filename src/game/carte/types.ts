import type { Direction } from "@/game/apparence";
export type { Direction };

export type Pt = { x: number; y: number };
export type Rect = Pt & { w: number; h: number };
export type Arrivee = Pt & { dir: Direction };

export const SALLES = [
  "direction",
  "commerce",
  "cafe",
  "soleil",
  "wc",
  "serveurs",
  "developpeur",
  "referent",
  "labo",
  "jupiter",
  "pedagogie",
  "venus",
  "lune",
  "mercure",
  "saturne",
  "terre",
  "uranus",
  "mars",
] as const;
export type SalleId = (typeof SALLES)[number];
export type ZoneId = "accueil" | "couloir1" | "couloir2" | "aile" | SalleId;

export type TypeMonstre = "virus" | "malware" | "bug" | "ransomware";

export type Kind =
  | "poste"
  | "bureau"
  | "grandbureau"
  | "table"
  | "chaise"
  | "casiers"
  | "plante"
  | "canape"
  | "comptoir"
  | "machinecafe"
  | "distributeur"
  | "frigo"
  | "baie"
  | "etagere"
  | "armoire"
  | "banc"
  | "tapis"
  | "lavabo"
  | "cabine"
  | "poubelle"
  | "imprimante"
  | "tableau"
  | "fenetre"
  | "horloge"
  | "affiche"
  | "planete"
  | "ecranmur"
  | "panneau"
  | "logo"
  | "ascenseur"
  | "entree"
  | "fleche"
  | "porteH"
  | "porteV"
  | "clim"
  | "miroir"
  | "lampadaire"
  | "tableauHeros";

/** Ce qui se passe quand on appuie sur Espace devant un objet. */
export type Agir =
  | { k: "porte"; vers: ZoneId; arrivee: Arrivee; nom: string }
  | { k: "terminal" }
  | { k: "classement" }
  | { k: "texte"; titre: string; texte: string };

export type Objet = {
  kind: Kind;
  /** Case de départ de l'emprise (là où l'objet bloque le passage). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Hauteur dessinée au-dessus de l'emprise (en cases), et en dessous pour les murs du bas. */
  hh: number;
  hb: number;
  solide: boolean;
  plat: boolean;
  c?: string;
  c2?: string;
  v?: string;
  label?: string;
  agir?: Agir;
};

export type PnjDef = {
  id: string;
  x: number;
  y: number;
  dir: Direction;
  seed: string;
  nom: string;
  texte?: string;
  monstre?: TypeMonstre;
};

export type Sortie = Rect & { vers: ZoneId; arrivee: Arrivee };

export type SolType = "parquet" | "carrelage" | "damier" | "moquette" | "lino";
export type Sol = { type: SolType; c1: string; c2: string };
export type Theme = { sol: Sol; mur: string; murBas: string; trait: string; plinthe: string };

export type Zone = {
  id: ZoneId;
  nom: string;
  l: number;
  h: number;
  murs: { haut: number; bas: number; gauche: number; droite: number };
  ouvertures: Rect[];
  theme: Theme;
  objets: Objet[];
  pnjs: PnjDef[];
  sorties: Sortie[];
  depart: Arrivee;
  /** Pièce dont on dépend pour le plan (la zone elle-même si c'est un couloir). */
  lieu: ZoneId;
};
