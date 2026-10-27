import { DIM } from "./catalogue";
import type {
  Agir,
  Arrivee,
  Direction,
  Kind,
  Objet,
  PnjDef,
  Rect,
  SalleId,
  Sortie,
  Theme,
  TypeMonstre,
  Zone,
  ZoneId,
} from "./types";

/* ───────────── Outils de construction ───────────── */
const o = (kind: Kind, x: number, y: number, e: Partial<Objet> = {}): Objet => {
  const d = DIM[kind];
  const base: Objet = {
    kind,
    x,
    y,
    w: d.w,
    h: d.h,
    hh: d.hh ?? 0,
    hb: 0,
    solide: d.solide ?? true,
    plat: d.plat ?? false,
    ...e,
  };
  // Chaque poste informatique ouvre le réseau Isitech
  return kind === "poste" && !base.agir ? { ...base, agir: { k: "terminal" } } : base;
};
const pnj = (
  id: string,
  x: number,
  y: number,
  dir: Direction,
  nom: string,
  texte: string,
): PnjDef => ({ id, x, y, dir, seed: id, nom, texte });
const monstre = (type: TypeMonstre, nom: string, x: number, y: number): PnjDef => ({
  id: `m-${type}`,
  x,
  y,
  dir: "bas",
  seed: type,
  nom,
  monstre: type,
});

type Cote = "haut" | "bas" | "droite";
type PorteDef = {
  zone: ZoneId;
  cote: Cote;
  x: number;
  y: number;
  nom: string;
  plaque: string;
  c?: string;
};

/** Où se trouve la porte de chaque salle dans son couloir. Tout le reste en découle (retours, plan). */
const PORTES: Record<SalleId, PorteDef> = {
  wc: { zone: "accueil", cote: "haut", x: 3, y: 1, nom: "les WC", plaque: "WC" },
  direction: {
    zone: "accueil",
    cote: "droite",
    x: 21,
    y: 6,
    nom: "la Direction",
    plaque: "DIRECTION",
  },
  commerce: {
    zone: "accueil",
    cote: "droite",
    x: 21,
    y: 8,
    nom: "le service Commerce",
    plaque: "COMMERCE",
  },
  cafe: { zone: "accueil", cote: "droite", x: 21, y: 10, nom: "le Café", plaque: "CAFÉ" },
  soleil: {
    zone: "accueil",
    cote: "droite",
    x: 21,
    y: 12,
    nom: "la salle Soleil",
    plaque: "SOLEIL",
  },
  serveurs: {
    zone: "couloir1",
    cote: "haut",
    x: 4,
    y: 1,
    nom: "la salle des Serveurs",
    plaque: "SERVEURS",
  },
  developpeur: {
    zone: "couloir1",
    cote: "haut",
    x: 8,
    y: 1,
    nom: "le bureau Développeur",
    plaque: "DÉVELOPPEUR",
  },
  referent: {
    zone: "couloir1",
    cote: "haut",
    x: 12,
    y: 1,
    nom: "le Référent Informatique",
    plaque: "RÉF. INFO",
  },
  pedagogie: {
    zone: "couloir1",
    cote: "bas",
    x: 5,
    y: 7,
    nom: "le bureau Pédagogie",
    plaque: "PÉDAGOGIE",
  },
  venus: { zone: "couloir1", cote: "bas", x: 10, y: 7, nom: "la salle Vénus", plaque: "VENUS" },
  lune: { zone: "couloir1", cote: "bas", x: 15, y: 7, nom: "la salle Lune", plaque: "LUNE" },
  labo: { zone: "couloir2", cote: "haut", x: 5, y: 1, nom: "le Labo", plaque: "LABO" },
  jupiter: {
    zone: "couloir2",
    cote: "haut",
    x: 13,
    y: 1,
    nom: "la salle Jupiter",
    plaque: "JUPITER",
  },
  mercure: {
    zone: "couloir2",
    cote: "bas",
    x: 6,
    y: 7,
    nom: "la salle Mercure",
    plaque: "MERCURE",
  },
  saturne: {
    zone: "couloir2",
    cote: "bas",
    x: 14,
    y: 7,
    nom: "la salle Saturne",
    plaque: "SATURNE",
  },
  terre: { zone: "aile", cote: "droite", x: 8, y: 5, nom: "la salle Terre", plaque: "TERRE" },
  uranus: { zone: "aile", cote: "droite", x: 8, y: 9, nom: "la salle Uranus", plaque: "URANUS" },
  mars: { zone: "aile", cote: "droite", x: 8, y: 13, nom: "la salle Mars", plaque: "MARS" },
};
const NOMS_SALLES: Record<SalleId, string> = {
  wc: "WC",
  direction: "Direction",
  commerce: "Commerce",
  cafe: "Café",
  soleil: "Salle Soleil",
  serveurs: "Serveurs",
  developpeur: "Développeur",
  referent: "Référent Informatique",
  pedagogie: "Pédagogie",
  venus: "Salle Vénus",
  lune: "Salle Lune",
  labo: "Labo",
  jupiter: "Salle Jupiter",
  mercure: "Salle Mercure",
  saturne: "Salle Saturne",
  terre: "Salle Terre",
  uranus: "Salle Uranus",
  mars: "Salle Mars",
};
const ENTREE_SALLE: Arrivee = { x: 5, y: 8, dir: "haut" };

