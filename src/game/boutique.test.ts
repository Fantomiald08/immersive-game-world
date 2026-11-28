import { describe, expect, it } from "vitest";
import {
  badgeEquipe,
  CATALOGUE,
  couleurPseudoEquipee,
  isicoinsPourXp,
  motifRefusAchat,
  niveauPourXp,
  valeurDe,
} from "./boutique";

describe("monnaie et niveaux", () => {
  it("donne au moins une ISICoin dès qu'il y a un gain d'XP, et rien sans gain", () => {
    expect(isicoinsPourXp(0)).toBe(0);
    expect(isicoinsPourXp(1)).toBe(1);
    expect(isicoinsPourXp(10)).toBe(5);
    expect(isicoinsPourXp(50)).toBe(25);
  });

  it("calcule le niveau à partir de l'XP, un niveau tous les 100 XP", () => {
    expect(niveauPourXp(0)).toBe(1);
    expect(niveauPourXp(99)).toBe(1);
    expect(niveauPourXp(100)).toBe(2);
    expect(niveauPourXp(250)).toBe(3);
    expect(niveauPourXp(-5)).toBe(1);
  });
});

describe("achat", () => {
  it("refuse un article déjà possédé", () => {
    expect(motifRefusAchat({ solde: 999, prix: 10, possede: true })).toContain("déjà");
  });

  it("refuse un solde insuffisant en indiquant ce qui manque", () => {
    expect(motifRefusAchat({ solde: 30, prix: 80, possede: false })).toContain("50 ISICoins");
  });

  it("accepte un achat possible", () => {
    expect(motifRefusAchat({ solde: 80, prix: 80, possede: false })).toBeNull();
  });
});

describe("catalogue", () => {
  it("contient des identifiants uniques et des prix positifs", () => {
    const ids = CATALOGUE.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of CATALOGUE) expect(a.prix).toBeGreaterThan(0);
  });

  it("couvre chaque catégorie annoncée", () => {
    for (const c of ["badge", "titre", "couleur", "animal", "tenue"]) {
      expect(CATALOGUE.some((a) => a.categorie === c)).toBe(true);
    }
  });

  it("applique la couleur de pseudo et le badge équipés, ou rien", () => {
    expect(couleurPseudoEquipee({ couleur: "couleur-cyan" })).toBe("#19e6ff");
    expect(couleurPseudoEquipee({})).toBeUndefined();
    expect(badgeEquipe({ badge: "badge-quiz" })).toBe("🧠");
    expect(valeurDe("inconnu")).toBeUndefined();
  });
});
