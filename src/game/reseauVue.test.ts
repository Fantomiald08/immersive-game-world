import { describe, expect, it } from "vitest";
import { assembler, TYPE_ANNONCE, TYPE_ORG, TYPE_QUIZ } from "./reseau";
import { construireVue } from "./reseauVue";
import {
  ajouterCategorie,
  deplacerCours,
  masquerCours,
  organisationInitiale,
  renommerCategorie,
  validerQuiz,
} from "./organisation";
import { CATEGORIES } from "./categories";

const pseudos = new Map([
  ["admin", "Leo Dupire"],
  ["eleve", "Sarah"],
  ["autre", "Karim"],
]);
let n = 0;
const ligne = (type: string, title: string, text: string, author_id: string) => ({
  id: `id${++n}`,
  title,
  type,
  text,
  author_id,
  created_at: `2026-10-${String(10 + n).padStart(2, "0")}T10:00:00Z`,
});
const cours = (id: string, cat: string, auteur: string) => ({
  ...ligne(
    cat,
    `Cours ${id}`,
    JSON.stringify({
      v: 3,
      description: "",
      contenu: "Texte du cours sur les réseaux informatiques et leurs protocoles.",
    }),
    auteur,
  ),
  id,
});
const questions = Array.from({ length: 3 }, (_, i) => ({
  q: `Question ${i} sur les réseaux ?`,
  choix: ["A", "B", "C", "D"],
  bonne: 0,
  explication: "",
  difficulte: 2,
}));
const quiz = (id: string, coursId: string, auteur: string) => ({
  ...ligne(TYPE_QUIZ, coursId, JSON.stringify({ source: "manuel", questions }), auteur),
  id,
});
const org = (o: unknown, auteur: string) =>
  ligne(TYPE_ORG, "Organisation", JSON.stringify(o), auteur);

describe("vue du réseau (avec les droits admin)", () => {
  it("sans organisation, les catégories par défaut et les anciens cours apparaissent", () => {
    const v = construireVue(assembler([cours("c1", "Réseaux", "eleve")], pseudos));
    expect(v.orgExiste).toBe(false);
    expect(v.categories.map((c) => c.nom)).toEqual([
      ...CATEGORIES.filter((c) => c !== "Autre"),
      "Autre",
    ]);
    expect(v.cours[0]!.cle).toBe("Réseaux");
  });

  it("l'organisation d'un admin s'applique : renommage, nouvelle catégorie, cours déplacé, cours masqué", () => {
    let o = organisationInitiale(CATEGORIES);
    o = renommerCategorie(o, "Réseaux", "Réseaux & télécoms");
    o = ajouterCategorie(o, "Projets");
    o = deplacerCours(o, "c2", "Linux");
    o = masquerCours(o, "c3", true);
    const v = construireVue(
      assembler(
        [
          cours("c1", "Réseaux", "eleve"),
          cours("c2", "Réseaux", "eleve"),
          cours("c3", "Cloud", "autre"),
          org(o, "admin"),
        ],
        pseudos,
      ),
    );
    const par = Object.fromEntries(v.cours.map((c) => [c.id, c.categorieNom]));
    expect(par).toEqual({ c1: "Réseaux & télécoms", c2: "Linux" });
    expect(v.masques.map((c) => c.id)).toEqual(["c3"]);
    expect(v.categories.map((c) => c.nom)).toContain("Projets");
  });

  it("l'organisation écrite par un élève est ignorée", () => {
    const faux = renommerCategorie(organisationInitiale(CATEGORIES), "Réseaux", "PIRATÉ");
    const v = construireVue(
      assembler([cours("c1", "Réseaux", "eleve"), org(faux, "eleve")], pseudos),
    );
    expect(v.orgExiste).toBe(false);
    expect(v.categories.map((c) => c.nom)).not.toContain("PIRATÉ");
  });

  it("la version la plus récente de l'admin fait foi", () => {
    const ancien = renommerCategorie(organisationInitiale(CATEGORIES), "Linux", "Ancien nom");
    const recent = renommerCategorie(organisationInitiale(CATEGORIES), "Linux", "Nouveau nom");
    const v = construireVue(assembler([org(ancien, "admin"), org(recent, "admin")], pseudos));
    expect(v.categories.map((c) => c.nom)).toContain("Nouveau nom");
  });

  it("seules les annonces d'un admin sont affichées", () => {
    const r = assembler(
      [
        ligne(TYPE_ANNONCE, "Vraie annonce", "ok", "admin"),
        ligne(TYPE_ANNONCE, "Fausse annonce", "piège", "eleve"),
      ],
      pseudos,
    );
    expect(r.annonces.map((a) => a.titre)).toEqual(["Vraie annonce"]);
  });

  it("un quiz d'élève attend la validation d'un admin, puis devient jouable", () => {
    const lignes = [cours("c1", "Réseaux", "eleve"), quiz("q1", "c1", "eleve")];
    let v = construireVue(assembler(lignes, pseudos));
    expect(v.quizJouables).toHaveLength(0);
    expect(v.quizAValider).toHaveLength(1);
    const o = validerQuiz(organisationInitiale(CATEGORIES), "q1", true);
    v = construireVue(assembler([...lignes, org(o, "admin")], pseudos));
    expect(v.quizJouables).toHaveLength(1);
    expect(v.quizAValider).toHaveLength(0);
  });

  it("un quiz écrit par un admin est jouable tout de suite", () => {
    const v = construireVue(
      assembler([cours("c1", "Réseaux", "eleve"), quiz("q1", "c1", "admin")], pseudos),
    );
    expect(v.quizJouables).toHaveLength(1);
  });

  it("un quiz posé par un inconnu sur le cours de quelqu'un d'autre est ignoré", () => {
    const v = construireVue(
      assembler([cours("c1", "Réseaux", "eleve"), quiz("q1", "c1", "autre")], pseudos),
    );
    expect(v.quizJouables).toHaveLength(0);
    expect(v.quizAValider).toHaveLength(0);
    expect(v.cours[0]!.quiz).toHaveLength(0);
  });

  it("un cours masqué n'a plus de quiz jouable", () => {
    const o = masquerCours(organisationInitiale(CATEGORIES), "c1", true);
    const v = construireVue(
      assembler(
        [cours("c1", "Réseaux", "eleve"), quiz("q1", "c1", "admin"), org(o, "admin")],
        pseudos,
      ),
    );
    expect(v.quizJouables).toHaveLength(0);
  });

  it("ignore un quiz abîmé sans planter", () => {
    const r = assembler(
      [
        cours("c1", "Réseaux", "eleve"),
        ligne(TYPE_QUIZ, "c1", "pas du json", "admin"),
        ligne(TYPE_QUIZ, "c1", JSON.stringify({ questions: [{ q: "x" }] }), "admin"),
      ],
      pseudos,
    );
    expect(r.quiz).toHaveLength(0);
  });
});
