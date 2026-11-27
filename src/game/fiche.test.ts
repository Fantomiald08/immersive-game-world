import { describe, expect, it } from "vitest";
import { lireFiche, nettoyerFiche } from "./fiche";

const valide = {
  titre: "Le protocole DHCP",
  resume: ["DHCP attribue une adresse IP automatiquement."],
  notions: [{ titre: "Bail", texte: "Durée pendant laquelle l'adresse est louée." }],
  pieges: ["Confondre DHCP et DNS."],
  aRetenir: ["Le port serveur est le 67."],
};

describe("nettoyerFiche", () => {
  it("garde une fiche valide telle quelle", () => {
    expect(nettoyerFiche(valide)).toEqual(valide);
  });

  it("refuse ce qui n'est pas un objet", () => {
    expect(nettoyerFiche(null)).toBeNull();
    expect(nettoyerFiche("texte")).toBeNull();
    expect(nettoyerFiche([1, 2])).toBeNull();
  });

  it("refuse une fiche sans titre ou sans contenu", () => {
    expect(nettoyerFiche({ ...valide, titre: "   " })).toBeNull();
    expect(nettoyerFiche({ titre: "Vide", resume: [], notions: [] })).toBeNull();
  });

  it("réduit les espaces et tronque les longueurs", () => {
    const f = nettoyerFiche({ ...valide, resume: ["  Une   phrase\n  longue  ".padEnd(400, "x")] });
    expect(f?.resume[0]?.startsWith("Une phrase longue")).toBe(true);
    expect(f!.resume[0]!.length).toBeLessThanOrEqual(240);
  });

  it("limite le nombre d'éléments de chaque liste", () => {
    const f = nettoyerFiche({ ...valide, resume: Array.from({ length: 30 }, (_, i) => `point ${i}`) });
    expect(f!.resume).toHaveLength(8);
  });

  it("écarte les notions incomplètes", () => {
    const f = nettoyerFiche({
      ...valide,
      notions: [{ titre: "Sans texte" }, { titre: "OK", texte: "Explication." }, 42],
    });
    expect(f!.notions).toEqual([{ titre: "OK", texte: "Explication." }]);
  });

  it("accepte une fiche sans pièges ni points à retenir", () => {
    const f = nettoyerFiche({ titre: "Court", resume: ["Un point."] });
    expect(f).toEqual({ titre: "Court", resume: ["Un point."], notions: [], pieges: [], aRetenir: [] });
  });
});

describe("lireFiche", () => {
  it("relit une fiche stockée en JSON", () => {
    expect(lireFiche(JSON.stringify(valide))).toEqual(valide);
  });

  it("renvoie null si le JSON est cassé", () => {
    expect(lireFiche("{pas du json")).toBeNull();
  });
});