const retour = (p: PorteDef): Arrivee =>
  p.cote === "haut"
    ? { x: p.x, y: p.y + 1, dir: "bas" }
    : p.cote === "bas"
      ? { x: p.x, y: p.y - 1, dir: "haut" }
      : { x: p.x - 1, y: p.y, dir: "gauche" };

/** Les portes (objets) d'un couloir, construites à partir du tableau PORTES. */
function portesDe(zone: ZoneId): Objet[] {
  return (Object.entries(PORTES) as [SalleId, PorteDef][])
    .filter(([, p]) => p.zone === zone)
    .map(([id, p]) => {
      const agir: Agir = { k: "porte", vers: id, arrivee: ENTREE_SALLE, nom: p.nom };
      if (p.cote === "droite")
        return o("porteV", p.x, p.y, { label: p.plaque, agir, ...(p.c ? { c: p.c } : {}) });
      return o("porteH", p.x, p.y, {
        label: p.plaque,
        agir,
        hh: p.cote === "haut" ? 1 : 0,
        hb: p.cote === "bas" ? 1 : 0,
      });
    });
}

/* ───────────── Thèmes (couleurs de l'école : bleu et orange) ───────────── */
const th = (
  sol: Theme["sol"],
  mur: string,
  murBas: string,
  trait: string,
  plinthe: string,
): Theme => ({ sol, mur, murBas, trait, plinthe });
const T = {
  accueil: th(
    { type: "damier", c1: "#f0ddb6", c2: "#dcbc84" },
    "#f3ead7",
    "#2b4b9a",
    "#e07a2b",
    "#1c3270",
  ),
  couloir: th(
    { type: "lino", c1: "#dcb887", c2: "#b98a52" },
    "#f6eddc",
    "#e07a2b",
    "#2b4b9a",
    "#a8501a",
  ),
  aile: th(
    { type: "parquet", c1: "#d9a566", c2: "#a8743a" },
    "#efe3cf",
    "#3b7d5a",
    "#f2c14e",
    "#24523a",
  ),
  direction: th(
    { type: "parquet", c1: "#8a5a36", c2: "#5f3b22" },
    "#8c2a36",
    "#561720",
    "#e8c36a",
    "#33090f",
  ),
  commerce: th(
    { type: "moquette", c1: "#4a78b8", c2: "#3b639c" },
    "#efe6d0",
    "#2b4b7a",
    "#e8c36a",
    "#1a2f52",
  ),
  cafe: th(
    { type: "damier", c1: "#f4e2b8", c2: "#d98c4c" },
    "#f6bd6a",
    "#b0561c",
    "#fff2cf",
    "#7a3510",
  ),
  soleil: th(
    { type: "moquette", c1: "#f3d56e", c2: "#e2bd45" },
    "#fff2c4",
    "#f0a830",
    "#ffffff",
    "#b8741a",
  ),
  wc: th(
    { type: "carrelage", c1: "#d3ecf6", c2: "#8fc5dc" },
    "#e8f6fb",
    "#5aa6c8",
    "#ffffff",
    "#3b7f9e",
  ),
  serveurs: th(
    { type: "damier", c1: "#2f7d86", c2: "#256a73" },
    "#1f3b5c",
    "#142a45",
    "#4fd1c5",
    "#0c1a2c",
  ),
  developpeur: th(
    { type: "moquette", c1: "#7157b0", c2: "#5f479a" },
    "#ece3f7",
    "#43307a",
    "#c9b3f5",
    "#2b1d52",
  ),
  referent: th(
    { type: "moquette", c1: "#58985f", c2: "#468550" },
    "#e6f0dc",
    "#2f6b3d",
    "#f2c14e",
    "#1d4527",
  ),
  labo: th(
    { type: "lino", c1: "#b3e3c9", c2: "#86c9a6" },
    "#e3f6ec",
    "#3a9a78",
    "#ffffff",
    "#236b52",
  ),
  pedagogie: th(
    { type: "parquet", c1: "#e2b274", c2: "#b88649" },
    "#e8f1dc",
    "#6c9a3f",
    "#ffffff",
    "#47672a",
  ),
  jupiter: th(
    { type: "parquet", c1: "#c98550", c2: "#8e5a30" },
    "#f0d9b8",
    "#b0642a",
    "#f6e3bf",
    "#6e3c14",
  ),
  venus: th(
    { type: "moquette", c1: "#e8a98c", c2: "#d58f70" },
    "#fbe4d6",
    "#d9728f",
    "#ffe9f0",
    "#9a3f58",
  ),
  lune: th(
    { type: "moquette", c1: "#9cc3e8", c2: "#7fabd6" },
    "#e3f0fb",
    "#5a86bd",
    "#ffffff",
    "#355a8a",
  ),
  mercure: th(
    { type: "carrelage", c1: "#8fdad0", c2: "#4fb3a8" },
    "#dff6f2",
    "#2f9c92",
    "#ffffff",
    "#1c6a62",
  ),
  saturne: th(
    { type: "parquet", c1: "#e6c260", c2: "#b8923a" },
    "#fff0c0",
    "#c99a2a",
    "#fff8dc",
    "#80600f",
  ),
  terre: th(
    { type: "damier", c1: "#8fd08a", c2: "#6cb7e0" },
    "#e2f4dc",
    "#3f8f4f",
    "#ffffff",
    "#27602f",
  ),
  uranus: th(
    { type: "lino", c1: "#a8e6ee", c2: "#76cbd8" },
    "#e2f9fb",
    "#3fb0c4",
    "#ffffff",
    "#237b8c",
  ),
  mars: th(
    { type: "carrelage", c1: "#d9694c", c2: "#9c3a22" },
    "#f6d6c8",
    "#b8452a",
    "#ffe0d2",
    "#74240f",
  ),
};

