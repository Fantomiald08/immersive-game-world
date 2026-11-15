import { auteurApprouve } from "./admins";
import { CATEGORIES } from "./categories";
import {
  categoriesAffichees,
  organisationInitiale,
  resoudreCategorie,
  type OrgCategorie,
  type Organisation,
} from "./organisation";
import type { CoursReseau, QuizReseau, Reseau } from "./reseau";

export type CoursVue = CoursReseau & {
  cle: string;
  categorieNom: string;
  masque: boolean;
  quiz: QuizReseau[];
};
export type QuizJouable = { quiz: QuizReseau; cours: CoursVue };
export type Vue = {
  organisation: Organisation;
  orgExiste: boolean;
  categories: OrgCategorie[];
  cours: CoursVue[]; // cours visibles
  masques: CoursVue[]; // cours masqués par un admin
  quizJouables: QuizJouable[]; // quiz utilisables dans les combats (validés)
  quizAValider: QuizJouable[]; // quiz en attente de validation par un admin
};

/** Combine les données du réseau avec l'organisation des admins : catégories finales, cours visibles, quiz validés. */
export function construireVue(r: Reseau): Vue {
  const anciens = r.categories.map((c) => c.nom);
  const orgExiste = r.organisation !== null;
  const organisation =
    r.organisation ?? organisationInitiale([...new Set([...CATEGORIES, ...anciens])]);
  const nomDe = new Map(organisation.categories.map((c) => [c.cle, c.nom]));

  const tous: CoursVue[] = r.cours.map((c) => {
    const cle = resoudreCategorie(organisation, c.id, c.categorie);
    return {
      ...c,
      cle,
      categorieNom: nomDe.get(cle) ?? cle,
      masque: organisation.masques.includes(c.id),
      quiz: [],
    };
  });
  const parId = new Map(tous.map((c) => [c.id, c]));

  const quizJouables: QuizJouable[] = [],
    quizAValider: QuizJouable[] = [];
  for (const q of r.quiz) {
    const cours = parId.get(q.coursId);
    if (!cours) continue;
    const admin = auteurApprouve(q.auteurId, q.auteur);
    if (!admin && q.auteurId !== cours.auteurId) continue; // un quiz posé par un inconnu sur le cours d'un autre est ignoré
    cours.quiz.push(q);
    if (cours.masque) continue;
    (admin || organisation.quizValides.includes(q.id) ? quizJouables : quizAValider).push({
      quiz: q,
      cours,
    });
  }
  return {
    organisation,
    orgExiste,
    categories: categoriesAffichees(organisation),
    cours: tous.filter((c) => !c.masque),
    masques: tous.filter((c) => c.masque),
    quizJouables,
    quizAValider,
  };
}
