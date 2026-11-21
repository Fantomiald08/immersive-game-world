import { describe, expect, it } from "vitest";
import { JEUX } from "./jeux";
import { avancer } from "./moteur";
import { entreeRobot, ID_BOT, joueursSolo } from "./solo";
import type { EtatCourse } from "./jeux/course";
import type { EtatCombat } from "./jeux/combat";
import type { EtatArene } from "./jeux/arene";

describe("arcade solo", () => {
  for (const id of ["arene", "course", "combat"] as const) {
    it(`${id} démarre seul avec un adversaire actif et termine avec un résultat`, () => {
      const jeu = JEUX[id];
      const s = jeu.creer(joueursSolo({ id: "eleve", pseudo: "Élève" }), 42);
      expect(s.joueurs.map((j) => j.id)).toEqual(["eleve", ID_BOT]);
      avancer(jeu, s, {}, 3);
      expect(s.phase).toBe("jeu");
      for (let i = 0; i < 600; i++) avancer(jeu, s, { [ID_BOT]: entreeRobot(id, s) }, 1 / 60);
      expect(s.t).toBeGreaterThan(1);
      if (id === "course") expect((s as EtatCourse).v.find((v) => v.id === ID_BOT)?.z).toBeGreaterThan(100);
      if (id === "combat") expect((s as EtatCombat).f.find((f) => f.id === "eleve")?.pv).toBeLessThan(100);
      if (id === "arene") expect((s as EtatArene).p.find((p) => p.id === ID_BOT)?.x).toBeLessThan(700);
      for (let i = 0; i < 7500 && s.phase !== "fini"; i++) avancer(jeu, s, { [ID_BOT]: entreeRobot(id, s) }, 1 / 60);
      expect(s.phase).toBe("fini");
      expect(s.resultat?.lignes).toHaveLength(2);
    });
  }
});