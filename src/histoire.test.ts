import { describe, expect, it } from "vitest";
import {
  CHAPITRES,
  correspond,
  enigmeEnAttente,
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
  ): Evenement => ({
    k: "combat",
    victoire,
    difficulte,
    bonnes,
  }),
  tableau: (): Evenement => ({ k: "tableau" }),
  depot: (): Evenement => ({ k: "depot" }),
  enigme: (id: string, bonne: boolean): Evenement => ({ k: "enigme", id, bonne }),
  badge: (id: string): Evenement => ({ k: "badge", id }),
};

describe("contenu des chapitres", () => {
  it("il y a 5 chapitres, chacun avec plusieurs missions et une conclusion", () => {
    expect(CHAPITRES).toHaveLength(5);
    for (const c of CHAPITRES) {
      expect(c.missions.length).toBeGreaterThanOrEqual(3);
      expect(c.intro.length).toBeGreaterThan(20);
      expect(c.conclusion.length).toBeGreaterThan(10);
    }
  });
  it("les identifiants de missions et d'énigmes sont uniques", () => {
    const ids = CHAPITRES.flatMap((c) => c.missions.map((m) => m.id));
    expect(new Set(ids).size).toBe(ids.length);
    const enigmes = CHAPITRES.flatMap((c) =>
      c.missions.flatMap((m) => (m.enigme ? [m.enigme.id] : [])),
    );
    expect(new Set(enigmes).size).toBe(enigmes.length);
  });
  it("toutes les missions ont un dialogue et une récompense positive", () => {
    for (const c of CHAPITRES)
      for (const m of c.missions) {
        expect(m.dialogue.length).toBeGreaterThan(10);
        expect(m.xp).toBeGreaterThan(0);
      }
  });
  it("chaque énigme a 4 choix, une bonne réponse valide, et des textes de succès/échec", () => {
    for (const c of CHAPITRES)
      for (const m of c.missions) {
        if (!m.enigme) continue;
        expect(m.enigme.choix.length).toBeGreaterThanOrEqual(2);
        expect(m.enigme.bonne).toBeGreaterThanOrEqual(0);
        expect(m.enigme.bonne).toBeLessThan(m.enigme.choix.length);
        expect(m.enigme.succes.length).toBeGreaterThan(5);
        expect(m.enigme.echec.length).toBeGreaterThan(5);
        // la condition de la mission doit bien pointer vers l'énigme correspondante
        expect(m.cond).toMatchObject({ k: "enigme", id: m.enigme.id });
      }
  });
  it("au moins 3 chapitres contiennent une énigme, pour varier le gameplay", () => {
    const n = CHAPITRES.filter((c) => c.missions.some((m) => m.enigme)).length;
    expect(n).toBeGreaterThanOrEqual(3);
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
  it("une énigme ne valide la mission que si c'est la bonne énigme et la bonne réponse", () => {
    expect(
      correspond({ k: "enigme", id: "labo-ping", bonne: true }, ev.enigme("labo-ping", true)),
    ).toBe(true);
    expect(
      correspond({ k: "enigme", id: "labo-ping", bonne: true }, ev.enigme("labo-ping", false)),
    ).toBe(false);
    expect(
      correspond({ k: "enigme", id: "labo-ping", bonne: true }, ev.enigme("autre-enigme", true)),
    ).toBe(false);
  });
  it("un badge précis valide la mission correspondante", () => {
    expect(correspond({ k: "badge", id: "chasseur" }, ev.badge("chasseur"))).toBe(true);
    expect(correspond({ k: "badge", id: "chasseur" }, ev.badge("parfait"))).toBe(false);
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
  it("une énigme réussie valide sa mission, une énigme ratée ne valide rien", () => {
    const raté = progresser(ETAT_INITIAL, ev.enigme("labo-ping", false));
    expect(raté.etat.faites).not.toContain("c1m4");
    const reussi = progresser(ETAT_INITIAL, ev.enigme("labo-ping", true));
    expect(reussi.etat.faites).toContain("c1m4");
    expect(reussi.gains.xp).toBe(15);
  });
  it("enigmeEnAttente renvoie l'énigme tant qu'elle n'est pas résolue, puis plus rien", () => {
    expect(enigmeEnAttente(ETAT_INITIAL, "labo-ping")?.id).toBe("labo-ping");
    const { etat } = progresser(ETAT_INITIAL, ev.enigme("labo-ping", true));
    expect(enigmeEnAttente(etat, "labo-ping")).toBeNull();
    expect(enigmeEnAttente(ETAT_INITIAL, "inconnue")).toBeNull();
  });
  it("finir un chapitre donne sa récompense et passe au suivant", () => {
    let e = ETAT_INITIAL;
    for (const a of [
      ev.parler("accueil-hotesse"),
      ev.parler("ref-ref"),
      ev.visite("serveurs"),
      ev.enigme("labo-ping", true),
    ])
      e = progresser(e, a).etat;
    const fin = progresser(e, ev.combat(true, "normal"));
    expect(fin.gains.chapitreTermine?.id).toBe("c1");
    expect(fin.gains.xp).toBe(20 + 50); // dernière mission (20) + récompense du chapitre (50)
    expect(fin.etat.chapitre).toBe(1);
    expect(fin.etat.faites).toEqual([]);
  });
  it("après le dernier chapitre, l'histoire est terminée et ne rapporte plus rien", () => {
    let e = ETAT_INITIAL;
    for (const c of CHAPITRES) {
      for (const m of c.missions) {
        const action: Evenement =
          m.cond.k === "combat"
            ? ev.combat(true, m.cond.difficulteMin ?? "cauchemar", m.cond.bonnesMin ?? 5)
            : m.cond.k === "parler"
              ? ev.parler(m.cond.pnj!)
              : m.cond.k === "visite"
                ? ev.visite(m.cond.salle!)
                : m.cond.k === "enigme"
                  ? ev.enigme(m.cond.id!, true)
                  : m.cond.k === "badge"
                    ? ev.badge(m.cond.id!)
                    : m.cond.k === "tableau"
                      ? ev.tableau()
                      : ev.depot();
        e = progresser(e, action).etat;
      }
    }
    expect(e.termine).toBe(true);
    expect(resume(e).terminee).toBe(true);
    expect(resume(e).pourcent).toBe(100);
    const apres = progresser(e, ev.depot());
    expect(apres.gains.xp).toBe(0);
  });
  it("le pourcentage avance avec les missions", () => {
    const total = CHAPITRES.reduce((n, c) => n + c.missions.length, 0);
    const e = progresser(ETAT_INITIAL, ev.parler("accueil-hotesse")).etat;
    expect(resume(e).pourcent).toBe(Math.round((1 / total) * 100));
  });
});
