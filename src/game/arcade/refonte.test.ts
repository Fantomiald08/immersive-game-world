import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apparenceDepuis } from "../apparence";
import { Effets, MAX_PARTICULES } from "./fx";
import { creerCerveau } from "./ia";
import { ARENES, ARMES, type EtatArene } from "./jeux/arene";
import {
  FORKS,
  LIMITE_INTERIEURE,
  LONGUEUR_TOUR,
  MURET,
  OBSTACLES,
  TOURS,
  TRONCONS,
  courbure,
} from "./jeux/circuit";
import type { EtatCombat } from "./jeux/combat";
import type { EtatCourse } from "./jeux/course";
import { JEUX, LISTE_JEUX } from "./jeux";
import { avancer, emettre, melange } from "./moteur";
import { joueursSolo, type FormatSolo } from "./partieSolo";
import { decorEnCache, dessinerChibi, type PoseChibi } from "./rendu/pixel";
import { BTN, type JeuId, type JoueurPartie } from "./types";

const DT = 1 / 60;
const duo: JoueurPartie[] = [
  { id: "a", pseudo: "A", equipe: 0, couleur: "#4da3ff" },
  { id: "b", pseudo: "B", equipe: 1, couleur: "#ff6b6b" },
];
const quatuor: JoueurPartie[] = [
  ...duo,
  { id: "c", pseudo: "C", equipe: 0, couleur: "#8fe0ff" },
  { id: "d", pseudo: "D", equipe: 1, couleur: "#ffb36b" },
];
const demarrer = (id: JeuId, joueurs = duo, graine = 3) => {
  const jeu = JEUX[id];
  const s = jeu.creer(joueurs, graine);
  for (let i = 0; i < 60 * 3.2; i++) avancer(jeu, s, {}, DT);
  return { jeu, s };
};

