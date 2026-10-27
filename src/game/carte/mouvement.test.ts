import { describe, expect, it } from "vitest";
import { ZONES } from "./zones";
import { avancer, caseDe, creerMob, estBloque, V_COURSE, V_MARCHE, type Mob } from "./moteur";
import type { Direction } from "./types";

const z = ZONES.couloir1;
const dt = 1 / 60;
const entier = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;

/** Joue une suite d'ordres : [direction ou null, durée en secondes]. Vérifie qu'on ne va jamais en diagonale ni dans un mur. */
function jouer(m: Mob, ordres: Array<[Direction | null, number]>, v = V_MARCHE) {
  for (const [d, t] of ordres) {
    for (let i = 0; i < Math.round(t / dt); i++) {
      avancer(z, m, d, v, dt);
      expect(entier(m.x) || entier(m.y), `diagonale en ${m.x},${m.y}`).toBe(true);
      const c = caseDe(m);
      expect(estBloque(z, c.x, c.y), `dans un mur en ${c.x},${c.y}`).toBe(false);
    }
  }
}

describe("déplacement sans délai", () => {
  it("avance dès la première image, sans attendre", () => {
    const m = creerMob(2, 3, "droite");
    avancer(z, m, "droite", V_MARCHE, dt);
    expect(m.x).toBeGreaterThan(2);
    expect(m.marche).toBe(true);
  });

  it("vitesse : environ 4 cases par seconde", () => {
    const m = creerMob(2, 3, "droite");
    jouer(m, [["droite", 1]]);
    expect(m.x).toBeCloseTo(2 + V_MARCHE, 1);
  });

  it("la course est plus rapide", () => {
    const a = creerMob(2, 3, "droite"),
      b = creerMob(2, 3, "droite");
    jouer(a, [["droite", 1]]);
    jouer(b, [["droite", 1]], V_COURSE);
    expect(b.x).toBeGreaterThan(a.x + 2);
  });

  it("demi-tour immédiat en plein pas", () => {
    const m = creerMob(5, 3, "droite");
    jouer(m, [["droite", 0.1]]); // en plein milieu d'une case
    const x0 = m.x;
    expect(entier(x0)).toBe(false);
    avancer(z, m, "gauche", V_MARCHE, dt); // une seule image après le changement de touche
    expect(m.x).toBeLessThan(x0);
    expect(m.dir).toBe("gauche");
  });

  it("virage immédiat en plein pas : on repart tout de suite dans la nouvelle direction", () => {
    const m = creerMob(5, 3, "droite");
    jouer(m, [["droite", 0.1]]);
    jouer(m, [["bas", 0.12]]); // 7 images plus tard on a déjà commencé à descendre
    expect(m.y).toBeGreaterThan(3);
    expect(m.dir).toBe("bas");
  });

  it("zigzag rapide : jamais de diagonale ni de mur", () => {
    const m = creerMob(6, 3, "droite");
    const seq: Array<[Direction | null, number]> = [];
    const d: Direction[] = [
      "droite",
      "bas",
      "gauche",
      "haut",
      "droite",
      "droite",
      "bas",
      "bas",
      "gauche",
      "haut",
    ];
    for (let i = 0; i < 40; i++) seq.push([d[i % d.length]!, 0.05 + (i % 3) * 0.04]);
    jouer(m, seq);
  });

  it("sans touche, termine la case puis s'arrête sur la grille", () => {
    const m = creerMob(5, 3, "droite");
    jouer(m, [
      ["droite", 0.1],
      [null, 0.5],
    ]);
    expect(entier(m.x) && entier(m.y)).toBe(true);
    expect(m.marche).toBe(false);
    expect(m.x).toBe(6);
  });

  it("un mur arrête le personnage", () => {
    const m = creerMob(5, 3, "haut");
    jouer(m, [["haut", 1.5]]);
    expect(m.y).toBe(2); // la rangée 1 est un mur
    expect(m.marche).toBe(false);
    expect(m.dir).toBe("haut");
  });

  it("on change de direction contre un mur sans attendre", () => {
    const m = creerMob(5, 2, "haut");
    avancer(z, m, "haut", V_MARCHE, dt);
    avancer(z, m, "droite", V_MARCHE, dt);
    expect(m.dir).toBe("droite");
    expect(m.x).toBeGreaterThan(5);
  });

  it("n'entre pas dans un personnage non-joueur", () => {
    const m = creerMob(5, 3, "droite");
    for (let i = 0; i < 120; i++) avancer(z, m, "droite", V_MARCHE, dt, [{ x: 7, y: 3 }]);
    expect(m.x).toBe(6);
  });

  it("suit le même chemin quelle que soit la fréquence d'images", () => {
    const a = creerMob(2, 3, "droite"),
      b = creerMob(2, 3, "droite");
    for (let i = 0; i < 60; i++) avancer(z, a, "droite", V_MARCHE, 1 / 60);
    for (let i = 0; i < 20; i++) avancer(z, b, "droite", V_MARCHE, 1 / 20);
    expect(a.x).toBeCloseTo(b.x, 3);
  });
});
