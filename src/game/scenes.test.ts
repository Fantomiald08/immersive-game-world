import { describe, expect, it } from "vitest";
import { atteignable, bloque } from "./monde";
import { SCENES } from "./scenes";
import { PLACES_COURS, PROF } from "./scenes/Classe";
import { PLACES_MONSTRES } from "./scenes/Serveur";

describe("salles de l'école", () => {
  for (const s of Object.values(SCENES)) {
    it(`${s.nom} : au moins 25 objets de décor`, () => {
      expect(s.decor.length).toBeGreaterThanOrEqual(25);
    });
    it(`${s.nom} : tous les points d'arrivée sont libres`, () => {
      for (const [k, e] of Object.entries(s.entrees))
        expect(bloque(s, e!.x, e!.y), `entrée ${k}`).toBe(false);
    });
    it(`${s.nom} : on peut rejoindre chaque porte depuis chaque arrivée`, () => {
      for (const e of Object.values(s.entrees)) {
        for (const p of s.portes) {
          expect(atteignable(s, e!, { x: p.x + p.w / 2, y: p.y + p.h / 2 })).toBe(true);
        }
      }
    });
    it(`${s.nom} : les portes mènent à une salle qui existe`, () => {
      for (const p of s.portes) expect(SCENES[p.vers]).toBeDefined();
    });
  }
  it("les PNJ de cours et le professeur sont accessibles", () => {
    for (const p of [...PLACES_COURS, PROF]) {
      expect(
        atteignable(SCENES.classe, SCENES.classe.entrees.debut!, { x: p.x, y: p.y + 0.8 }),
      ).toBe(true);
    }
  });
  it("les monstres sont accessibles", () => {
    for (const p of PLACES_MONSTRES) {
      expect(
        atteignable(SCENES.serveur, SCENES.serveur.entrees.debut!, { x: p.x, y: p.y + 1 }) ||
          atteignable(SCENES.serveur, SCENES.serveur.entrees.debut!, { x: p.x + 1, y: p.y }),
      ).toBe(true);
    }
  });
});
