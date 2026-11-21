import { describe, expect, it } from "vitest";
import { abandonner, aleatoire, avancer, equipesPresentes, melange } from "./moteur";
import {
  construireRoom,
  joueursDePartie,
  ordonner,
  peutChangerMode,
  raisonBlocage,
  resumeRoom,
  sallesDepuisPresence,
  sansPlace,
  type Membre,
} from "./room";
import { BTN, DUREE_PARTIE, type JoueurPartie } from "./types";
import { JEUX, LISTE_JEUX } from "./jeux";
import type { EtatArene } from "./jeux/arene";
import type { EtatCourse } from "./jeux/course";
import type { EtatCombat } from "./jeux/combat";

const m = (id: string, depuis: number, extra: Partial<Membre> = {}): Membre => ({
  id,
  pseudo: id.toUpperCase(),
  niveau: 1,
  depuis,
  ...extra,
});
const duo: JoueurPartie[] = [
  { id: "a", pseudo: "A", equipe: 0, couleur: "#4da3ff" },
  { id: "b", pseudo: "B", equipe: 1, couleur: "#ff6b6b" },
];
const quatuor: JoueurPartie[] = [
  ...duo,
  { id: "c", pseudo: "C", equipe: 0, couleur: "#8fe0ff" },
  { id: "d", pseudo: "D", equipe: 1, couleur: "#ffb36b" },
];

/** Fait tourner une partie à 60 images/s avec des entrées qui peuvent changer au fil du temps. */
function jouer(
  id: keyof typeof JEUX,
  joueurs: JoueurPartie[],
  secondes: number,
  entrees: (t: number, s: ReturnType<(typeof JEUX)[typeof id]["creer"]>) => Record<string, number>,
) {
  const jeu = JEUX[id];
  const s = jeu.creer(joueurs, 42);
  const dt = 1 / 60;
  for (let i = 0; i < secondes * 60 && s.phase !== "fini"; i++)
    avancer(jeu, s, entrees(s.t, s), dt);
  return s;
}

describe("room : propriétaire, équipes, capacité", () => {
  it("le créateur est propriétaire, puis le plus ancien s'il part", () => {
    const membres = [m("x", 30), m("createur", 50), m("y", 10)];
    expect(construireRoom("createur", membres)?.proprietaire.id).toBe("createur");
    expect(
      construireRoom(
        "createur",
        membres.filter((q) => q.id !== "createur"),
      )?.proprietaire.id,
    ).toBe("y");
    expect(construireRoom("createur", [])).toBeNull();
  });

  it("l'ordre est le même pour tout le monde (égalité de date départagée par l'identifiant)", () => {
    const a = ordonner([m("b", 5), m("a", 5), m("c", 1)], "zzz").map((q) => q.id);
    const b = ordonner([m("c", 1), m("a", 5), m("b", 5)], "zzz").map((q) => q.id);
    expect(a).toEqual(["c", "a", "b"]);
    expect(b).toEqual(a);
  });

  it("lit les réglages publiés par le propriétaire, avec des valeurs par défaut", () => {
    const r = construireRoom("o", [
      m("o", 1, { jeu: "course", mode: "equipes", phase: "jeu", manche: 3 }),
      m("p", 2),
    ])!;
    expect([r.jeu, r.mode, r.phase, r.manche, r.max]).toEqual(["course", "equipes", "jeu", 3, 4]);
    const d = construireRoom("o", [m("o", 1)])!;
    expect([d.jeu, d.mode, d.phase, d.max]).toEqual(["arene", "1v1", "salle", 2]);
  });

  it("répartit les équipes en alternant, et refuse un joueur en trop", () => {
    const r = construireRoom("o", [
      m("o", 1, { mode: "equipes" }),
      m("p", 2),
      m("q", 3),
      m("r", 4),
      m("s", 5),
    ])!;
    expect(joueursDePartie(r).map((j) => j.equipe)).toEqual([0, 1, 0, 1]);
    expect(sansPlace(r, "r")).toBe(false);
    expect(sansPlace(r, "s")).toBe(true);
  });

  it("empêche de passer en 1v1 avec plus de 2 joueurs", () => {
    const r = construireRoom("o", [m("o", 1, { mode: "equipes" }), m("p", 2), m("q", 3)])!;
    expect(peutChangerMode(r, "1v1")).toBe(false);
    expect(peutChangerMode(r, "equipes")).toBe(true);
  });

  it("n'autorise le lancement que si les équipes sont jouables", () => {
    const un = construireRoom("o", [m("o", 1)])!;
    expect(raisonBlocage(un)).toMatch(/adversaire/);
    const deux = construireRoom("o", [m("o", 1), m("p", 2)])!;
    expect(raisonBlocage(deux)).toBeNull();
    const trois = construireRoom("o", [m("o", 1, { mode: "equipes" }), m("p", 2), m("q", 3)])!;
    expect(raisonBlocage(trois)).toMatch(/2 ou 4/);
    const quatre = construireRoom("o", [
      m("o", 1, { mode: "equipes" }),
      m("p", 2),
      m("q", 3),
      m("r", 4),
    ])!;
    expect(raisonBlocage(quatre)).toBeNull();
    const enCours = construireRoom("o", [m("o", 1, { phase: "jeu" }), m("p", 2)])!;
    expect(raisonBlocage(enCours)).toMatch(/en cours/);
  });

  it("résume la room pour la liste et lit la liste depuis la présence", () => {
    const r = construireRoom("o", [m("o", 1, { jeu: "combat" }), m("p", 2)])!;
    const info = resumeRoom(r);
    expect(info).toMatchObject({
      id: "o",
      createur: "O",
      nb: 2,
      max: 2,
      jeu: "combat",
      mode: "1v1",
    });
    const liste = sallesDepuisPresence({
      o: [{ salle: info }],
      x: [{ autre: 1 }],
      y: [{ salle: { ...info, id: "y", createur: "A" } }],
    });
    expect(liste.map((q) => q.id)).toEqual(["y", "o"]);
  });
});

