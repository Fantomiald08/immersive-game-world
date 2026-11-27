import { describe, expect, it } from "vitest";
import { assembler, TAILLE_MAX, TAILLE_MAX_MO, TYPE_ANNONCE, TYPE_ORG, TYPE_QUIZ } from "./reseau";
import { TYPE_FICHE } from "./fiche";
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
  it("un quiz IA de son propre cours est immédiatement jouable pour son auteur seulement", () => {
    const q = quiz("auto", "c1", "eleve");
    q.text = JSON.stringify({ source: "ia", questions });
    const r = assembler([cours("c1", "Réseaux", "eleve"), q], pseudos);
    expect(construireVue(r, "eleve").quizJouables.map((j) => j.quiz.id)).toEqual(["auto"]);
    expect(construireVue(r, "autre").quizJouables).toHaveLength(0);
    expect(construireVue(r, "autre").quizAValider).toHaveLength(1);
  });
  it("un quiz manuel reste soumis à validation même pour son auteur", () => {
    const r = assembler([cours("c1", "Réseaux", "eleve"), quiz("manuel", "c1", "eleve")], pseudos);
    expect(construireVue(r, "eleve").quizJouables).toHaveLength(0);
  });
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

describe("fiches de révision", () => {
  const fiche = (titre: string) => ({ titre, resume: [`Résumé de ${titre}.`], notions: [], pieges: [], aRetenir: [] });
  const ficheLigne = (coursId: string, titre: string, auteur: string) =>
    ligne(TYPE_FICHE, coursId, JSON.stringify(fiche(titre)), auteur);

  it("une fiche n'apparaît jamais comme un cours du réseau", () => {
    const r = assembler([cours("c1", "Réseaux", "eleve"), ficheLigne("c1", "DHCP", "eleve")], pseudos);
    expect(r.cours.map((c) => c.id)).toEqual(["c1"]);
    expect(r.fiches).toHaveLength(1);
  });

  it("la fiche écrite par l'auteur du cours est affichée avec le cours", () => {
    const v = construireVue(assembler([cours("c1", "Réseaux", "eleve"), ficheLigne("c1", "DHCP", "eleve")], pseudos));
    expect(v.cours[0]?.fiche?.titre).toBe("DHCP");
  });

  it("une fiche posée par quelqu'un d'autre sur le cours d'un élève est ignorée", () => {
    const v = construireVue(assembler([cours("c1", "Réseaux", "eleve"), ficheLigne("c1", "Fausse", "autre")], pseudos));
    expect(v.cours[0]?.fiche).toBeNull();
  });

  it("la fiche la plus récente de l'auteur remplace les anciennes", () => {
    const v = construireVue(
      assembler(
        [cours("c1", "Réseaux", "eleve"), ficheLigne("c1", "Ancienne", "eleve"), ficheLigne("c1", "Nouvelle", "eleve")],
        pseudos,
      ),
    );
    expect(v.cours[0]?.fiche?.titre).toBe("Nouvelle");
  });

  it("une fiche illisible est ignorée sans casser le réseau", () => {
    const r = assembler([cours("c1", "Réseaux", "eleve"), ligne(TYPE_FICHE, "c1", "{cassé", "eleve")], pseudos);
    expect(r.fiches).toEqual([]);
    expect(r.cours).toHaveLength(1);
  });
});

describe("taille des fichiers déposés", () => {
  it("accepte jusqu'à 5 Mo et l'indique dans le message", () => {
    expect(TAILLE_MAX_MO).toBe(5);
    expect(TAILLE_MAX).toBe(5 * 1024 * 1024);
  });
});