/* ───────────── Couloirs et accueil ───────────── */
const COUL = ["#3b7bd1", "#e07a2b", "#2f9e5a", "#d9483b", "#f2c14e", "#8b5fbf"];
const rangee = (kind: Kind, xs: number[], y: number, cs?: string[]) =>
  xs.map((x, i) => o(kind, x, y, cs ? { c: cs[i % cs.length]! } : {}));
const sortie = (r: Rect, vers: ZoneId, arrivee: Arrivee): Sortie => ({ ...r, vers, arrivee });

const accueil: Zone = {
  id: "accueil",
  nom: "Accueil",
  l: 22,
  h: 15,
  murs: { haut: 2, bas: 1, gauche: 1, droite: 1 },
  ouvertures: [],
  theme: T.accueil,
  depart: { x: 2, y: 7, dir: "droite" },
  lieu: "accueil",
  sorties: [sortie({ x: 21, y: 2, w: 1, h: 2 }, "couloir1", { x: 1, y: 3, dir: "droite" })],
  objets: [
    o("entree", 0, 6, {
      agir: {
        k: "texte",
        titre: "Entrée",
        texte:
          "L'entrée principale d'Isitech. Tu es déjà dans l'école : le Café, la Direction, le Commerce et la salle Soleil sont à l'est, et les couloirs de salles de classe à l'est aussi.",
      },
    }),
    o("fleche", 1, 6),
    o("ascenseur", 0, 10, {
      agir: {
        k: "texte",
        titre: "Ascenseur",
        texte: "L'ascenseur est en maintenance. Les étages arriveront dans une prochaine version !",
      },
    }),
    ...portesDe("accueil"),
    o("horloge", 6, 1),
    o("logo", 8, 1),
    o("fenetre", 13, 1),
    o("fenetre", 15, 1),
    o("panneau", 17, 1, { agir: { k: "tableau" } }),
    o("affiche", 20, 1, { v: "reseau" }),
    o("comptoir", 8, 6, { w: 3 }),
    o("poste", 11, 6),
    o("tapis", 2, 6, { w: 5, h: 2 }),
    ...rangee("casiers", [4, 5, 6, 7, 8, 9], 12, COUL),
    o("banc", 3, 3),
    o("banc", 13, 9),
    o("plante", 1, 2),
    o("plante", 1, 13),
    o("plante", 19, 13),
    o("plante", 18, 4),
    o("distributeur", 19, 2),
  ],
  pnjs: [
    pnj(
      "accueil-hotesse",
      9,
      5,
      "bas",
      "Hôtesse",
      "Bienvenue à Isitech ! Pour déposer ou consulter des cours, utilise un ordinateur et entre sur le réseau Isitech. Les salles de classe sont dans les couloirs, à l'est.",
    ),
    pnj(
      "accueil-eleve1",
      5,
      4,
      "bas",
      "Élève",
      "J'ai cours en salle Jupiter ce matin... mais je ne sais plus où c'est. Le plan est dans ton menu !",
    ),
    pnj(
      "accueil-eleve2",
      16,
      8,
      "gauche",
      "Élève",
      "Si tu as soif, le distributeur est tout près de la sortie vers les couloirs.",
    ),
  ],
};

