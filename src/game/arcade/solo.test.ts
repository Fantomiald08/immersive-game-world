import { describe, expect, it } from "vitest";
import {
  avancerSolo,
  creerPartieSolo,
  FORMATS_SOLO,
  joueursSolo,
  type FormatSolo,
  type PartieSolo,
} from "./partieSolo";
import { creerCerveau } from "./ia";
import { BTN, type JeuId } from "./types";
import type { EtatArene } from "./jeux/arene";
import type { EtatCombat } from "./jeux/combat";
import type { EtatCourse } from "./jeux/course";

const moi = { id: "moi", pseudo: "Léo" };
const DT = 1 / 60;

/** Joue une partie solo complète, avec un joueur humain qui ne touche à rien (ou une consigne). */
function partie(
  jeu: JeuId,
  format: FormatSolo,
  graine = 5,
  touches: (p: PartieSolo) => number = () => 0,
  max = 135,
) {
  const p = creerPartieSolo(jeu, moi, format, graine);
  const vus: Record<string, number> = {};
  for (let i = 0; i < max * 60 && p.etat.phase !== "fini"; i++) {
    avancerSolo(p, touches(p), DT);
    for (const [id, e] of Object.entries(p.entrees))
      if (id !== moi.id) vus[id] = (vus[id] ?? 0) | e;
  }
  return { p, vus };
}

describe("formats solo", () => {
  it("1v1 : toi + 1 IA ; 2v2 : toi + allié IA + 2 adversaires IA ; 1v1v1v1 : 3 adversaires IA", () => {
    const a = joueursSolo(moi, "1v1");
    expect(a.map((j) => [j.equipe, !!j.ia])).toEqual([
      [0, false],
      [1, true],
    ]);
    const b = joueursSolo(moi, "2v2");
    expect(b.map((j) => [j.equipe, !!j.ia])).toEqual([
      [0, false],
      [0, true],
      [1, true],
      [1, true],
    ]);
    const c = joueursSolo(moi, "ffa");
    expect(c.map((j) => j.equipe)).toEqual([0, 1, 2, 3]);
    expect(c.filter((j) => j.ia)).toHaveLength(3);
    for (const f of [a, b, c]) {
      expect(new Set(f.map((j) => j.id)).size).toBe(f.length);
      expect(f[0]!.id).toBe("moi");
    }
    expect(FORMATS_SOLO.map((f) => f.id)).toEqual(["1v1", "2v2", "ffa"]);
  });

  it("chaque jeu démarre dans chaque format, avec un cerveau par IA", () => {
    for (const jeu of ["arene", "course", "combat"] as const)
      for (const f of FORMATS_SOLO) {
        const p = creerPartieSolo(jeu, moi, f.id, 1);
        expect(p.etat.joueurs).toHaveLength(f.ia + 1);
        expect(p.cerveaux.size).toBe(f.ia);
        expect(p.etat.duree).toBe(120);
      }
  });
});

describe("IA de l'arène", () => {
  it("1v1 : l'IA ramasse des armes et élimine un joueur immobile", () => {
    const { p, vus } = partie("arene", "1v1", 3);
    const s = p.etat as EtatArene;
    expect(s.phase).toBe("fini");
    expect(s.p[1]!.kills).toBeGreaterThan(0);
    expect(s.resultat?.vainqueur).toBe(1);
    expect(vus["ia-1"]! & BTN.a).toBeTruthy();
  });

  it("1v1v1v1 : les 3 IA se battent entre elles, la partie va à son terme", () => {
    const { p } = partie("arene", "ffa", 8);
    const s = p.etat as EtatArene;
    expect(s.phase).toBe("fini");
    const kills = s.p.slice(1).map((q) => q.kills);
    expect(kills.reduce((a, b) => a + b, 0)).toBeGreaterThan(2);
    expect(s.resultat?.lignes).toHaveLength(4);
  });

  it("2v2 : l'allié IA ne fait pas le travail à l'envers (les kills visent l'équipe adverse)", () => {
    const { p } = partie("arene", "2v2", 4);
    const s = p.etat as EtatArene;
    // Aucune mort ne peut venir d'un allié : morts de l'équipe 0 = kills de l'équipe 1.
    const morts0 = s.p[0]!.morts + s.p[1]!.morts;
    const kills1 = s.p[2]!.kills + s.p[3]!.kills;
    expect(kills1).toBe(morts0);
    const morts1 = s.p[2]!.morts + s.p[3]!.morts;
    expect(s.p[0]!.kills + s.p[1]!.kills).toBe(morts1);
  });

  it("ne tire pas quand un coéquipier se trouve sur la ligne de tir, ni quand il n'y a que des alliés", () => {
    const p = creerPartieSolo("arene", moi, "2v2", 1);
    for (let i = 0; i < 60 * 3.2; i++) avancerSolo(p, 0, DT);
    const s = p.etat as EtatArene;
    const [humain, allie, ennemi1, ennemi2] = s.p as [
      EtatArene["p"][0],
      EtatArene["p"][0],
      EtatArene["p"][0],
      EtatArene["p"][0],
    ];
    // L'allié IA (index 1) tient un pistolet, l'humain est devant lui, l'ennemi derrière l'humain.
    allie.arme = "pistolet";
    allie.munitions = 10;
    allie.x = 100;
    allie.y = 240;
    humain.x = 200;
    humain.y = 240;
    ennemi1.x = 400;
    ennemi1.y = 240;
    ennemi2.respawn = 5;
    s.objets = [];
    const cerveau = creerCerveau("arene", "ia-1", 7);
    let tire = false;
    for (let i = 0; i < 40; i++) if (cerveau(s, DT * 8) & BTN.a) tire = true;
    expect(tire).toBe(false);
    // Plus aucun adversaire en vie : il ne tire sur personne.
    ennemi1.respawn = 5;
    const calme = creerCerveau("arene", "ia-1", 9);
    let agit = 0;
    for (let i = 0; i < 40; i++) agit |= calme(s, DT * 8) & (BTN.a | BTN.visee);
    expect(agit).toBe(0);
  });
});

