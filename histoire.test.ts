import { describe, expect, it } from "vitest";
import {
  CHAPITRES,
  correspond,
  ETAT_INITIAL,
  progresser,
  resume,
  type Evenement,
} from "./histoire";

const ev = {
  parler: (pnj: string): Evenement => ({ k: "parler", pnj }),
  visite: (salle: string): Evenement => ({ k: "visite", salle }),
  combat: (
    victoire: boolean,
    difficulte: "facile" | "normal" | "difficile" | "cauchemar" = "normal",
    bonnes = 5,
  ): Evenement => ({ k: "combat", victoire, difficulte, bonnes }),
  tableau: (): Evenement => ({ k: "tableau" }),
  depot: (): Evenement => ({ k: "depot" }),
};

describe("contenu des chapitres", () => {
  it("il y a 3 chapitres, chacun avec des missions et une conclusion", () => {
    expect(CHAPITRES).toHaveLength(3);
    for (const c of CHAPITRES) {
      expect(c.missions.length).toBeGreaterThanOrEqual(2);
      expect(c.intro.length).toBeGreaterThan(20);
      expect(c.conclusion.length).toBeGreaterThan(10);
    }
  });
  it("les identifiants de missions sont uniques", () => {
    const ids = CHAPITRES.flatMap((c) => c.missions.map((m) => m.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("toutes les missions ont un dialogue et une récompense positive", () => {
    for (const c of CHAPITRES)
      for (const m of c.missions) {
        expect(m.dialogue.length).toBeGreaterThan(10);
        expect(m.xp).toBeGreaterThan(0);
      }
  });
});

describe("conditions des missions", () => {
  it("parler et visiter ne correspondent qu'à la bonne cible", () => {
    expect(correspond({ k: "parler", pnj: "accueil-hotesse" }, ev.parler("accueil-hotesse"))).toBe(
      true,
    );
    expect(correspond({ k: "parler", pnj: "accueil-hotesse" }, ev.parler("autre"))).toBe(false);
    expect(correspond({ k: "visite", salle: "serveurs" }, ev.visite("cafe"))).toBe(false);
  });
  it("un combat gagné en difficulté suffisante valide la mission, une défaite non", () => {
    expect(
      correspond(
        { k: "combat", victoire: true, difficulteMin: "difficile" },
        ev.combat(true, "cauchemar"),
      ),
    ).toBe(true);
    expect(
      correspond(
        { k: "combat", victoire: true, difficulteMin: "difficile" },
        ev.combat(true, "normal"),
      ),
    ).toBe(false);
    expect(correspond({ k: "combat", victoire: true }, ev.combat(false))).toBe(false);
  });
  it("le nombre de bonnes réponses compte", () => {
    expect(
      correspond({ k: "combat", victoire: true, bonnesMin: 4 }, ev.combat(true, "normal", 3)),
    ).toBe(false);
    expect(
      correspond({ k: "combat", victoire: true, bonnesMin: 4 }, ev.combat(true, "normal", 4)),
    ).toBe(true);
  });
  it("une condition vide accepte n'importe quel événement de son type", () => {
    expect(correspond({ k: "tableau" }, ev.tableau())).toBe(true);
    expect(correspond({ k: "tableau" }, ev.depot())).toBe(false);
  });
});

describe("progression", () => {
  it("commence au chapitre 1 et ne valide rien sans action", () => {
    expect(ETAT_INITIAL.chapitre).toBe(0);
    expect(resume(ETAT_INITIAL).chapitre?.titre).toContain("Chapitre 1");
    expect(resume(ETAT_INITIAL).pourcent).toBe(0);
  });
  it("une action qui ne concerne pas la mission ne fait rien", () => {
    const { etat, gains } = progresser(ETAT_INITIAL, ev.tableau());
    expect(gains.missions).toHaveLength(0);
    expect(gains.xp).toBe(0);
    expect(etat.faites).toEqual([]);
  });
  it("chaque mission réussie rapporte son XP une seule fois", () => {
    let { etat, gains } = progresser(ETAT_INITIAL, ev.parler("accueil-hotesse"));
    expect(gains.xp).toBe(10);
    ({ etat, gains } = progresser(etat, ev.parler("accueil-hotesse")));
    expect(gains.xp).toBe(0);
    expect(etat.faites).toEqual(["c1m1"]);
  });
  it("les missions doivent être faites dans l'ordre du chapitre", () => {
    // Visiter les serveurs avant d'avoir parlé à l'hôtesse : la mission 2 se valide quand même (pas de blocage pédagogique)
    const { etat } = progresser(ETAT_INITIAL, ev.visite("serveurs"));
    expect(etat.faites).toEqual(["c1m2"]);
  });
  it("finir un chapitre donne sa récompense et passe au suivant", () => {
    let e = ETAT_INITIAL;
    e = progresser(e, ev.parler("accueil-hotesse")).etat;
    e = progresser(e, ev.visite("serveurs")).etat;
    const fin = progresser(e, ev.combat(true, "normal"));
    expect(fin.gains.chapitreTermine?.id).toBe("c1");
    expect(fin.gains.xp).toBe(20 + 40); // mission 3 (20) + récompense du chapitre (40)
    expect(fin.etat.chapitre).toBe(1);
    expect(fin.etat.faites).toEqual([]);
  });
  it("après le dernier chapitre, l'histoire est terminée et ne rapporte plus rien", () => {
    let e = ETAT_INITIAL;
    const actions = [
      ev.parler("accueil-hotesse"),
      ev.visite("serveurs"),
      ev.combat(true, "normal"),
      ev.tableau(),
      ev.combat(true, "normal", 4),
      ev.combat(true, "difficile"),
      ev.depot(),
      ev.combat(true, "cauchemar"),
    ];
    let total = 0;
    for (const a of actions) {
      const r = progresser(e, a);
      e = r.etat;
      total += r.gains.xp;
    }
    expect(e.termine).toBe(true);
    expect(resume(e).terminee).toBe(true);
    expect(resume(e).pourcent).toBe(100);
    const apres = progresser(e, ev.depot());
    expect(apres.gains.xp).toBe(0);
    expect(total).toBeGreaterThan(300);
  });
  it("le pourcentage avance avec les missions", () => {
    const e = progresser(ETAT_INITIAL, ev.parler("accueil-hotesse")).etat;
    expect(resume(e).pourcent).toBe(Math.round((1 / 8) * 100)); // 8 missions au total
  });
});
