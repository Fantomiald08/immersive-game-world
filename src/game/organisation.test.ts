import { describe, expect, it } from "vitest";
import {
  ajouterCategorie,
  CLE_AUTRE,
  categoriesAffichees,
  deplacerCategorie,
  deplacerCours,
  ErreurOrg,
  lireOrganisation,
  masquerCours,
  organisationInitiale,
  renommerCategorie,
  resoudreCategorie,
  supprimerCategorie,
  validerQuiz,
} from "./organisation";

const base = () => organisationInitiale(["Réseaux", "Linux", "Cloud", "Autre"]);
const noms = (o: ReturnType<typeof base>) => categoriesAffichees(o).map((c) => c.nom);

describe("organisation des catégories", () => {
  it("part des catégories existantes, « Autre » en dernier", () =>
    expect(noms(base())).toEqual(["Réseaux", "Linux", "Cloud", "Autre"]));

  it("ajoute une catégorie avant « Autre », refuse les doublons et les noms invalides", () => {
    const o = ajouterCategorie(base(), "Cybersécurité");
    expect(noms(o)).toEqual(["Réseaux", "Linux", "Cloud", "Cybersécurité", "Autre"]);
    expect(() => ajouterCategorie(o, "  linux ")).toThrow(ErreurOrg);
    expect(() => ajouterCategorie(o, "A")).toThrow(ErreurOrg);
  });

  it("renomme sans toucher aux cours : le cours reste dans la même catégorie", () => {
    const o = renommerCategorie(base(), "Réseaux", "Réseaux & télécoms");
    expect(noms(o)[0]).toBe("Réseaux & télécoms");
    expect(resoudreCategorie(o, "cours1", "Réseaux")).toBe("Réseaux");
  });

  it("n'autorise pas à renommer ou supprimer « Autre »", () => {
    expect(() => renommerCategorie(base(), CLE_AUTRE, "Divers")).toThrow(ErreurOrg);
    expect(() => supprimerCategorie(base(), CLE_AUTRE)).toThrow(ErreurOrg);
  });

  it("supprime une catégorie : ses cours passent dans la catégorie choisie", () => {
    const o = supprimerCategorie(base(), "Linux", "Cloud");
    expect(noms(o)).not.toContain("Linux");
    expect(resoudreCategorie(o, "c", "Linux")).toBe("Cloud");
    const o2 = supprimerCategorie(base(), "Linux");
    expect(resoudreCategorie(o2, "c", "Linux")).toBe(CLE_AUTRE);
  });

  it("suit les suppressions en chaîne", () => {
    const o = supprimerCategorie(supprimerCategorie(base(), "Linux", "Cloud"), "Cloud", "Réseaux");
    expect(resoudreCategorie(o, "c", "Linux")).toBe("Réseaux");
  });

  it("refuse une catégorie de remplacement invalide", () => {
    expect(() => supprimerCategorie(base(), "Linux", "Linux")).toThrow(ErreurOrg);
    expect(() => supprimerCategorie(base(), "Linux", "inconnue")).toThrow(ErreurOrg);
  });

  it("change l'ordre, sans jamais passer « Autre » devant", () => {
    let o = deplacerCategorie(base(), "Cloud", -1);
    expect(noms(o)).toEqual(["Réseaux", "Cloud", "Linux", "Autre"]);
    o = deplacerCategorie(o, "Cloud", -1);
    o = deplacerCategorie(o, "Cloud", -1);
    expect(noms(o)[0]).toBe("Cloud");
    expect(noms(deplacerCategorie(base(), "Cloud", 1))).toEqual([
      "Réseaux",
      "Linux",
      "Cloud",
      "Autre",
    ]);
  });

  it("déplace un cours dans une autre catégorie, puis le remet à sa place d'origine", () => {
    let o = deplacerCours(base(), "cours1", "Linux");
    expect(resoudreCategorie(o, "cours1", "Réseaux")).toBe("Linux");
    o = deplacerCours(o, "cours1", null);
    expect(resoudreCategorie(o, "cours1", "Réseaux")).toBe("Réseaux");
    expect(() => deplacerCours(base(), "c", "nulle-part")).toThrow(ErreurOrg);
  });

  it("un cours déplacé dans une catégorie supprimée suit la redirection", () => {
    const o = supprimerCategorie(deplacerCours(base(), "c1", "Linux"), "Linux", "Cloud");
    expect(resoudreCategorie(o, "c1", "Réseaux")).toBe("Cloud");
  });

  it("range dans « Autre » un cours dont la catégorie n'existe pas, et reconnaît un ancien nom", () => {
    expect(resoudreCategorie(base(), "c", "Inconnue")).toBe(CLE_AUTRE);
    const o = renommerCategorie(base(), "Cloud", "Infonuagique");
    expect(resoudreCategorie(o, "c", "infonuagique")).toBe("Cloud");
  });

  it("masque et démasque des cours, valide et dévalide des quiz", () => {
    let o = masquerCours(base(), "c1", true);
    expect(o.masques).toEqual(["c1"]);
    o = masquerCours(masquerCours(o, "c1", true), "c1", false);
    expect(o.masques).toEqual([]);
    o = validerQuiz(base(), "q1", true);
    expect(o.quizValides).toEqual(["q1"]);
    expect(validerQuiz(o, "q1", false).quizValides).toEqual([]);
  });

  it("ne modifie jamais l'objet d'origine", () => {
    const o = base(),
      copie = JSON.stringify(o);
    ajouterCategorie(o, "Nouvelle");
    renommerCategorie(o, "Linux", "Linux 2");
    supprimerCategorie(o, "Linux");
    deplacerCours(o, "c", "Cloud");
    masquerCours(o, "c", true);
    expect(JSON.stringify(o)).toBe(copie);
  });

  it("relit un document sauvegardé et ignore un document invalide", () => {
    const o = ajouterCategorie(base(), "Cyber");
    expect(lireOrganisation(JSON.stringify(o))).toEqual(o);
    expect(lireOrganisation("n'importe quoi")).toBeNull();
    expect(lireOrganisation(JSON.stringify({ v: 2 }))).toBeNull();
    const sansAutre = lireOrganisation(
      JSON.stringify({ v: 1, categories: [{ cle: "A", nom: "A" }] }),
    );
    expect(sansAutre!.categories.some((c) => c.cle === CLE_AUTRE)).toBe(true);
  });
});
