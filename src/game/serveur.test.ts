import { describe, expect, it } from "vitest";
import { etatBase, evaluerRoles, evaluerServices, evenementsRecents, SEUIL_LENT_MS, verifier, type Mesures } from "./serveur";
import type { Reseau } from "./reseau";

const vide: Reseau = { cours: [], categories: [], annonces: [], organisation: null, quiz: [], fiches: [] };
const sain: Mesures = { latenceMs: 120, tempsReelOk: true, iaConfiguree: true, provisoire: false, nbProfils: 12 };

describe("état des services", () => {
  it("juge la base selon son temps de réponse", () => {
    expect(etatBase(null)).toBe("Arrêté");
    expect(etatBase(120)).toBe("En cours");
    expect(etatBase(SEUIL_LENT_MS + 1)).toBe("Lent");
  });

  it("reflète chaque mesure dans le service correspondant", () => {
    const s = evaluerServices({ ...sain, tempsReelOk: false, iaConfiguree: false });
    expect(s.map((x) => x.etat)).toEqual(["En cours", "Arrêté", "Arrêté", "En cours"]);
    expect(s[0]?.detail).toBe("Réponse en 120 ms");
    expect(s[3]?.detail).toBe("12 profil(s) enregistré(s)");
  });

  it("marque la base comme arrêtée quand elle ne répond pas", () => {
    const s = evaluerServices({ ...sain, latenceMs: null });
    expect(s[0]?.etat).toBe("Arrêté");
    expect(s[0]?.detail).toBe("Aucune réponse");
  });
});

describe("rôles et vérifications", () => {
  it("compte les éléments de chaque rôle", () => {
    const r = evaluerRoles(vide);
    expect(r.map((x) => x.nombre)).toEqual([0, 0, 0, 0]);
    expect(r).toHaveLength(4);
  });

  it("signale le mode provisoire et la clé IA absente", () => {
    const v = verifier({ ...sain, provisoire: true, iaConfiguree: false }, vide);
    expect(v.find((x) => x.titre === "Administrateurs")?.niveau).toBe("Avertissement");
    expect(v.find((x) => x.titre === "Clé IA")?.niveau).toBe("Erreur");
  });

  it("signale une base lente ou injoignable", () => {
    expect(verifier({ ...sain, latenceMs: 2000 }, vide).find((x) => x.titre === "Base de données")?.niveau).toBe("Avertissement");
    expect(verifier({ ...sain, latenceMs: null }, vide).find((x) => x.titre === "Base de données")?.niveau).toBe("Erreur");
  });

  it("repère les cours qui n'ont pas de quiz", () => {
    const avecCours: Reseau = {
      ...vide,
      cours: [
        { id: "c1", titre: "Réseaux", categorie: "x", auteurId: "a", auteur: "Léo", date: "2026-11-01", description: "", contenu: "" },
        { id: "c2", titre: "Linux", categorie: "x", auteurId: "a", auteur: "Léo", date: "2026-11-02", description: "", contenu: "" },
      ],
      quiz: [{ id: "q1", coursId: "c1", auteurId: "a", auteur: "Léo", date: "2026-11-03", source: "ia", questions: [] }],
    };
    const v = verifier(sain, avecCours).find((x) => x.titre === "Cours sans quiz");
    expect(v?.niveau).toBe("Avertissement");
    expect(v?.message).toBe("1 cours n'ont pas encore de quiz.");
  });
});

describe("journal des événements", () => {
  it("trie du plus récent au plus ancien et mêle les sources", () => {
    const r: Reseau = {
      ...vide,
      cours: [{ id: "c1", titre: "Réseaux", categorie: "x", auteurId: "a", auteur: "Léo", date: "2026-11-01", description: "", contenu: "" }],
      annonces: [{ id: "n1", titre: "Examen", corps: "", auteurId: "a", auteur: "Léo", date: "2026-11-05" }],
    };
    const e = evenementsRecents(r);
    expect(e.map((x) => x.source)).toEqual(["Annonces", "Réseau cours"]);
    expect(e[0]?.message).toBe("Annonce : Examen (par Léo)");
  });

  it("respecte la limite demandée", () => {
    const r: Reseau = {
      ...vide,
      annonces: Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, titre: `T${i}`, corps: "", auteurId: "a", auteur: "Léo", date: `2026-11-${String(i + 1).padStart(2, "0")}` })),
    };
    expect(evenementsRecents(r, 3)).toHaveLength(3);
  });
});