/** Faux contexte 2D qui accepte tous les ordres de dessin (rapide : une seule fonction vide partagée). */
function faussContexte(): CanvasRenderingContext2D {
  const degrade = { addColorStop: () => {} };
  const rien = () => {};
  return new Proxy(
    {},
    {
      get: (_t, k) =>
        k === "createLinearGradient" || k === "createRadialGradient"
          ? () => degrade
          : k === "measureText"
            ? () => ({ width: 10 })
            : rien,
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
}

describe("le circuit", () => {
  it("fait 2 400 m exactement, sans longue ligne droite, avec des virages marqués", () => {
    expect(TRONCONS.reduce((t, [l]) => t + l, 0)).toBe(LONGUEUR_TOUR);
    expect(TRONCONS.every(([l, c]) => c !== 0 || l <= 60)).toBe(true);
    expect(Math.max(...TRONCONS.map(([, c]) => Math.abs(c)))).toBeGreaterThanOrEqual(1.2);
    // La boucle se referme : mêmes virages d'un tour à l'autre.
    for (const z of [10, 777, 1999]) expect(courbure(z + LONGUEUR_TOUR)).toBe(courbure(z));
  });

  it("a 3 embranchements sans chevauchement, chacun avec deux routes différentes", () => {
    expect(FORKS).toHaveLength(3);
    FORKS.forEach((f, i) => {
      expect(f.fin).toBeGreaterThan(f.debut + 100);
      if (i > 0) expect(f.debut).toBeGreaterThan(FORKS[i - 1]!.fin);
      const dedans = OBSTACLES.filter((o) => o.z >= f.debut && o.z <= f.fin);
      const interieure = dedans.filter((o) => o.x > MURET);
      const exterieure = dedans.filter((o) => o.x < -MURET);
      // Voie intérieure : technique (obstacles) mais avec une récompense (boost) ; extérieure : plus dégagée.
      expect(
        interieure.filter((o) => o.type === "plot" || o.type === "bloc").length,
      ).toBeGreaterThanOrEqual(4);
      expect(interieure.some((o) => o.type === "boost")).toBe(true);
      expect(exterieure.length).toBeGreaterThanOrEqual(1);
      expect(exterieure.length).toBeLessThan(interieure.length);
    });
  });

  it("contient les 4 types d'éléments, tous bien placés sur la route", () => {
    for (const type of ["plot", "bloc", "huile", "boost"] as const)
      expect(OBSTACLES.some((o) => o.type === type)).toBe(true);
    expect(OBSTACLES.filter((o) => o.type === "boost").length).toBeGreaterThanOrEqual(5);
    for (const o of OBSTACLES) {
      expect(o.z).toBeGreaterThan(0);
      expect(o.z).toBeLessThan(LONGUEUR_TOUR);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(1);
    }
  });
});

describe("mécaniques de la course", () => {
  const voiture = (s: EtatCourse, patch: Partial<EtatCourse["v"][0]>) =>
    Object.assign(s.v[0]!, { v: 40 }, patch);

  it("un plot ralentit et fait rebondir sans jamais bloquer la voiture", () => {
    const { jeu, s } = demarrer("course");
    const c = voiture(s as EtatCourse, { z: 636, x: -0.3, v: 40 });
    for (let i = 0; i < 6; i++) avancer(jeu, s, { a: BTN.haut }, DT);
    expect(c.v).toBeLessThan(34);
    expect(s.ev.some((e) => e.k === "choc" && e.qui === "a")).toBe(true);
    for (let i = 0; i < 120; i++) avancer(jeu, s, { a: BTN.haut }, DT);
    expect(c.z).toBeGreaterThan(650);
    expect(c.v).toBeGreaterThan(5);
  });

  it("un bloc de béton, même à l'arrêt devant, finit par être dépassé", () => {
    const { jeu, s } = demarrer("course");
    const c = voiture(s as EtatCourse, { z: 838, x: -0.6, v: 0 });
    for (let i = 0; i < 60 * 6; i++) avancer(jeu, s, { a: BTN.haut }, DT);
    expect(c.z).toBeGreaterThan(850);
  });

  it("une flaque d'huile fait déraper : direction molle et vitesse perdue par rapport à une route propre", () => {
    const { jeu, s } = demarrer("course");
    const [sur, propre] = (s as EtatCourse).v as [EtatCourse["v"][0], EtatCourse["v"][0]];
    Object.assign(sur, { z: 756, x: 0.1, v: 40 });
    Object.assign(propre, { z: 1455, x: -0.8, v: 40 });
    for (let i = 0; i < 20; i++) avancer(jeu, s, {}, DT);
    expect(sur.glisse).toBeGreaterThan(0);
    expect(s.ev.some((e) => e.k === "huile")).toBe(true);
    expect(sur.v).toBeLessThan(propre.v);
  });

  it("une dalle de boost accélère nettement, une seule fois à la suite", () => {
    const { jeu, s } = demarrer("course");
    const c = voiture(s as EtatCourse, { z: 896, x: 0, v: 30 });
    for (let i = 0; i < 30; i++) avancer(jeu, s, { a: BTN.haut }, DT);
    expect(c.boost).toBeGreaterThan(0);
    expect(c.v).toBeGreaterThan(48);
    expect(s.ev.filter((e) => e.k === "boost")).toHaveLength(1);
  });

  it("le muret central repousse sans bloquer, et la voie intérieure est limitée", () => {
    const { jeu, s } = demarrer("course");
    const c = voiture(s as EtatCourse, { z: 450, x: 0.02, v: 30, cote: 1 });
    avancer(jeu, s, {}, DT);
    expect(c.x).toBeGreaterThanOrEqual(MURET);
    expect(s.ev.some((e) => e.k === "choc")).toBe(true);
    voiture(s as EtatCourse, { z: 520, x: 0.95, v: 30, choc: 0 });
    avancer(jeu, s, {}, DT);
    expect(c.x).toBeLessThanOrEqual(LIMITE_INTERIEURE);
  });

  it("la voie intérieure est un raccourci : on avance plus vite pour la même vitesse", () => {
    const { jeu, s } = demarrer("course");
    const [a, b] = (s as EtatCourse).v as [EtatCourse["v"][0], EtatCourse["v"][0]];
    Object.assign(a, { z: 1158, x: 0.2, v: 40 });
    Object.assign(b, { z: 1158, x: -0.3, v: 40 });
    avancer(jeu, s, { a: BTN.haut, b: BTN.haut }, DT);
    expect(a.z - 1158).toBeGreaterThan((b.z - 1158) * 1.08);
  });

  it("annonce chaque tour et l'arrivée", () => {
    const { jeu, s } = demarrer("course");
    const c = voiture(s as EtatCourse, { z: LONGUEUR_TOUR - 0.3, x: 0, v: 40 });
    for (let i = 0; i < 4; i++) avancer(jeu, s, { a: BTN.haut }, DT);
    expect(c.tours).toBe(1);
    expect(s.ev.find((e) => e.k === "tour" && e.qui === "a")?.v).toBe(2);
    voiture(s as EtatCourse, { z: LONGUEUR_TOUR * TOURS - 0.3, v: 40 });
    for (let i = 0; i < 4; i++) avancer(jeu, s, { a: BTN.haut }, DT);
    expect(c.fin).toBeGreaterThan(0);
    expect(s.ev.some((e) => e.k === "tour" && e.v === TOURS + 1)).toBe(true);
  });

  it("la liste d'événements reste bornée, même après des centaines d'impacts", () => {
    const { s } = demarrer("course");
    for (let i = 0; i < 300; i++) emettre(s, { k: "choc", x: 0, y: 0 });
    expect(s.ev.length).toBeLessThanOrEqual(24);
    expect(s.evN).toBeGreaterThanOrEqual(300);
  });

  it("l'IA choisit une voie à chaque embranchement et ne ralentit pas sur les alliés", () => {
    const { s } = demarrer("course", quatuor);
    const cerveau = creerCerveau("course", "c", 5);
    const e = s as EtatCourse;
    e.v[2]!.z = 340;
    e.v[2]!.x = 0;
    let gauche = 0;
    let droite = 0;
    for (let i = 0; i < 40; i++) {
      const r = cerveau(s, 0.1);
      if (r & BTN.gauche) gauche++;
      if (r & BTN.droite) droite++;
      expect(r & BTN.bas).toBe(0);
    }
    expect(gauche + droite).toBeGreaterThan(10);
  });
});

describe("effets visuels", () => {
  it("le nombre de particules reste borné, et elles disparaissent avec le temps", () => {
    const fx = new Effets();
    for (let i = 0; i < 20; i++) fx.gerbe(0, 0, 100, { couleur: "#fff" });
    expect(fx.particules.length).toBeLessThanOrEqual(MAX_PARTICULES);
    for (let i = 0; i < 300; i++) fx.maj(DT);
    expect(fx.particules.length).toBe(0);
  });

  it("chaque événement n'est traité qu'une fois, même renvoyé plusieurs fois par le réseau", () => {
    const fx = new Effets();
    const evs = [
      { n: 1, k: "impact" as const, x: 0, y: 0 },
      { n: 2, k: "ko" as const, x: 0, y: 0 },
    ];
    expect(fx.nouveaux(evs)).toHaveLength(2);
    expect(fx.nouveaux(evs)).toHaveLength(0);
    expect(fx.nouveaux([...evs, { n: 3, k: "kill" as const, x: 0, y: 0 }]).map((e) => e.n)).toEqual(
      [3],
    );
  });

  it("le tremblement d'écran est plafonné et s'éteint, les popups et ondes sont bornés", () => {
    const fx = new Effets();
    fx.secouer(500);
    expect(fx.secousse).toBeLessThanOrEqual(14);
    for (let i = 0; i < 60; i++) fx.maj(DT);
    expect(fx.secousse).toBe(0);
    for (let i = 0; i < 50; i++) {
      fx.popup(0, 0, "x");
      fx.onde(0, 0, 10);
    }
    expect(fx.popups.length).toBeLessThanOrEqual(10);
    expect(fx.ondes.length).toBeLessThanOrEqual(8);
  });

  it("la barre de vie à traînée rattrape lentement la vraie valeur", () => {
    const fx = new Effets();
    fx.maj(DT);
    expect(fx.suivi("p", 100)).toBe(100);
    expect(fx.suivi("p", 60)).toBeGreaterThan(60);
    for (let i = 0; i < 120; i++) {
      fx.maj(DT);
      fx.suivi("p", 60);
    }
    expect(fx.suivi("p", 60)).toBe(60);
  });

  it("détecte un appareil lent pour simplifier le décor", () => {
    const rapide = new Effets();
    for (let i = 0; i < 120; i++) rapide.maj(1 / 60);
    expect(rapide.lent).toBe(false);
    const lent = new Effets();
    for (let i = 0; i < 200; i++) lent.maj(0.05);
    expect(lent.lent).toBe(true);
  });

  it("les événements ne sont pas « mélangés » entre deux états reçus du réseau", () => {
    const a = { ev: [{ n: 1, x: 0, y: 0 }], p: { x: 0 } };
    const b = { ev: [{ n: 2, x: 10, y: 4 }], p: { x: 10 } };
    const m = melange(a, b, 0.5);
    expect(m.ev).toEqual(b.ev);
    expect(m.p.x).toBe(5);
  });

  it("l'état de chaque jeu, événements compris, passe dans le JSON du réseau", () => {
    for (const j of LISTE_JEUX) {
      const s = j.creer(duo, 1);
      for (let i = 0; i < 60 * 8; i++)
        avancer(j, s, { a: BTN.a | BTN.droite, b: BTN.a | BTN.gauche }, DT);
      emettre(s, { k: "impact", x: 1.5, y: 2.5, v: 12, c: "#fff", qui: "a" });
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });
});

describe("arène : thèmes, armes, télégraphe et lance-impulsion", () => {
  it("enchaîne 3 arènes à thèmes différents", () => {
    expect(ARENES.map((a) => a.theme)).toEqual(["labo", "venus", "hangar"]);
    expect(ARENES[1]!.nom).toMatch(/Vénus/);
  });

  it("propose au moins 3 armes différenciées dont une explosive, avec recul", () => {
    const armes = Object.values(ARMES).filter((a) => a.nom !== "Poings");
    expect(armes.length).toBeGreaterThanOrEqual(3);
    expect(new Set(armes.map((a) => a.nom)).size).toBe(armes.length);
    expect(armes.some((a) => a.nom === "Blaster rapide")).toBe(true);
    expect(armes.some((a) => a.nom === "Fusil à dispersion" && a.tirs > 1)).toBe(true);
    expect(armes.some((a) => a.nom === "Lance-impulsion" && a.explosive)).toBe(true);
    expect(ARMES.pompe.recul).toBeGreaterThan(ARMES.mitraillette.recul);
  });

  it("les armes n'apparaissent que sur les points de spawn de l'arène", () => {
    const { jeu, s } = demarrer("arene", duo, 7);
    const e = s as EtatArene;
    const vus = new Set<string>();
    for (let i = 0; i < 60 * 30; i++) {
      avancer(jeu, s, {}, DT);
      if (e.manche !== 0) break;
      for (const o of e.objets) vus.add(`${o.x},${o.y}`);
    }
    expect(vus.size).toBeGreaterThan(2);
    const autorises = new Set(ARENES[0]!.spawns.map((p) => `${p.x},${p.y}`));
    for (const v of vus) expect(autorises.has(v)).toBe(true);
  });

  it("une arme en cours d'apparition (télégraphe) ne peut pas encore être ramassée", () => {
    const { jeu, s } = demarrer("arene");
    const e = s as EtatArene;
    e.objets = [{ id: 900, x: e.p[0]!.x, y: e.p[0]!.y, type: "sniper", delai: 1 }];
    for (let i = 0; i < 30; i++) avancer(jeu, s, {}, DT);
    expect(e.p[0]!.arme).toBe("poing");
    expect(e.objets).toHaveLength(1);
    for (let i = 0; i < 60; i++) avancer(jeu, s, {}, DT);
    expect(e.p[0]!.arme).toBe("sniper");
  });

  it("le lance-impulsion explose : dégâts de zone et recul aux adversaires, alliés repoussés mais jamais blessés", () => {
    const { jeu, s } = demarrer("arene", quatuor);
    const e = s as EtatArene;
    const [tireur, ennemi, allie] = [e.p[0]!, e.p[1]!, e.p[2]!];
    for (const p of e.p) p.invul = 0;
    e.p[3]!.x = 700;
    e.p[3]!.y = 60;
    e.objets = [];
    Object.assign(tireur, { x: 200, y: 240, fx: 1, fy: 0, arme: "roquette", munitions: 3 });
    Object.assign(ennemi, { x: 330, y: 240 });
    Object.assign(allie, { x: 330, y: 270 });
    const xAllie = allie.x;
    for (let i = 0; i < 90 && !e.ev.some((v) => v.k === "explosion"); i++)
      avancer(jeu, s, { a: BTN.a }, DT);
    expect(e.ev.some((v) => v.k === "explosion")).toBe(true);
    expect(ennemi.pv).toBeLessThan(100);
    expect(allie.pv).toBe(100);
    for (let i = 0; i < 20; i++) avancer(jeu, s, {}, DT);
    expect(Math.hypot(allie.x - xAllie, allie.y - 270)).toBeGreaterThan(2);
    expect(e.ev.some((v) => v.k === "impact")).toBe(true);
  });

  it("une arme lourde repousse le tireur (recul)", () => {
    const { jeu, s } = demarrer("arene");
    const e = s as EtatArene;
    Object.assign(e.p[0]!, { x: 300, y: 300, fx: 1, fy: 0, arme: "pompe", munitions: 5, invul: 0 });
    e.objets = [];
    for (let i = 0; i < 4; i++) avancer(jeu, s, i === 0 ? { a: BTN.a } : {}, DT);
    expect(e.p[0]!.x).toBeLessThan(300);
    expect(e.ev.some((v) => v.k === "tir")).toBe(true);
  });

  it("un kill est annoncé à tout le monde avec le tireur", () => {
    const { jeu, s } = demarrer("arene");
    const e = s as EtatArene;
    Object.assign(e.p[0]!, {
      x: 100,
      y: 240,
      fx: 1,
      fy: 0,
      arme: "sniper",
      munitions: 5,
      invul: 0,
    });
    Object.assign(e.p[1]!, { x: 300, y: 240, pv: 20, invul: 0 });
    e.objets = [];
    for (let i = 0; i < 40 && !e.ev.some((v) => v.k === "kill"); i++)
      avancer(jeu, s, { a: BTN.a }, DT);
    expect(e.ev.find((v) => v.k === "kill")?.qui).toBe("a");
  });
});

describe("combat : hitstop, parade et K.O.", () => {
  const preparer = (pvCible = 100, garde = false) => {
    const { jeu, s } = demarrer("combat");
    const e = s as EtatCombat;
    e.f[0]!.x = 300;
    e.f[1]!.x = 340;
    e.f[1]!.pv = pvCible;
    return { jeu, s, e, garde };
  };

  it("un coup lourd fige l'image un instant, mais le chrono continue", () => {
    const { jeu, s, e } = preparer();
    let i = 0;
    for (; i < 60 && e.gel <= 0; i++) avancer(jeu, s, { a: i === 0 ? BTN.b : 0 }, DT);
    expect(e.gel).toBeGreaterThanOrEqual(0.07);
    const avant = { x0: e.f[0]!.x, x1: e.f[1]!.x, t: s.t, atk: e.f[0]!.atk?.t };
    for (let k = 0; k < 2; k++) avancer(jeu, s, {}, DT);
    expect(e.f[0]!.x).toBe(avant.x0);
    expect(e.f[1]!.x).toBe(avant.x1);
    expect(e.f[0]!.atk?.t).toBe(avant.atk);
    expect(s.t).toBeCloseTo(avant.t + 2 * DT, 5);
    // Puis tout repart.
    for (let k = 0; k < 20; k++) avancer(jeu, s, {}, DT);
    expect(e.gel).toBeLessThanOrEqual(0);
    expect(e.f[1]!.x).not.toBe(avant.x1);
  });

  it("un coup léger fige moins longtemps qu'un coup lourd", () => {
    const leger = preparer();
    for (let i = 0; i < 40 && leger.e.gel <= 0; i++)
      avancer(leger.jeu, leger.s, { a: i === 0 ? BTN.a : 0 }, DT);
    const lourd = preparer();
    for (let i = 0; i < 60 && lourd.e.gel <= 0; i++)
      avancer(lourd.jeu, lourd.s, { a: i === 0 ? BTN.b : 0 }, DT);
    expect(leger.e.gel).toBeLessThan(lourd.e.gel);
  });

  it("la garde pare le coup : événement « parade », presque pas de dégâts", () => {
    const { jeu, s, e } = preparer();
    for (let i = 0; i < 60; i++) avancer(jeu, s, { a: i === 0 ? BTN.b : 0, b: BTN.bas }, DT);
    expect(e.ev.some((v) => v.k === "parade")).toBe(true);
    expect(e.f[1]!.pv).toBeGreaterThan(97);
  });

  it("un K.O. est annoncé", () => {
    const { jeu, s, e } = preparer(4);
    for (let i = 0; i < 60; i++) avancer(jeu, s, { a: i === 0 ? BTN.b : 0 }, DT);
    expect(e.ev.some((v) => v.k === "ko" && v.qui === "b")).toBe(true);
    expect(e.f[1]!.ko).toBe(true);
  });
});

describe("rendu : tout le code de dessin s'exécute sans erreur", () => {
  // jsdom n'a pas de canvas : on lui en fournit un faux pour que le décor en cache fonctionne.
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(faussContexte() as never);
  });
  afterEach(() => vi.restoreAllMocks());
  const formats: FormatSolo[] = ["1v1", "2v2", "ffa"];
  const jouerEtDessiner = (jeuId: JeuId, format: FormatSolo, secondes: number, moi: string) => {
    const joueurs = joueursSolo(
      { id: "moi", pseudo: "Léo", apparence: apparenceDepuis("leo") },
      format,
    ).map((j) => ({ ...j, ia: true }));
    const jeu = JEUX[jeuId];
    const s = jeu.creer(joueurs, 4);
    const cerv = new Map(joueurs.map((j, i) => [j.id, creerCerveau(jeuId, j.id, 40 + i)]));
    const ctx = faussContexte();
    const fx = new Effets();
    const ent: Record<string, number> = {};
    for (let i = 0; i < secondes * 60 && s.phase !== "fini"; i++) {
      if (s.phase === "jeu") for (const [id, c] of cerv) ent[id] = c(s, DT);
      avancer(jeu, s, ent, DT);
      fx.maj(DT);
      if (i % 12 === 0) jeu.dessiner(ctx, s, moi, fx);
      expect(fx.particules.length).toBeLessThanOrEqual(MAX_PARTICULES);
    }
    jeu.dessiner(ctx, s, moi, fx);
    return { s, fx };
  };

  for (const jeu of ["arene", "combat", "course"] as const)
    for (const f of formats)
      it(`${jeu} · ${f}`, () => {
        const { s } = jouerEtDessiner(jeu, f, jeu === "course" ? 70 : 40, "moi");
        expect(s.evN).toBeGreaterThan(0);
      });

  it("un spectateur (joueur absent de la partie) peut aussi regarder", () => {
    for (const jeu of ["arene", "combat", "course"] as const)
      jouerEtDessiner(jeu, "2v2", 15, "inconnu");
  });

  it("le dernier écran (partie finie) se dessine aussi, avec ses effets", () => {
    for (const jeu of ["arene", "combat"] as const) {
      const { s } = jouerEtDessiner(jeu, "1v1", 135, "moi");
      expect(s.phase).toBe("fini");
    }
  });

  it("le personnage chibi se dessine dans toutes les poses et toutes les directions", () => {
    const ctx = faussContexte();
    const poses: PoseChibi[] = [
      "idle",
      "marche",
      "saut",
      "garde",
      "leger",
      "lourd",
      "special",
      "degat",
      "ko",
    ];
    for (const nom of ["a", "b", "c", "d", "e", "f"])
      for (const dir of ["bas", "haut", "gauche", "droite"] as const)
        for (const pose of poses)
          dessinerChibi(ctx, {
            x: 10,
            y: 20,
            ech: 4,
            a: apparenceDepuis(nom),
            dir,
            pose,
            frame: 3,
            progres: 0.6,
            blanc: pose === "degat",
          });
  });

  it("le décor en cache a un plan B quand le cache n'est pas disponible", () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const appels = vi.fn();
    expect(decorEnCache("test-sans-cache", 10, 10, appels, faussContexte())).toBe(false);
    expect(appels).not.toHaveBeenCalled();
    spy.mockRestore();
    const spy2 = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(faussContexte() as never);
    const dessin = vi.fn();
    expect(decorEnCache("test-avec-cache", 10, 10, dessin, faussContexte())).toBe(true);
    expect(decorEnCache("test-avec-cache", 10, 10, dessin, faussContexte())).toBe(true);
    expect(dessin).toHaveBeenCalledTimes(1); // dessiné une seule fois, puis recopié
    spy2.mockRestore();
  });
});
