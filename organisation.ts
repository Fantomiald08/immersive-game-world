/**
 * Organisation du réseau cours, gérée par les admins : catégories (ordre, noms), cours déplacés ou masqués, quiz validés.
 * C'est un document unique (une ligne de la table "courses", type "__organisation__") écrit par un admin.
 * Les élèves ne lisent QUE les documents écrits par un admin : un élève ne peut donc pas imposer sa propre organisation.
 * Renommer ou supprimer une catégorie ne touche pas aux cours (ils appartiennent à leurs auteurs) : on garde des correspondances.
 */
export type OrgCategorie = { cle: string; nom: string };
export type Organisation = {
  v: 1;
  categories: OrgCategorie[];
  /** Catégorie supprimée → catégorie de remplacement. */
  redirections: Record<string, string>;
  /** Cours déplacé par un admin : identifiant du cours → catégorie. */
  deplacements: Record<string, string>;
  /** Cours masqués par un admin. */
  masques: string[];
  /** Quiz validés pour les combats. */
  quizValides: string[];
};

export const CLE_AUTRE = "Autre";
export class ErreurOrg extends Error {}

export const organisationInitiale = (noms: readonly string[]): Organisation => ({
  v: 1,
  categories: [
    ...noms.filter((n) => n !== CLE_AUTRE).map((n) => ({ cle: n, nom: n })),
    { cle: CLE_AUTRE, nom: CLE_AUTRE },
  ],
  redirections: {},
  deplacements: {},
  masques: [],
  quizValides: [],
});

export function lireOrganisation(texte: string): Organisation | null {
  try {
    const j = JSON.parse(texte) as Partial<Organisation>;
    if (!j || j.v !== 1 || !Array.isArray(j.categories)) return null;
    const categories = j.categories.filter(
      (c): c is OrgCategorie => !!c && typeof c.cle === "string" && typeof c.nom === "string",
    );
    const o: Organisation = {
      v: 1,
      categories,
      redirections:
        j.redirections && typeof j.redirections === "object" ? { ...j.redirections } : {},
      deplacements:
        j.deplacements && typeof j.deplacements === "object" ? { ...j.deplacements } : {},
      masques: Array.isArray(j.masques)
        ? j.masques.filter((x): x is string => typeof x === "string")
        : [],
      quizValides: Array.isArray(j.quizValides)
        ? j.quizValides.filter((x): x is string => typeof x === "string")
        : [],
    };
    return garantirAutre(o);
  } catch {
    return null;
  }
}

const garantirAutre = (o: Organisation): Organisation =>
  o.categories.some((c) => c.cle === CLE_AUTRE)
    ? o
    : { ...o, categories: [...o.categories, { cle: CLE_AUTRE, nom: CLE_AUTRE }] };

/** Catégories à afficher : dans l'ordre choisi, « Autre » toujours en dernier. */
export const categoriesAffichees = (o: Organisation): OrgCategorie[] => [
  ...o.categories.filter((c) => c.cle !== CLE_AUTRE),
  ...o.categories.filter((c) => c.cle === CLE_AUTRE),
];

/** Catégorie finale d'un cours, en tenant compte des déplacements et des suppressions. */
export function resoudreCategorie(
  o: Organisation,
  coursId: string,
  categorieBrute: string,
): string {
  let cle = o.deplacements[coursId] ?? categorieBrute;
  for (let i = 0; i < 8; i++) {
    if (o.categories.some((c) => c.cle === cle)) return cle;
    const r = o.redirections[cle];
    if (!r) break;
    cle = r;
  }
  // Anciens cours rangés sous un nom qui correspond à une catégorie
  const parNom = o.categories.find((c) => c.nom.toLowerCase() === categorieBrute.toLowerCase());
  return parNom ? parNom.cle : CLE_AUTRE;
}

const nomValide = (o: Organisation, nom: string, sauf?: string): string => {
  const n = nom.replace(/\s+/g, " ").trim();
  if (n.length < 2 || n.length > 40)
    throw new ErreurOrg("Le nom doit faire entre 2 et 40 caractères.");
  if (o.categories.some((c) => c.cle !== sauf && c.nom.toLowerCase() === n.toLowerCase()))
    throw new ErreurOrg("Une catégorie porte déjà ce nom.");
  return n;
};
const nouvelleCle = (o: Organisation) => {
  let c: string;
  do c = `c${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  while (o.categories.some((x) => x.cle === c));
  return c;
};

export function ajouterCategorie(o: Organisation, nom: string): Organisation {
  const n = nomValide(o, nom);
  const sansAutre = o.categories.filter((c) => c.cle !== CLE_AUTRE),
    autre = o.categories.filter((c) => c.cle === CLE_AUTRE);
  return { ...o, categories: [...sansAutre, { cle: nouvelleCle(o), nom: n }, ...autre] };
}

export function renommerCategorie(o: Organisation, cle: string, nom: string): Organisation {
  if (cle === CLE_AUTRE) throw new ErreurOrg("La catégorie « Autre » ne peut pas être renommée.");
  const n = nomValide(o, nom, cle);
  return { ...o, categories: o.categories.map((c) => (c.cle === cle ? { ...c, nom: n } : c)) };
}

/** Supprime une catégorie : ses cours passent dans la catégorie « vers » (par défaut « Autre »). */
export function supprimerCategorie(
  o: Organisation,
  cle: string,
  vers: string = CLE_AUTRE,
): Organisation {
  if (cle === CLE_AUTRE) throw new ErreurOrg("La catégorie « Autre » ne peut pas être supprimée.");
  if (vers === cle || !o.categories.some((c) => c.cle === vers))
    throw new ErreurOrg("Choisis une catégorie de remplacement valide.");
  const redirections: Record<string, string> = {};
  for (const [k, v] of Object.entries(o.redirections)) redirections[k] = v === cle ? vers : v;
  redirections[cle] = vers;
  const deplacements: Record<string, string> = {};
  for (const [k, v] of Object.entries(o.deplacements)) deplacements[k] = v === cle ? vers : v;
  return {
    ...o,
    categories: o.categories.filter((c) => c.cle !== cle),
    redirections,
    deplacements,
  };
}

export function deplacerCategorie(o: Organisation, cle: string, sens: -1 | 1): Organisation {
  const l = o.categories.filter((c) => c.cle !== CLE_AUTRE),
    autre = o.categories.filter((c) => c.cle === CLE_AUTRE);
  const i = l.findIndex((c) => c.cle === cle),
    j = i + sens;
  if (i < 0 || j < 0 || j >= l.length) return o;
  [l[i], l[j]] = [l[j]!, l[i]!];
  return { ...o, categories: [...l, ...autre] };
}

export function deplacerCours(o: Organisation, coursId: string, cle: string | null): Organisation {
  const d = { ...o.deplacements };
  if (cle === null) delete d[coursId];
  else {
    if (!o.categories.some((c) => c.cle === cle)) throw new ErreurOrg("Catégorie inconnue.");
    d[coursId] = cle;
  }
  return { ...o, deplacements: d };
}

export const masquerCours = (o: Organisation, coursId: string, masquer: boolean): Organisation => ({
  ...o,
  masques: masquer ? [...new Set([...o.masques, coursId])] : o.masques.filter((x) => x !== coursId),
});

export const validerQuiz = (o: Organisation, quizId: string, valide: boolean): Organisation => ({
  ...o,
  quizValides: valide
    ? [...new Set([...o.quizValides, quizId])]
    : o.quizValides.filter((x) => x !== quizId),
});