const couloir1: Zone = {
  id: "couloir1",
  nom: "Couloir ouest",
  l: 26,
  h: 9,
  murs: { haut: 2, bas: 2, gauche: 1, droite: 1 },
  ouvertures: [{ x: 1, y: 7, w: 2, h: 2 }],
  theme: T.couloir,
  depart: { x: 2, y: 3, dir: "droite" },
  lieu: "couloir1",
  sorties: [
    sortie({ x: 0, y: 3, w: 1, h: 2 }, "accueil", { x: 20, y: 3, dir: "gauche" }),
    sortie({ x: 25, y: 3, w: 1, h: 2 }, "couloir2", { x: 1, y: 3, dir: "droite" }),
    sortie({ x: 1, y: 8, w: 2, h: 1 }, "aile", { x: 3, y: 2, dir: "bas" }),
  ],
  objets: [
    ...portesDe("couloir1"),
    o("fenetre", 2, 1),
    o("panneau", 6, 1),
    o("fenetre", 10, 1),
    o("horloge", 11, 1),
    o("fenetre", 15, 1),
    o("fenetre", 17, 1),
    o("affiche", 19, 1, { v: "reseau" }),
    o("panneau", 21, 1),
    o("fenetre", 24, 1),
    ...rangee("casiers", [7, 8, 12, 13, 18, 19, 20], 6, COUL),
    o("distributeur", 23, 2),
    o("plante", 24, 6),
    o("plante", 1, 2),
  ],
  pnjs: [
    pnj(
      "c1-eleve1",
      9,
      4,
      "gauche",
      "Élève",
      "La salle des serveurs, c'est la première porte en haut. Il paraît que des virus s'y sont installés...",
    ),
    pnj(
      "c1-eleve2",
      20,
      4,
      "bas",
      "Élève",
      "Va tout au bout à l'ouest en bas : il y a l'aile des salles Terre, Uranus et Mars.",
    ),
  ],
};