describe("moteur de partie", () => {
  it("passe du décompte au jeu puis s'arrête à 120 secondes", () => {
    const jeu = JEUX.arene;
    const s = jeu.creer(duo, 1);
    expect(s.phase).toBe("compte");
    for (let i = 0; i < 60 * 3.1; i++) avancer(jeu, s, {}, 1 / 60);
    expect(s.phase).toBe("jeu");
    for (let i = 0; i < 60 * 125; i++) avancer(jeu, s, {}, 1 / 60);
    expect(s.phase).toBe("fini");
    expect(s.t).toBeCloseTo(DUREE_PARTIE, 0);
    expect(s.resultat).not.toBeNull();
  });

  it("arrête la partie quand un joueur quitte en 1v1, mais pas en 2v2", () => {
    const jeu = JEUX.combat;
    const s1 = jeu.creer(duo, 1);
    abandonner(jeu, s1, "b");
    expect(s1.phase).toBe("fini");
    expect(s1.resultat?.vainqueur).toBe(0);
    const s2 = jeu.creer(quatuor, 1);
    abandonner(jeu, s2, "d");
    expect(s2.phase).not.toBe("fini");
    abandonner(jeu, s2, "b");
    expect(s2.phase).toBe("fini");
    expect(equipesPresentes(s2.joueurs)).toEqual([0]);
  });

  it("mélange deux états : seules les positions sont lissées, les tableaux sont rapprochés par identifiant", () => {
    const a = {
      manche: 0,
      p: [
        { id: "x", x: 0 },
        { id: "y", x: 10, pv: 100 },
      ],
      nom: "a",
    };
    const b = {
      manche: 1,
      p: [
        { id: "y", x: 20, pv: 60 },
        { id: "z", x: 5 },
      ],
      nom: "b",
    };
    const r = melange(a, b, 0.5);
    expect(r.manche).toBe(1); // un numéro de round ne devient jamais « 0,5 »
    expect(r.nom).toBe("b");
    expect(r.p).toEqual([
      { id: "y", x: 15, pv: 60 },
      { id: "z", x: 5 },
    ]);
  });

  it("ne lisse pas une téléportation (réapparition)", () => {
    expect(melange({ x: 0 }, { x: 700 }, 0.5)).toEqual({ x: 700 });
  });

  it("l'état d'une partie passe dans le JSON du réseau sans rien perdre", () => {
    for (const j of LISTE_JEUX) {
      const s = j.creer(duo, 1);
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });

  it("le générateur aléatoire est reproductible", () => {
    const a = aleatoire(7);
    const b = aleatoire(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("chaque mini-jeu dure 120 s et se décrit pour l'interface", () => {
    for (const j of LISTE_JEUX) {
      expect(j.aide.length).toBeGreaterThan(0);
      expect(j.boutons.a).toBeTruthy();
      expect(j.creer(duo, 1).duree).toBe(120);
    }
  });
});

describe("Arène multi-rounds", () => {
  it("fait apparaître des armes, change d'arène à chaque round et finit à 120 s", () => {
    const manches = new Set<number>();
    let maxObjets = 0;
    const s = jouer("arene", duo, 130, (_t, e) => {
      const a = e as EtatArene;
      manches.add(a.manche);
      maxObjets = Math.max(maxObjets, a.objets.length);
      return {};
    }) as EtatArene;
    expect([...manches]).toEqual([0, 1, 2]);
    expect(maxObjets).toBeGreaterThan(0);
    expect(maxObjets).toBeLessThanOrEqual(5);
    expect(s.phase).toBe("fini");
  });

  it("un joueur qui fait face à l'autre et tire le met K.O. et gagne un kill", () => {
    // A est à gauche et regarde à droite, B est devant lui : on les aligne sur la même ligne.
    const jeu = JEUX.arene;
    const s = jeu.creer(duo, 3) as EtatArene;
    for (let i = 0; i < 60 * 3.1; i++) avancer(jeu, s, {}, 1 / 60);
    s.p[0]!.arme = "pistolet";
    s.p[0]!.munitions = 16;
    s.p[0]!.x = 100;
    s.p[0]!.y = 240;
    s.p[0]!.fx = 1; // regarde vers l'adversaire
    s.p[0]!.fy = 0;
    s.p[1]!.x = 300;
    s.p[1]!.y = 240;
    s.p[1]!.invul = 0;
    s.p[0]!.invul = 0;
    s.objets = [];
    for (let i = 0; i < 60 * 6 && s.p[0]!.kills === 0; i++) avancer(jeu, s, { a: BTN.a }, 1 / 60);
    expect(s.p[0]!.kills).toBe(1);
    expect(s.p[1]!.morts).toBe(1);
    expect(s.p[1]!.respawn).toBeGreaterThan(0);
  });

  it("les balles ne blessent pas un coéquipier", () => {
    const jeu = JEUX.arene;
    const s = jeu.creer(quatuor, 3) as EtatArene;
    for (let i = 0; i < 60 * 3.1; i++) avancer(jeu, s, {}, 1 / 60);
    const a = s.p[0]!;
    const c = s.p[2]!;
    a.arme = "pistolet";
    a.munitions = 16;
    a.invul = 0;
    c.invul = 0;
    a.x = 100;
    a.y = 240;
    c.x = 200;
    c.y = 240;
    s.p[1]!.x = 700;
    s.p[3]!.x = 700;
    s.objets = [];
    for (let i = 0; i < 60; i++) avancer(jeu, s, { a: BTN.a }, 1 / 60);
    expect(c.pv).toBe(100);
  });

  it("ramasse une arme en marchant dessus, et un mur arrête le joueur", () => {
    const jeu = JEUX.arene;
    const s = jeu.creer(duo, 5) as EtatArene;
    for (let i = 0; i < 60 * 3.1; i++) avancer(jeu, s, {}, 1 / 60);
    s.objets = [{ id: 999, x: s.p[0]!.x + 30, y: s.p[0]!.y, type: "sniper" }];
    for (let i = 0; i < 40; i++) avancer(jeu, s, { a: BTN.droite }, 1 / 60);
    expect(s.p[0]!.arme).toBe("sniper");
    expect(s.p[0]!.munitions).toBe(5);
    // Foncer vers un pilier de l'arène 1 (x 560-600, y 120-160) sans le traverser
    s.p[0]!.x = 300;
    s.p[0]!.y = 140;
    for (let i = 0; i < 240; i++) avancer(jeu, s, { a: BTN.droite }, 1 / 60);
    expect(s.p[0]!.x).toBeCloseTo(560 - 12, 0);
  });

  it("le classement et le vainqueur suivent les kills", () => {
    const jeu = JEUX.arene;
    const s = jeu.creer(duo, 1) as EtatArene;
    s.p[1]!.kills = 3;
    s.p[0]!.kills = 1;
    const r = jeu.finir(s);
    expect(r.vainqueur).toBe(1);
    expect(r.lignes[0]).toMatchObject({ id: "b", rang: 1 });
  });
});

/** Pilote automatique : gaz à fond, corrige sa trajectoire pour rester au centre de la route. */
const pilote = (c: { x: number; v: number }): number => {
  const braque = c.x < -0.08 ? BTN.droite : c.x > 0.08 ? BTN.gauche : 0;
  return (Math.abs(c.x) > 0.8 && c.v > 40 ? 0 : BTN.haut) | braque;
};

describe("Course de véhicules", () => {
  it("un pilote qui accélère termine 3 tours dans la limite des 120 s", () => {
    const s = jouer("course", duo, 130, (_t, e) => {
      const v = (e as EtatCourse).v;
      return { a: pilote(v[0]!), b: pilote(v[1]!) };
    }) as EtatCourse;
    const fins = s.v.map((c) => c.fin);
    expect(s.phase).toBe("fini");
    for (const f of fins) {
      expect(f).toBeGreaterThan(40);
      expect(f).toBeLessThan(120);
    }
  });

  it("le plus rapide gagne, les non-arrivés sont classés à la distance", () => {
    const s = jouer("course", duo, 130, (_t, e) => ({
      a: pilote((e as EtatCourse).v[0]!),
    })) as EtatCourse;
    expect(s.v[0]!.fin).toBeGreaterThan(0);
    expect(s.v[1]!.fin).toBe(-1);
    const r = s.resultat!;
    expect(r.vainqueur).toBe(0);
    expect(r.lignes.map((l) => l.id)).toEqual(["a", "b"]);
    expect(r.lignes[1]!.texte).toMatch(/non arrivé/);
  });

  it("sortir de la route ralentit fortement", () => {
    const jeu = JEUX.course;
    const s = jeu.creer(duo, 1) as EtatCourse;
    for (let i = 0; i < 60 * 3.1; i++) avancer(jeu, s, {}, 1 / 60);
    for (let i = 0; i < 60 * 5; i++) avancer(jeu, s, { a: BTN.haut | BTN.droite }, 1 / 60);
    const horsPiste = s.v[0]!;
    expect(Math.abs(horsPiste.x)).toBeGreaterThan(1);
    expect(horsPiste.v).toBeLessThan(25);
    // Une voiture qui ne touche à rien s'arrête, mais ne recule jamais.
    expect(s.v[1]!.v).toBe(0);
  });

  it("le turbo accélère puis doit se recharger", () => {
    const jeu = JEUX.course;
    const s = jeu.creer(duo, 1) as EtatCourse;
    for (let i = 0; i < 60 * 3.1; i++) avancer(jeu, s, {}, 1 / 60);
    avancer(jeu, s, { a: BTN.haut | BTN.a }, 1 / 60);
    expect(s.v[0]!.nitro).toBeGreaterThan(1);
    expect(s.v[0]!.nitroCd).toBeGreaterThan(5);
  });

  it("2 contre 2 : l'équipe aux meilleures places gagne", () => {
    const jeu = JEUX.course;
    const s = jeu.creer(quatuor, 1) as EtatCourse;
    s.v[0]!.fin = 80; // a (bleu)
    s.v[2]!.fin = 85; // c (bleu)
    s.v[1]!.fin = 90; // b (rouge)
    s.v[3]!.fin = 99; // d (rouge)
    const r = jeu.finir(s);
    expect(r.vainqueur).toBe(0);
    expect(r.lignes.map((l) => l.id)).toEqual(["a", "c", "b", "d"]);
  });
});

describe("Combat 2D", () => {
  it("un coup de poing touche l'adversaire en face et le fait reculer", () => {
    const jeu = JEUX.combat;
    const s = jeu.creer(duo, 1) as EtatCombat;
    for (let i = 0; i < 60 * 3.1; i++) avancer(jeu, s, {}, 1 / 60);
    s.f[0]!.x = 300;
    s.f[1]!.x = 340;
    for (let i = 0; i < 40; i++) avancer(jeu, s, { a: i === 0 ? BTN.a : 0 }, 1 / 60);
    expect(s.f[1]!.pv).toBe(93);
  });

  it("la garde réduit fortement les dégâts", () => {
    const jeu = JEUX.combat;
    const s = jeu.creer(duo, 1) as EtatCombat;
    for (let i = 0; i < 60 * 3.1; i++) avancer(jeu, s, {}, 1 / 60);
    s.f[0]!.x = 300;
    s.f[1]!.x = 340;
    for (let i = 0; i < 40; i++) avancer(jeu, s, { a: i === 0 ? BTN.a : 0, b: BTN.bas }, 1 / 60);
    expect(s.f[1]!.pv).toBeGreaterThan(98);
    expect(s.f[1]!.pv).toBeLessThan(100);
  });

  it("saute avec haut, retombe au sol", () => {
    const jeu = JEUX.combat;
    const s = jeu.creer(duo, 1) as EtatCombat;
    for (let i = 0; i < 60 * 3.1; i++) avancer(jeu, s, {}, 1 / 60);
    avancer(jeu, s, { a: BTN.haut }, 1 / 60);
    for (let i = 0; i < 12; i++) avancer(jeu, s, {}, 1 / 60);
    expect(s.f[0]!.y).toBeLessThan(410);
    for (let i = 0; i < 90; i++) avancer(jeu, s, {}, 1 / 60);
    expect(s.f[0]!.y).toBe(410);
  });

  it("la boule d'énergie voyage et blesse un adversaire", () => {
    const jeu = JEUX.combat;
    const s = jeu.creer(duo, 1) as EtatCombat;
    for (let i = 0; i < 60 * 3.1; i++) avancer(jeu, s, {}, 1 / 60);
    s.f[0]!.x = 100;
    s.f[1]!.x = 500;
    for (let i = 0; i < 60 * 2 && s.f[1]!.pv === 100; i++)
      avancer(jeu, s, { a: i === 0 ? BTN.c : 0 }, 1 / 60);
    expect(s.f[1]!.pv).toBe(86);
    expect(s.f[0]!.cdSpecial).toBeGreaterThan(0);
  });

  it("un K.O. donne la manche, et deux manches gagnent le match", () => {
    const jeu = JEUX.combat;
    const s = jeu.creer(duo, 1) as EtatCombat;
    for (let i = 0; i < 60 * 3.1; i++) avancer(jeu, s, {}, 1 / 60);
    for (let manche = 1; manche <= 2; manche++) {
      s.f[0]!.x = 300;
      s.f[1]!.x = 340;
      s.f[1]!.pv = 5;
      for (let i = 0; i < 40; i++) avancer(jeu, s, { a: i === 0 ? BTN.b : 0 }, 1 / 60);
      expect(s.manches[0]).toBe(manche);
      for (let i = 0; i < 60 * 3 && s.phase !== "fini"; i++) avancer(jeu, s, {}, 1 / 60);
    }
    expect(s.phase).toBe("fini");
    expect(s.resultat?.vainqueur).toBe(0);
  });

  it("au chrono, la manche en cours revient à l'équipe qui a le plus de PV", () => {
    const jeu = JEUX.combat;
    const s = jeu.creer(duo, 1) as EtatCombat;
    s.f[0]!.pv = 80;
    s.f[1]!.pv = 30;
    expect(jeu.finir(s).vainqueur).toBe(0);
    s.f[0]!.pv = 30;
    s.f[1]!.pv = 30;
    expect(jeu.finir(s).vainqueur).toBeNull();
  });

  it("tient 120 s sans aucune entrée, en 2 contre 2", () => {
    const s = jouer("combat", quatuor, 130, () => ({})) as EtatCombat;
    expect(s.phase).toBe("fini");
    expect(s.resultat?.lignes).toHaveLength(4);
  });
});
