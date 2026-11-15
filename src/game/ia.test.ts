import { describe, expect, it } from "vitest";
import { creerCombat, dureeQuestion, graine, repondre, suivante, type Question } from "./combat";
import {
  choisirVerrou,
  clamp,
  difficulteCible,
  enregistrerCombat,
  modificateurs,
  niveauJoueur,
  optionsCombat,
  PERF_VIDE,
  questionsAdaptees,
  type Perf,
} from "./ia";

const q = (i: number, d: 1 | 2 | 3 = 2): Question => ({
  q: `Question ${i} ?`,
  choix: [`a${i}`, `b${i}`, `c${i}`, `d${i}`],
  bonne: (i % 4) as 0 | 1 | 2 | 3,
  explication: "",
  difficulte: d,
});
const pool = (n: number, d: 1 | 2 | 3 = 2) => Array.from({ length: n }, (_, i) => q(i, d));
const perf = (tentatives: number, reussites: number, combats = 0, victoires = 0): Perf => ({
  ...PERF_VIDE,
  tentatives,
  reussites,
  combats,
  victoires,
});

describe("niveau du joueur", () => {
  it("un joueur sans historique est considéré comme moyen", () =>
    expect(niveauJoueur(PERF_VIDE)).toBe(0.5));
  it("un joueur qui réussit beaucoup a un niveau élevé", () =>
    expect(niveauJoueur(perf(40, 36, 5, 4))).toBeGreaterThan(0.8));
  it("un joueur qui se trompe souvent a un niveau bas", () =>
    expect(niveauJoueur(perf(40, 8, 5, 0))).toBeLessThan(0.3));
  it("reste toujours entre 0 et 1", () => {
    for (const p of [perf(100, 100, 50, 50), perf(100, 0, 50, 0), perf(9, 9, 1, 1)]) {
      const n = niveauJoueur(p);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });
});

describe("adaptation du monstre", () => {
  it("un expert affronte un monstre plus solide, plus rapide et plus dangereux qu'un débutant", () => {
    const expert = modificateurs(1),
      debutant = modificateurs(0);
    expect(expert.pv).toBeGreaterThan(debutant.pv);
    expect(expert.temps).toBeLessThan(debutant.temps);
    expect(expert.degats).toBeGreaterThan(debutant.degats);
  });
  it("les bornes restent raisonnables (le jeu reste jouable)", () => {
    const m = modificateurs(1),
      d = modificateurs(0);
    expect(m.pv).toBeLessThanOrEqual(1.25);
    expect(d.pv).toBeGreaterThanOrEqual(0.85);
    expect(m.temps).toBeGreaterThanOrEqual(0.8);
    expect(d.temps).toBeLessThanOrEqual(1.1);
  });
  it("le combat devient plus dur pour un expert, à nombre de questions égal", () => {
    const expert = creerCombat(pool(8), "normal", graine(1), optionsCombat(perf(40, 36, 5, 4)));
    const neutre = creerCombat(pool(8), "normal", graine(1));
    expect(expert.pvMonstre).toBeGreaterThan(neutre.pvMonstre);
    expect(dureeQuestion(expert)).toBeLessThan(dureeQuestion(neutre));
  });
  it("les options vides ne changent rien au combat classique", () => {
    const a = creerCombat(pool(8), "difficile", graine(9));
    const b = creerCombat(pool(8), "difficile", graine(9), {});
    expect(b.pvMonstre).toBe(a.pvMonstre);
    expect(dureeQuestion(b)).toBe(dureeQuestion(a));
  });
  it("le monstre frappe plus fort chez un expert", () => {
    const e = creerCombat(pool(8), "normal", graine(3), optionsCombat(perf(40, 36, 5, 4)));
    const apres = repondre(e, 0, 0, graine(3));
    expect(apres.resultat!.degatsRecus).toBeGreaterThan(Math.round(12));
  });
});

describe("questions adaptées", () => {
  it("un expert reçoit des questions d'un cran plus difficile, un débutant d'un cran plus facile", () => {
    expect(difficulteCible("normal", 0.9)).toBe("difficile");
    expect(difficulteCible("normal", 0.1)).toBe("facile");
    expect(difficulteCible("normal", 0.5)).toBe("normal");
    expect(difficulteCible("cauchemar", 1)).toBe("cauchemar");
    expect(difficulteCible("facile", 0)).toBe("facile");
  });
  it("sélectionne des questions proches du niveau réel", () => {
    const mix = [...pool(8, 1), ...pool(8, 3).map((x, i) => ({ ...x, q: `Difficile ${i} ?` }))];
    const expert = questionsAdaptees(mix, 6, "normal", 0.95, graine(4));
    expect(expert.every((x) => x.difficulte === 3)).toBe(true);
  });
});

describe("le Ransomware apprend tes habitudes", () => {
  it("sans historique, le choix est uniforme (aucun favori)", () => {
    const compte = new Map<number, number>();
    const r = graine(11);
    for (let i = 0; i < 4000; i++) {
      const c = choisirVerrou([0, 1, 2, 3], [], r);
      compte.set(c, (compte.get(c) ?? 0) + 1);
    }
    for (const v of compte.values()) expect(v).toBeGreaterThan(800);
  });
  it("il bloque plus souvent la réponse que le joueur choisit toujours", () => {
    const historique = Array(20).fill(2); // le joueur choisit toujours la position 2
    const compte = new Map<number, number>();
    const r = graine(12);
    for (let i = 0; i < 4000; i++) {
      const c = choisirVerrou([0, 1, 2, 3], historique, r);
      compte.set(c, (compte.get(c) ?? 0) + 1);
    }
    expect(compte.get(2)!).toBeGreaterThan(compte.get(0)! * 2);
  });
  it("le verrou est toujours l'une des réponses proposées", () => {
    const r = graine(13);
    for (let i = 0; i < 200; i++)
      expect([0, 1, 2, 3]).toContain(choisirVerrou([0, 1, 2, 3], [1, 1, 3], r));
  });
  it("le Ransomware utilise la stratégie quand elle est fournie", () => {
    let appels = 0;
    const e0 = creerCombat(pool(12), "cauchemar", graine(5), {
      verrou: (c) => {
        appels++;
        return c[1]!;
      },
    });
    let e = e0;
    for (let i = 0; i < 3; i++) {
      e = suivante(repondre(e, 0, 0, graine(5)), graine(5));
    }
    expect(appels).toBeGreaterThan(0);
    expect(e.verrou === null || e.verrou === 1).toBe(true);
  });
});

describe("mémoire du joueur", () => {
  it("enregistre les réponses, les combats et les victoires", () => {
    const p = enregistrerCombat(PERF_VIDE, {
      bonnes: 6,
      mauvaises: 2,
      victoire: true,
      positions: [0, 1, 1],
    });
    expect(p).toMatchObject({ tentatives: 8, reussites: 6, combats: 1, victoires: 1 });
    expect(p.positions).toEqual([0, 1, 1]);
  });
  it("garde seulement les 40 dernières positions", () => {
    let p = PERF_VIDE;
    for (let i = 0; i < 10; i++)
      p = enregistrerCombat(p, {
        bonnes: 1,
        mauvaises: 0,
        victoire: false,
        positions: [0, 1, 2, 3, 0],
      });
    expect(p.positions.length).toBe(40);
  });
  it("clamp borne les valeurs", () => {
    expect(clamp(5)).toBe(1);
    expect(clamp(-2)).toBe(0);
    expect(clamp(0.4)).toBe(0.4);
  });
});