const couloir2: Zone = {
  id: "couloir2",
  nom: "Couloir est",
  l: 22,
  h: 9,
  murs: { haut: 2, bas: 2, gauche: 1, droite: 1 },
  ouvertures: [],
  theme: T.couloir,
  depart: { x: 2, y: 3, dir: "droite" },
  lieu: "couloir2",
  sorties: [sortie({ x: 0, y: 3, w: 1, h: 2 }, "couloir1", { x: 24, y: 3, dir: "gauche" })],
  objets: [
    ...portesDe("couloir2"),
    o("fenetre", 2, 1),
    o("fenetre", 8, 1),
    o("panneau", 10, 1),
    o("fenetre", 16, 1),
    o("fenetre", 18, 1),
    o("affiche", 20, 1, { v: "reseau" }),
    o("fenetre", 21, 3, { hh: 0 }),
    ...rangee("casiers", [9, 10, 17, 18], 6, COUL),
    o("distributeur", 3, 2),
    o("plante", 20, 2),
    o("plante", 20, 6),
  ],
  pnjs: [
    pnj(
      "c2-eleve",
      11,
      4,
      "droite",
      "Élève",
      "Le Labo et la salle Jupiter sont juste ici. Mercure et Saturne se trouvent de l'autre côté du couloir.",
    ),
  ],
};

const aile: Zone = {
  id: "aile",
  nom: "Aile des planètes",
  l: 9,
  h: 18,
  murs: { haut: 2, bas: 1, gauche: 1, droite: 1 },
  ouvertures: [{ x: 3, y: 0, w: 2, h: 2 }],
  theme: T.aile,
  depart: { x: 3, y: 3, dir: "bas" },
  lieu: "aile",
  sorties: [sortie({ x: 3, y: 0, w: 2, h: 1 }, "couloir1", { x: 1, y: 6, dir: "haut" })],
  objets: [
    ...portesDe("aile"),
    o("planete", 1, 1, { c: "#c98d5f" }),
    o("planete", 2, 1, { c: "#5fc4d9", v: "anneau" }),
    o("planete", 6, 1, { c: "#4aa3df" }),
    o("horloge", 7, 1),
    o("fenetre", 0, 4, { hh: 0 }),
    o("fenetre", 0, 8, { hh: 0 }),
    o("fenetre", 0, 12, { hh: 0 }),
    o("banc", 1, 7),
    o("banc", 1, 11),
    o("plante", 1, 16),
    o("plante", 6, 16),
    o("plante", 6, 3),
  ],
  pnjs: [
    pnj(
      "aile-eleve",
      4,
      12,
      "gauche",
      "Élève",
      "Terre, Uranus et Mars : trois salles de cours dans cette aile. Chacune a sa couleur !",
    ),
  ],
};

/* ───────────── Salles ───────────── */
function salle(id: SalleId, theme: Theme, objets: Objet[], pnjs: PnjDef[]): Zone {
  const p = PORTES[id];
  const sortieSalle = o("porteH", 5, 9, {
    label: "SORTIE",
    hh: 0,
    hb: 1,
    agir: { k: "porte", vers: p.zone, arrivee: retour(p), nom: "la sortie" },
  });
  return {
    id,
    nom: NOMS_SALLES[id],
    l: 12,
    h: 11,
    murs: { haut: 2, bas: 2, gauche: 1, droite: 1 },
    ouvertures: [],
    theme,
    depart: ENTREE_SALLE,
    lieu: id,
    sorties: [],
    objets: [sortieSalle, ...objets],
    pnjs,
  };
}

type Variante = "A" | "B" | "C";
function classe(
  id: SalleId,
  theme: Theme,
  planete: { c: string; v?: string },
  v: Variante,
  extras: Objet[],
  pnjs: PnjDef[],
): Zone {
  const murs = [
    o("fenetre", 1, 1),
    o("horloge", 2, 1),
    o("tableau", 3, 1),
    o("planete", 8, 1, { c: planete.c, ...(planete.v ? { v: planete.v } : {}) }),
    o("fenetre", 10, 1),
  ];
  const bureaux: Objet[] =
    v === "A"
      ? [
          o("poste", 2, 5),
          o("poste", 5, 5),
          o("bureau", 8, 5),
          o("bureau", 2, 7),
          o("bureau", 5, 7),
          o("bureau", 8, 7),
          o("poste", 8, 3),
        ]
      : v === "B"
        ? [
            o("tapis", 4, 4, { w: 3, h: 4, c: "#3b6fb0", c2: "#e8c36a" }),
            o("poste", 1, 5),
            o("bureau", 1, 7),
            o("poste", 8, 5),
            o("bureau", 8, 7),
            o("poste", 2, 3),
          ]
        : [o("table", 2, 5), o("table", 5, 5), o("table", 8, 5), o("poste", 5, 3)];
  return salle(id, theme, [...murs, ...bureaux, ...extras], pnjs);
}