describe("IA de la course", () => {
  it("1v1 : l'IA suit le parcours et finit les 3 tours avant la limite", () => {
    const { p } = partie("course", "1v1", 2);
    const s = p.etat as EtatCourse;
    expect(s.v[1]!.fin).toBeGreaterThan(40);
    expect(s.v[1]!.fin).toBeLessThan(120);
    expect(s.resultat?.vainqueur).toBe(1);
  });

  it("1v1v1v1 : les 3 IA terminent toutes, sans rester bloquées hors piste", () => {
    const { p } = partie("course", "ffa", 6);
    const s = p.etat as EtatCourse;
    expect(s.v.slice(1).every((c) => c.fin > 0 && c.fin < 120)).toBe(true);
    expect(s.resultat?.lignes).toHaveLength(4);
  });

  it("2v2 : aucune IA ne freine jamais (ni sur un allié, ni sur un adversaire)", () => {
    const { vus } = partie("course", "2v2", 3);
    for (const id of ["ia-1", "ia-2", "ia-3"]) {
      expect(vus[id]! & BTN.haut).toBeTruthy();
      expect(vus[id]! & BTN.bas).toBe(0);
    }
  });

  it("se décale pour doubler une voiture lente devant elle", () => {
    const p = creerPartieSolo("course", moi, "1v1", 1);
    for (let i = 0; i < 60 * 3.2; i++) avancerSolo(p, 0, DT);
    const s = p.etat as EtatCourse;
    s.v[1]!.z = 300;
    s.v[1]!.x = 0;
    s.v[0]!.z = 320; // la voiture humaine, lente, juste devant
    s.v[0]!.x = 0.05;
    const cerveau = creerCerveau("course", "ia-1", 4);
    let gauche = 0;
    let droite = 0;
    for (let i = 0; i < 30; i++) {
      const e = cerveau(s, 0.1);
      if (e & BTN.gauche) gauche++;
      if (e & BTN.droite) droite++;
    }
    // Voiture humaine légèrement à droite de l'axe : l'IA passe par la gauche.
    expect(gauche).toBeGreaterThan(droite);
  });
});

describe("IA du combat", () => {
  it("1v1 : l'IA s'approche, frappe et gagne contre un joueur immobile", () => {
    const { p, vus } = partie("combat", "1v1", 2);
    const s = p.etat as EtatCombat;
    expect(s.phase).toBe("fini");
    expect(s.resultat?.vainqueur).toBe(1);
    expect(vus["ia-1"]! & (BTN.a | BTN.b)).toBeTruthy();
  });

  it("1v1v1v1 : 4 combattants, la partie va à son terme avec un classement complet", () => {
    const { p } = partie("combat", "ffa", 5);
    expect(p.etat.phase).toBe("fini");
    expect(p.etat.resultat?.lignes).toHaveLength(4);
  });

  it("2v2 : l'IA ne choisit jamais son allié comme cible (elle n'attaque pas quand il est seul à portée)", () => {
    const p = creerPartieSolo("combat", moi, "2v2", 1);
    for (let i = 0; i < 60 * 3.2; i++) avancerSolo(p, 0, DT);
    const s = p.etat as EtatCombat;
    // Les deux adversaires sont K.O. : seul reste mon allié, collé à l'IA.
    s.f[2]!.ko = true;
    s.f[3]!.ko = true;
    s.f[0]!.x = 300; // humain (allié)
    s.f[1]!.x = 310; // IA alliée
    const cerveau = creerCerveau("combat", "ia-1", 2);
    let boutons = 0;
    for (let i = 0; i < 60; i++)
      boutons |= cerveau(s, 0.1) & (BTN.a | BTN.b | BTN.c | BTN.gauche | BTN.droite);
    expect(boutons).toBe(0);
  });

  it("l'IA se met en garde quand on la frappe de près", () => {
    const p = creerPartieSolo("combat", moi, "1v1", 1);
    for (let i = 0; i < 60 * 3.2; i++) avancerSolo(p, 0, DT);
    const s = p.etat as EtatCombat;
    s.f[0]!.x = 300;
    s.f[1]!.x = 340;
    s.f[0]!.atk = { type: "b", t: 0.1, touches: [], lance: false };
    let gardes = 0;
    for (let k = 0; k < 40; k++) {
      const cerveau = creerCerveau("combat", "ia-1", 100 + k);
      if (cerveau(s, 0.2) & BTN.bas) gardes++;
    }
    expect(gardes).toBeGreaterThan(8);
  });
});