const SALLES_DEF: Zone[] = [
  salle(
    "direction",
    T.direction,
    [
      o("fenetre", 2, 1),
      o("horloge", 7, 1),
      o("fenetre", 9, 1),
      o("etagere", 4, 2),
      o("grandbureau", 4, 4),
      o("poste", 8, 3),
      o("tapis", 3, 6, { w: 6, h: 2, c: "#7a1f2b", c2: "#e8c36a" }),
      o("canape", 8, 7, { c: "#2b4b9a" }),
      o("plante", 1, 2),
      o("plante", 10, 2),
      o("lampadaire", 1, 6),
    ],
    [
      pnj(
        "dir-directeur",
        5,
        3,
        "bas",
        "Directeur",
        "Bienvenue dans mon bureau. Continue à bien travailler : le BTS SIO, ça se prépare tous les jours !",
      ),
    ],
  ),

  salle(
    "commerce",
    T.commerce,
    [
      o("fenetre", 1, 1),
      o("tableau", 3, 1),
      o("affiche", 8, 1, { v: "reseau" }),
      o("fenetre", 10, 1),
      o("poste", 2, 3),
      o("poste", 2, 5),
      o("poste", 7, 3),
      o("poste", 7, 5),
      o("armoire", 10, 3),
      o("imprimante", 10, 5),
      o("plante", 10, 7),
    ],
    [
      pnj(
        "com-agent",
        5,
        4,
        "bas",
        "Chargé de commerce",
        "Ici, on s'occupe des inscriptions et des partenariats avec les entreprises. Pour ton stage, c'est la bonne porte.",
      ),
    ],
  ),

  salle(
    "cafe",
    T.cafe,
    [
      o("fenetre", 2, 1),
      o("fenetre", 5, 1),
      o("tableauHeros", 9, 1, { agir: { k: "classement" } }),
      o("comptoir", 2, 3, { w: 4 }),
      o("machinecafe", 7, 2),
      o("frigo", 8, 2),
      o("table", 3, 5),
      o("table", 7, 5),
      o("chaise", 2, 5, { c: "#d9483b" }),
      o("chaise", 5, 6, { c: "#2f6fd1" }),
      o("chaise", 6, 6, { c: "#2f9e5a" }),
      o("chaise", 9, 5, { c: "#f2c14e" }),
      o("canape", 8, 8, { c: "#e07a2b" }),
      o("plante", 10, 7),
      o("plante", 1, 8),
    ],
    [
      pnj(
        "cafe-cuistot",
        3,
        2,
        "bas",
        "Cuistot",
        "Un café ? Le tableau des héros, au fond, montre les meilleurs élèves de la classe. Essaie d'y entrer !",
      ),
      pnj(
        "cafe-eleve",
        9,
        6,
        "gauche",
        "Élève",
        "Je révise mes DHCP avec un croissant. Efficace, non ?",
      ),
    ],
  ),

  salle(
    "soleil",
    T.soleil,
    [
      o("planete", 1, 1, { c: "#f2c14e", v: "soleil" }),
      o("ecranmur", 3, 1, { w: 6 }),
      o("planete", 10, 1, { c: "#f2c14e", v: "soleil" }),
      o("bureau", 2, 4),
      o("bureau", 5, 4),
      o("bureau", 8, 4),
      o("bureau", 2, 6),
      o("bureau", 5, 6),
      o("bureau", 8, 6),
      o("poste", 9, 2),
      o("plante", 1, 2),
      o("lampadaire", 1, 7),
      o("plante", 10, 8),
    ],
    [
      pnj(
        "soleil-eleve",
        10,
        5,
        "gauche",
        "Élève",
        "La salle Soleil sert aux grandes conférences et aux projets de groupe. Il y a toujours de la lumière.",
      ),
    ],
  ),

  salle(
    "wc",
    T.wc,
    [
      o("fenetre", 1, 1),
      ...rangee("cabine", [2, 3, 4], 2),
      o("affiche", 6, 1, { c: "#fff" }),
      o("miroir", 7, 1),
      o("miroir", 8, 1),
      o("miroir", 9, 1),
      o("lavabo", 7, 2),
      o("lavabo", 8, 2),
      o("lavabo", 9, 2),
      o("poubelle", 10, 3),
      o("plante", 1, 8),
      o("banc", 8, 7),
    ],
    [
      pnj(
        "wc-eleve",
        5,
        5,
        "bas",
        "Élève",
        "Pas grand-chose à voir ici. À part que c'est propre !",
      ),
    ],
  ),

  salle(
    "serveurs",
    T.serveurs,
    [
      o("clim", 5, 1),
      ...rangee("baie", [2, 3, 4, 8, 9, 10], 2),
      o("poste", 5, 4),
      o("baie", 1, 5),
      o("baie", 1, 6),
      o("baie", 10, 5),
      o("baie", 10, 6),
      o("poubelle", 10, 8),
    ],
    [
      monstre("virus", "Virus", 3, 5),
      monstre("malware", "Malware", 8, 5),
      monstre("bug", "Bug", 4, 7),
      monstre("ransomware", "Ransomware", 9, 7),
    ],
  ),

  salle(
    "developpeur",
    T.developpeur,
    [
      o("fenetre", 1, 1),
      o("tableau", 3, 1),
      o("affiche", 8, 1, { v: "reseau" }),
      o("fenetre", 10, 1),
      o("poste", 2, 3),
      o("poste", 2, 5),
      o("poste", 7, 3),
      o("poste", 7, 5),
      o("canape", 8, 7, { c: "#d9483b" }),
      o("lampadaire", 1, 7),
      o("plante", 10, 3),
    ],
    [
      pnj(
        "dev-dev",
        5,
        6,
        "droite",
        "Développeur",
        "Je teste mon site web sur le réseau... enfin, le jeu que tu vois ici est un projet de classe !",
      ),
    ],
  ),

  salle(
    "referent",
    T.referent,
    [
      o("fenetre", 3, 1),
      o("affiche", 5, 1, { v: "reseau" }),
      o("fenetre", 7, 1),
      o("armoire", 1, 3),
      o("armoire", 2, 3),
      o("grandbureau", 4, 4),
      o("poste", 8, 3),
      o("imprimante", 10, 5),
      o("tapis", 3, 6, { w: 6, h: 2, c: "#2f6b3d", c2: "#f2c14e" }),
      o("plante", 10, 2),
      o("plante", 1, 7),
    ],
    [
      pnj(
        "ref-ref",
        5,
        3,
        "bas",
        "Référent informatique",
        "Un souci avec ton ordinateur ? Redémarre-le d'abord. Ça règle 80 % des problèmes.",
      ),
    ],
  ),

  salle(
    "labo",
    T.labo,
    [
      o("tableau", 2, 1),
      o("fenetre", 7, 1),
      o("lavabo", 1, 2),
      o("table", 2, 4, { c: "#f1ead6" }),
      o("table", 8, 4, { c: "#f1ead6" }),
      o("poste", 5, 5),
      o("baie", 9, 2),
      o("baie", 10, 2),
      o("armoire", 10, 7),
      o("plante", 1, 8),
    ],
    [
      pnj(
        "labo-chercheur",
        5,
        3,
        "bas",
        "Technicien",
        "Dans ce labo, on monte des réseaux de test : routeurs, switchs, câbles... C'est là que tout s'apprend.",
      ),
    ],
  ),

  salle(
    "pedagogie",
    T.pedagogie,
    [
      o("panneau", 4, 1),
      o("fenetre", 7, 1),
      o("horloge", 8, 1),
      o("etagere", 1, 2),
      o("etagere", 9, 2),
      o("grandbureau", 3, 4),
      o("poste", 7, 4),
      o("tapis", 2, 6, { w: 5, h: 2, c: "#3b7d5a", c2: "#f2c14e" }),
      o("plante", 10, 7),
    ],
    [
      pnj(
        "ped-resp",
        4,
        3,
        "bas",
        "Responsable pédagogique",
        "Les plannings, les notes, les projets... tout passe par ce bureau. Bonne année !",
      ),
    ],
  ),

  classe(
    "jupiter",
    T.jupiter,
    { c: "#d9a066" },
    "A",
    [o("armoire", 10, 3, { c: "#c98550" }), o("plante", 1, 8), o("poubelle", 10, 8)],
    [
      pnj(
        "jup-prof",
        7,
        3,
        "bas",
        "Professeur",
        "En salle Jupiter, on voit les réseaux : adressage IP, VLAN, routage. Les plus gros sujets de l'année !",
      ),
    ],
  ),
  classe(
    "venus",
    T.venus,
    { c: "#e8a33d" },
    "B",
    [o("lampadaire", 10, 3), o("plante", 1, 3), o("plante", 10, 8)],
    [
      pnj(
        "ven-eleve",
        6,
        7,
        "bas",
        "Élève",
        "Chez Vénus on aime bien le travail en binôme. Et les bonnes notes !",
      ),
    ],
  ),
  classe(
    "lune",
    T.lune,
    { c: "#dfe9f4" },
    "C",
    [o("armoire", 10, 3, { c: "#e6f0f8" }), o("imprimante", 1, 3), o("plante", 10, 8)],
    [
      pnj(
        "lun-prof",
        7,
        3,
        "bas",
        "Professeur",
        "La salle Lune est la plus calme de l'école. Parfait pour réviser le système et les serveurs.",
      ),
    ],
  ),
  classe(
    "mercure",
    T.mercure,
    { c: "#5fb8b0" },
    "A",
    [o("baie", 10, 3), o("plante", 1, 8), o("poubelle", 10, 8)],
    [
      pnj(
        "mer-eleve",
        4,
        6,
        "droite",
        "Élève",
        "Mercure : la salle des TP de virtualisation. On y crée des machines virtuelles à la chaîne.",
      ),
    ],
  ),
  classe(
    "saturne",
    T.saturne,
    { c: "#e6c260", v: "anneau" },
    "B",
    [o("lampadaire", 10, 3), o("armoire", 10, 5, { c: "#d9a14e" }), o("plante", 1, 3)],
    [
      pnj(
        "sat-prof",
        6,
        2,
        "bas",
        "Professeur",
        "Saturne a des anneaux, nos élèves ont des anneaux de câbles. C'est la même chose, non ?",
      ),
    ],
  ),
  classe(
    "terre",
    T.terre,
    { c: "#4aa3df" },
    "C",
    [o("plante", 10, 3), o("plante", 1, 3), o("poubelle", 1, 8)],
    [
      pnj(
        "ter-eleve",
        9,
        8,
        "gauche",
        "Élève",
        "La Terre, c'est ma salle préférée. Elle a des fenêtres sur toute la longueur !",
      ),
    ],
  ),
  classe(
    "uranus",
    T.uranus,
    { c: "#5fd0e0" },
    "A",
    [o("armoire", 10, 3, { c: "#9fd8e0" }), o("imprimante", 1, 3), o("plante", 10, 8)],
    [
      pnj(
        "ura-prof",
        7,
        3,
        "bas",
        "Professeur",
        "Uranus, c'est la planète qui roule sur le côté. Ici on roule sur Linux.",
      ),
    ],
  ),
  classe(
    "mars",
    T.mars,
    { c: "#d9483b" },
    "B",
    [o("baie", 10, 3), o("poubelle", 1, 8), o("plante", 10, 8)],
    [
      pnj(
        "mar-eleve",
        6,
        7,
        "haut",
        "Élève",
        "Mars, c'est la salle rouge. Il fait toujours un peu chaud avec tous ces ordinateurs.",
      ),
    ],
  ),
];

export const ZONES: Record<ZoneId, Zone> = Object.fromEntries(
  [accueil, couloir1, couloir2, aile, ...SALLES_DEF].map((z) => [z.id, z]),
) as Record<ZoneId, Zone>;

/** Zone de départ du joueur : l'accueil. */
export const ZONE_DEPART: ZoneId = "accueil";
