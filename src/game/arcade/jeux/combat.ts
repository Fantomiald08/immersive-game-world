import { borne, dessinerHud, emettre, meilleureEquipe } from "../moteur";
import { chronoHexagone, faceCombat } from "../rendu/hud";
import { arcLumineux, dessinerCombattantPixel, type PoseCombat } from "../rendu/combattants";
import { dessinerDojo, dessinerSpectateursDojo, LANTERNES_DOJO } from "../rendu/dojo";
import type { Effets } from "../fx";
import {
  apparenceDe,
  decorEnCache,
  dessinerChibi,
  halo,
  hash,
  ombre,
  OL,
  panneau,
  r,
  texte,
  type PoseChibi,
} from "../rendu/pixel";
import {
  BTN,
  DUREE_COMPTE,
  DUREE_PARTIE,
  presse,
  type Equipe,
  type EtatBase,
  type Jeu,
  type JoueurPartie,
  type LigneClassement,
  type Resultat,
  COULEUR_EQUIPE,
  equipesDe,
  nomEquipe,
} from "../types";

/**
 * Mini-jeu 3 : combat 2D en vue de côté (façon Street Fighter / Tekken).
 * Manches au meilleur des 3 : une équipe gagne la manche quand tous ses adversaires sont K.O.
 * Au bout de 120 s, la manche en cours revient à l'équipe qui a le plus de PV.
 */

export const L = 800;
export const H = 480;
export const SOL = 410;
const PV_MAX = 100;
const ROSE_BARRE = "#d63fa8";
const GRAVITE = 1500;
const SAUT = 590;
const VITESSE = 175;
const MANCHES_VICTOIRE = 2;
const ENTRACTE = 2.4;
const LARG = 40;
const HAUT = 96;

export type TypeAttaque = "a" | "b" | "c";
type DefAttaque = {
  total: number;
  debut: number;
  fin: number;
  portee: number;
  degats: number;
  etourdi: number;
  recul: number;
};
export const ATTAQUES: Record<TypeAttaque, DefAttaque> = {
  a: { total: 0.32, debut: 0.08, fin: 0.2, portee: 54, degats: 7, etourdi: 0.25, recul: 110 },
  b: { total: 0.5, debut: 0.16, fin: 0.32, portee: 72, degats: 12, etourdi: 0.35, recul: 220 },
  c: { total: 0.45, debut: 0.18, fin: 0.19, portee: 0, degats: 14, etourdi: 0.4, recul: 180 },
};
const RECHARGE_SPECIAL = 2.5;

export type Attaque = { type: TypeAttaque; t: number; touches: string[]; lance: boolean };
export type Combattant = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 1 = regarde à droite, -1 = à gauche. */
  face: 1 | -1;
  pv: number;
  ko: boolean;
  garde: boolean;
  etourdi: number;
  atk: Attaque | null;
  cdSpecial: number;
  /** Éclair de coup reçu (dessin). */
  flash: number;
  marche: number;
};
export type Boule = {
  id: number;
  x: number;
  y: number;
  vx: number;
  par: string;
  eq: Equipe;
  vie: number;
};
export type EtatCombat = EtatBase & {
  f: Combattant[];
  boules: Boule[];
  manche: number;
  /** Manches gagnées, par équipe. */
  manches: number[];
  /** > 0 : image figée par un coup lourd (hitstop). Le chrono de la partie continue. */
  gel: number;
  /** > 0 : pause entre deux manches. */
  entracte: number;
  annonce: string;
  suivant: number;
};

/** Position de départ : l'équipe 0 à gauche, la 1 à droite ; en chacun pour soi, les équipes 2 et 3 au centre. */
const DEPARTS: Record<Equipe, [number, number]> = {
  0: [170, 280],
  1: [L - 170, L - 280],
  2: [340, 400],
  3: [460, 400],
};
const depart = (j: JoueurPartie, rang: number): number => DEPARTS[j.equipe][rang % 2 === 0 ? 0 : 1];

function placer(s: EtatCombat): void {
  const compte: Record<Equipe, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  s.f = s.joueurs.map((j) => {
    const x = depart(j, compte[j.equipe]++);
    return {
      id: j.id,
      x,
      y: SOL,
      vx: 0,
      vy: 0,
      face: x < L / 2 ? 1 : -1,
      pv: PV_MAX,
      ko: false,
      garde: false,
      etourdi: 0,
      atk: null,
      cdSpecial: 0,
      flash: 0,
      marche: 0,
    };
  });
  s.boules = [];
}

function creer(joueurs: JoueurPartie[]): EtatCombat {
  const s: EtatCombat = {
    phase: "compte",
    compte: DUREE_COMPTE,
    t: 0,
    duree: DUREE_PARTIE,
    joueurs: joueurs.map((j) => ({ ...j })),
    resultat: null,
    f: [],
    boules: [],
    manche: 1,
    manches: [0, 0, 0, 0],
    gel: 0,
    ev: [],
    evN: 0,
    entracte: 0,
    annonce: "",
    suivant: 1,
  };
  placer(s);
  return s;
}

const vivants = (s: EtatCombat, e: Equipe) =>
  s.f.filter((c, i) => !c.ko && !s.joueurs[i]!.absent && s.joueurs[i]!.equipe === e);

function pvEquipe(s: EtatCombat, e: Equipe): number {
  return s.f.reduce(
    (t, c, i) => (s.joueurs[i]!.equipe === e && !s.joueurs[i]!.absent ? t + c.pv : t),
    0,
  );
}

/** Applique un coup : garde, étourdissement, recul. */
function toucher(
  s: EtatCombat,
  cible: Combattant,
  defAtt: DefAttaque,
  sens: 1 | -1,
  devantCible: boolean,
  tireur?: Combattant,
): void {
  if (cible.ko) return;
  const type: TypeAttaque = defAtt === ATTAQUES.a ? "a" : defAtt === ATTAQUES.b ? "b" : "c";
  const ex = cible.x - sens * 14;
  const ey = cible.y - 60;
  if (cible.garde && devantCible) {
    cible.pv = Math.max(0, cible.pv - defAtt.degats * 0.15);
    cible.vx = sens * 60;
    cible.flash = 0.05;
    s.gel = Math.max(s.gel, 0.03);
    emettre(s, { k: "parade", x: ex, y: ey, v: defAtt.degats, qui: cible.id });
  } else {
    cible.pv = Math.max(0, cible.pv - defAtt.degats);
    cible.etourdi = defAtt.etourdi;
    cible.atk = null;
    cible.vx = sens * defAtt.recul;
    cible.flash = 0.12;
    // Hitstop : plus le coup est lourd, plus l'image se fige (le chrono, lui, continue).
    s.gel = Math.max(s.gel, type === "a" ? 0.035 : type === "b" ? 0.075 : 0.09);
    emettre(s, { k: "impact", x: ex, y: ey, v: defAtt.degats, qui: cible.id });
  }
  // La jauge du coup spécial se charge en frappant (plus qu'en se faisant parer) et en encaissant.
  if (defAtt !== ATTAQUES.c) {
    const garde = cible.garde && devantCible;
    if (tireur) tireur.cdSpecial = Math.max(0, tireur.cdSpecial - (garde ? 0.15 : 0.4));
    if (!garde) cible.cdSpecial = Math.max(0, cible.cdSpecial - defAtt.degats * 0.03);
  }
  if (cible.pv <= 0) {
    cible.ko = true;
    cible.vy = -260;
    cible.etourdi = 99;
    cible.atk = null;
    s.gel = Math.max(s.gel, 0.14);
    emettre(s, { k: "ko", x: cible.x, y: cible.y - 50, qui: cible.id });
  }
}

function finDeManche(s: EtatCombat, gagnante: Equipe | null): void {
  if (gagnante !== null) s.manches[gagnante] = (s.manches[gagnante] ?? 0) + 1;
  s.annonce = gagnante === null ? "ÉGALITÉ" : `K.O. ! Manche : ${nomEquipe(s.joueurs, gagnante)}`;
  s.entracte = ENTRACTE;
}

function pas(base: EtatBase, entrees: Readonly<Record<string, number>>, dt: number): void {
  const s = base as EtatCombat;

  if (s.entracte > 0) {
    s.entracte -= dt;
    // Les K.O. finissent de tomber pendant la pause.
    for (const c of s.f) {
      c.vy += GRAVITE * dt;
      c.y = Math.min(SOL, c.y + c.vy * dt);
      if (c.y >= SOL) c.vy = 0;
    }
    if (s.entracte <= 0) {
      s.entracte = 0;
      s.annonce = "";
      if (!s.manches.some((m) => m >= MANCHES_VICTOIRE)) {
        s.manche += 1;
        placer(s);
      }
    }
    return;
  }

  // Hitstop : tout est figé un très court instant après un coup lourd.
  if (s.gel > 0) {
    s.gel -= dt;
    return;
  }

  s.f.forEach((c, i) => {
    const j = s.joueurs[i]!;
    c.flash = Math.max(0, c.flash - dt);
    c.cdSpecial = Math.max(0, c.cdSpecial - dt);
    const sol = c.y >= SOL - 0.5;
    if (c.ko || j.absent) {
      c.vy += GRAVITE * dt;
      c.y = Math.min(SOL, c.y + c.vy * dt);
      c.vx *= 0.9;
      c.x = borne(c.x + c.vx * dt, 30, L - 30);
      if (j.absent && !c.ko) {
        c.ko = true;
        c.pv = 0;
      }
      return;
    }
    const e = entrees[c.id] ?? 0;

    // Regarde toujours l'adversaire le plus proche une fois l'étourdissement terminé.
    let proche: Combattant | null = null;
    s.f.forEach((q, k) => {
      if (q.ko || s.joueurs[k]!.equipe === j.equipe) return;
      if (!proche || Math.abs(q.x - c.x) < Math.abs(proche.x - c.x)) proche = q;
    });
    const cible = proche as Combattant | null;
    if (cible && Math.abs(cible.x - c.x) > 6 && c.etourdi <= 0) c.face = cible.x > c.x ? 1 : -1;

    if (c.etourdi > 0) {
      c.garde = false;
      c.etourdi = Math.max(0, c.etourdi - dt);
      c.vx *= 0.88;
    } else {
      c.garde = sol && presse(e, BTN.bas) && !c.atk;
      if (c.atk) {
        c.atk.t += dt;
        const def = ATTAQUES[c.atk.type];
        const a = c.atk;
        if (a.type === "c") {
          if (!a.lance && a.t >= def.debut) {
            a.lance = true;
            s.boules.push({
              id: s.suivant++,
              x: c.x + c.face * 34,
              y: c.y - 58,
              vx: c.face * 340,
              par: c.id,
              eq: j.equipe,
              vie: 1.6,
            });
          }
        } else if (a.t >= def.debut && a.t <= def.fin) {
          for (let k = 0; k < s.f.length; k++) {
            const q = s.f[k]!;
            if (q === c || q.ko || s.joueurs[k]!.equipe === j.equipe || a.touches.includes(q.id))
              continue;
            const dx = (q.x - c.x) * c.face;
            if (dx < -LARG / 2 || dx > def.portee + LARG / 2) continue;
            if (Math.abs(q.y - c.y) > HAUT * 0.8) continue;
            a.touches.push(q.id);
            const devant = (c.x - q.x) * q.face > 0;
            toucher(s, q, def, c.face, devant, c);
          }
        }
        if (a.t >= def.total) c.atk = null;
        c.vx *= 0.8;
      } else if (!c.garde) {
        const dir = (presse(e, BTN.droite) ? 1 : 0) - (presse(e, BTN.gauche) ? 1 : 0);
        if (sol || Math.abs(c.vx) < 1) c.vx = dir * VITESSE;
        else c.vx = borne(c.vx + dir * 600 * dt, -VITESSE, VITESSE);
        if (presse(e, BTN.haut) && sol) c.vy = -SAUT;
        if (presse(e, BTN.a)) c.atk = { type: "a", t: 0, touches: [], lance: false };
        else if (presse(e, BTN.b)) c.atk = { type: "b", t: 0, touches: [], lance: false };
        else if (presse(e, BTN.c) && c.cdSpecial <= 0) {
          c.atk = { type: "c", t: 0, touches: [], lance: false };
          c.cdSpecial = RECHARGE_SPECIAL;
        }
      } else c.vx = 0;
    }
    c.marche = Math.abs(c.vx) > 20 && sol ? c.marche + dt * 10 : 0;
    c.vy += GRAVITE * dt;
    c.x = borne(c.x + c.vx * dt, 30, L - 30);
    c.y += c.vy * dt;
    if (c.y >= SOL) {
      c.y = SOL;
      c.vy = 0;
    }
  });

  // Les combattants ne se traversent pas.
  for (let i = 0; i < s.f.length; i++)
    for (let k = i + 1; k < s.f.length; k++) {
      const a = s.f[i]!;
      const b = s.f[k]!;
      if (a.ko || b.ko || Math.abs(a.y - b.y) > HAUT * 0.7) continue;
      const d = b.x - a.x;
      if (Math.abs(d) < LARG) {
        const poussee = (LARG - Math.abs(d)) / 2;
        const sens = d >= 0 ? 1 : -1;
        a.x = borne(a.x - sens * poussee, 30, L - 30);
        b.x = borne(b.x + sens * poussee, 30, L - 30);
      }
    }

  // Boules d'énergie
  for (let k = s.boules.length - 1; k >= 0; k--) {
    const b = s.boules[k]!;
    b.x += b.vx * dt;
    b.vie -= dt;
    let fin = b.vie <= 0 || b.x < 0 || b.x > L;
    if (!fin)
      for (let i = 0; i < s.f.length; i++) {
        const q = s.f[i]!;
        if (q.ko || s.joueurs[i]!.equipe === b.eq) continue;
        if (Math.abs(q.x - b.x) < LARG / 2 + 14 && b.y > q.y - HAUT && b.y < q.y) {
          toucher(s, q, ATTAQUES.c, b.vx > 0 ? 1 : -1, (b.x - q.x) * q.face > 0);
          fin = true;
          break;
        }
      }
    if (fin) s.boules.splice(k, 1);
  }

  // Fin de manche : il ne reste qu'une équipe debout (ou plus aucune).
  const debout = equipesDe(s.joueurs).filter((e) => vivants(s, e).length > 0);
  if (debout.length <= 1) finDeManche(s, debout[0] ?? null);
}

function termine(base: EtatBase): boolean {
  const s = base as EtatCombat;
  return s.entracte <= 0 && s.manches.some((m) => m >= MANCHES_VICTOIRE);
}

function finir(base: EtatBase): Resultat {
  const s = base as EtatCombat;
  const equipes = equipesDe(s.joueurs);
  const m = [...s.manches];
  // Chrono écoulé en pleine manche : elle revient à l'équipe qui a le plus de PV.
  if (equipes.every((e) => (m[e] ?? 0) < MANCHES_VICTOIRE) && s.entracte <= 0) {
    const meilleure = meilleureEquipe(equipes, (e) => [-pvEquipe(s, e)]);
    if (meilleure !== null) m[meilleure] = (m[meilleure] ?? 0) + 1;
  }
  // Le plus de manches gagne ; à égalité, le plus de PV restants.
  const vainqueur = meilleureEquipe(equipes, (e) => [-(m[e] ?? 0), -pvEquipe(s, e)]);
  const score = equipes.map((e) => m[e] ?? 0).join(" – ");
  const lignes: LigneClassement[] = s.f
    .map((c, i) => ({ c, j: s.joueurs[i]! }))
    .sort((x, y) => {
      const gx = x.j.equipe === vainqueur ? 0 : 1;
      const gy = y.j.equipe === vainqueur ? 0 : 1;
      return gx - gy || y.c.pv - x.c.pv;
    })
    .map(({ c, j }, rg) => ({
      id: j.id,
      pseudo: j.pseudo,
      equipe: j.equipe,
      rang: rg + 1,
      texte: j.absent
        ? "a abandonné"
        : s.joueurs.filter((q) => q.equipe === j.equipe).length > 1
          ? `${Math.round(c.pv)} PV · ${nomEquipe(s.joueurs, j.equipe)}`
          : `${Math.round(c.pv)} PV`,
    }));
  return {
    vainqueur,
    titre:
      vainqueur === null
        ? `Égalité (${score})`
        : `Victoire de ${nomEquipe(s.joueurs, vainqueur)} (${score})`,
    lignes,
  };
}

/* ═════════════════════════ RENDU : le dojo ═════════════════════════ */

const MARGE = 40;
const W_DOJO = L + MARGE * 2;
function poseDe(c: Combattant): { pose: PoseChibi; progres: number } {
  if (c.ko) return { pose: "ko", progres: 0 };
  if (c.etourdi > 0) return { pose: "degat", progres: 0 };
  if (c.atk) {
    const def = ATTAQUES[c.atk.type];
    const progres = Math.min(1, c.atk.t / def.total);
    return {
      pose: c.atk.type === "a" ? "leger" : c.atk.type === "b" ? "lourd" : "special",
      progres,
    };
  }
  if (c.y < SOL - 2) return { pose: "saut", progres: 0 };
  if (c.garde) return { pose: "garde", progres: 0 };
  if (Math.abs(c.vx) > 20) return { pose: "marche", progres: 0 };
  return { pose: "idle", progres: 0 };
}

function dessinerCombattant(
  ctx: CanvasRenderingContext2D,
  s: EtatCombat,
  i: number,
  moi: string,
  fx: Effets,
): void {
  const c = s.f[i]!;
  const j = s.joueurs[i]!;
  const eq = COULEUR_EQUIPE[j.equipe];
  const mien = j.id === moi;
  const moiJ = s.joueurs.find((q) => q.id === moi);
  const allie = !mien && !!moiJ && moiJ.equipe === j.equipe;
  const haut = Math.max(0, SOL - c.y);
  // Ombre au sol : elle rétrécit et s'éclaircit quand on saute
  if (!c.ko)
    ombre(
      ctx,
      c.x,
      SOL + 5,
      Math.max(14, 44 - haut * 0.09),
      Math.max(4, 10 - haut * 0.02),
      Math.max(0.15, 0.55 - haut * 0.001),
    );
  else ombre(ctx, c.x, SOL + 5, 44, 6, 0.35);
  // Repère d'équipe au sol : moi (double), allié (pointillé), adversaire (simple)
  if (!c.ko) {
    ctx.strokeStyle = eq;
    ctx.lineWidth = mien ? 3 : 2;
    if (allie) ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.ellipse(c.x, SOL + 5, 32, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (mien) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(c.x, SOL + 5, 36, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const { pose, progres } = poseDe(c);
  if (c.garde && !c.ko) {
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(fx.horloge * 20);
    ctx.fillStyle = "#8fd3ff";
    ctx.beginPath();
    ctx.ellipse(c.x + c.face * 18, c.y - 52, 22, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Traînées d'attaque
  if (c.atk) {
    const def = ATTAQUES[c.atk.type];
    const actif = c.atk.t >= def.debut && c.atk.t <= def.fin;
    const f = c.face;
    if (c.atk.type === "a" && actif) {
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(
        c.x + f * 28,
        c.y - 66,
        30,
        f > 0 ? -0.9 : Math.PI - 0.9,
        f > 0 ? 0.9 : Math.PI + 0.9,
      );
      ctx.stroke();
    } else if (c.atk.type === "b") {
      if (c.atk.t < def.debut)
        halo(ctx, c.x - f * 6, c.y - 20, 18 + (c.atk.t / def.debut) * 18, "#ff9f43", 0.55);
      else if (actif) {
        ctx.strokeStyle = "rgba(255,150,70,0.9)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(
          c.x + f * 22,
          c.y - 34,
          62,
          f > 0 ? -0.8 : Math.PI - 0.5,
          f > 0 ? 0.5 : Math.PI + 0.8,
        );
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 3;
        ctx.stroke();
        if (Math.random() < 0.6)
          fx.particule({
            x: c.x + f * (30 + Math.random() * 50),
            y: c.y - 24 - Math.random() * 20,
            vx: f * 60,
            vy: -20,
            vie: 0.25,
            taille: 4,
            couleur: "#ffb347",
            lueur: true,
          });
      }
    } else if (c.atk.type === "c" && c.atk.t < def.debut + 0.1)
      halo(
        ctx,
        c.x + f * 30,
        c.y - 62,
        14 + (c.atk.t / def.debut) * 18,
        COULEUR_EQUIPE[j.equipe],
        0.7,
      );
  }
  if (c.atk?.type === "c" && !c.ko && j.equipe % 2 === 0) {
    const defS = ATTAQUES.c;
    const k = (c.atk.t - defS.debut + 0.1) / (defS.fin - defS.debut + 0.2);
    if (k > 0 && k < 1.3) arcLumineux(ctx, c.x + c.face * 6, c.y - 64, c.face, k);
  }
  dessinerCombattantPixel(ctx, {
    x: c.x,
    y: c.y,
    face: c.face > 0 ? 1 : -1,
    genre: (j.equipe % 2) as 0 | 1,
    pose: pose as PoseCombat,
    progres,
    marche: c.marche,
    temps: fx.horloge,
    neon: j.equipe % 2 === 0 ? "#19e6ff" : eq,
    blanc: c.flash > 0 && !c.ko,
  });
  // Nom, repère de joueur et d'allié
  if (!c.ko) {
    const ty = c.y - 152;
    texte(ctx, (allie ? "♦ " : "") + j.pseudo.slice(0, 9), c.x, ty, 12, mien ? "#ffd166" : eq);
    if (mien) {
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.moveTo(c.x, ty - 8 + Math.sin(fx.horloge * 6) * 2);
      ctx.lineTo(c.x - 6, ty - 16 + Math.sin(fx.horloge * 6) * 2);
      ctx.lineTo(c.x + 6, ty - 16 + Math.sin(fx.horloge * 6) * 2);
      ctx.fill();
    } else if (allie) texte(ctx, "ALLIÉ", c.x, SOL + 20, 9, "#6ee7a0");
  }
}

function evenements(s: EtatCombat, fx: Effets): void {
  for (const e of fx.nouveaux(s.ev)) {
    switch (e.k) {
      case "impact": {
        const fort = (e.v ?? 0) >= 12;
        fx.gerbe(e.x, e.y, fort ? 16 : 9, {
          couleur: ["#ffffff", "#ffd166", "#ff6b6b"],
          vitesse: fort ? 260 : 170,
          vie: 0.35,
          taille: fort ? 5 : 3,
          lueur: true,
          frein: 3,
        });
        fx.onde(e.x, e.y, fort ? 46 : 28, "#ffffff", 0.22);
        fx.popup(
          e.x,
          e.y - 30,
          `-${Math.round(e.v ?? 0)}`,
          fort ? "#ff6b6b" : "#ffd166",
          fort ? 18 : 13,
        );
        if (fort) fx.secouer((e.v ?? 0) >= 14 ? 7 : 5);
        else fx.secouer(1.5);
        fx.excitation = Math.min(1, fx.excitation + (fort ? 0.45 : 0.2));
        break;
      }
      case "parade":
        fx.gerbe(e.x, e.y, 10, {
          couleur: ["#8fd3ff", "#ffffff"],
          vitesse: 200,
          vie: 0.3,
          lueur: true,
          frein: 3,
        });
        fx.onde(e.x, e.y, 30, "#8fd3ff", 0.25);
        fx.popup(e.x, e.y - 34, "PARÉ !", "#8fd3ff", 15);
        fx.secouer(1.5);
        fx.excitation = Math.min(1, fx.excitation + 0.15);
        break;
      case "ko":
        fx.popup(e.x, e.y - 40, "KO !", "#ff5d5d", 44);
        fx.gerbe(e.x, e.y, 26, {
          couleur: ["#ffffff", "#ffd166", "#ff6b6b"],
          vitesse: 300,
          vie: 0.8,
          taille: 5,
          lueur: true,
          grav: 300,
          frein: 1,
        });
        fx.onde(e.x, e.y, 130, "#ffffff", 0.5);
        fx.secouer(10);
        fx.flash = 0.7;
        fx.excitation = 1;
        break;
      default:
        break;
    }
  }
}

function dessiner(ctx: CanvasRenderingContext2D, base: EtatBase, moi: string, fx: Effets): void {
  const s = base as EtatCombat;
  evenements(s, fx);
  const xmoy = s.f.reduce((t, c) => t + c.x, 0) / Math.max(1, s.f.length);
  const decal = -(xmoy - L / 2) * 0.04;

  fx.debut(ctx);
  const dessinerFond = (c: CanvasRenderingContext2D) => {
    c.translate(MARGE, 0);
    dessinerDojo(c);
  };
  if (!decorEnCache("dojo-neon-v2", W_DOJO, H, dessinerFond, ctx, -MARGE + decal, 0)) {
    ctx.save();
    ctx.translate(-MARGE + decal, 0);
    dessinerFond(ctx);
    ctx.restore();
  }
  // Lanternes : halo qui vacille
  LANTERNES_DOJO.forEach((l, i) =>
    halo(
      ctx,
      l.x + decal,
      l.y,
      (70 + Math.sin(fx.horloge * 7 + i * 2) * 5) * l.t,
      "#ff9f43",
      0.3 + Math.sin(fx.horloge * 11 + i) * 0.04,
    ),
  );
  ctx.save();
  ctx.translate(decal * 1.2, 0);
  dessinerSpectateursDojo(ctx, fx.horloge, fx.excitation, !!fx.lent);
  ctx.restore();

  // Les combattants K.O. d'abord (au sol), puis les autres
  const ordre = s.f.map((_, i) => i).sort((a, b) => Number(s.f[b]!.ko) - Number(s.f[a]!.ko));
  for (const i of ordre) dessinerCombattant(ctx, s, i, moi, fx);

  // Boules d'énergie
  for (const b of s.boules) {
    const col = COULEUR_EQUIPE[b.eq];
    halo(ctx, b.x, b.y, 34, col, 0.75);
    r(ctx, b.x - 9, b.y - 9, 18, 18, col);
    r(ctx, b.x - 6, b.y - 6, 12, 12, "#ffffff");
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 14 + Math.sin(fx.horloge * 20) * 2, 0, Math.PI * 2);
    ctx.stroke();
    if (Math.random() < 0.8)
      fx.particule({
        x: b.x - Math.sign(b.vx) * 14,
        y: b.y + (Math.random() - 0.5) * 12,
        vx: -Math.sign(b.vx) * 50,
        vy: (Math.random() - 0.5) * 30,
        vie: 0.3,
        taille: 5,
        couleur: col,
        lueur: true,
      });
  }
  fx.dessinerOndes(ctx);
  fx.dessinerParticules(ctx);
  fx.dessinerPopups(ctx);
  fx.fin(ctx);
  fx.dessinerFlash(ctx, L, H);

  // HUD arcade : portraits encadrés, barres de vie dégradées, jauge spéciale cyan, chrono hexagonal.
  const rangs = { gauche: 0, droite: 0 };
  s.f.forEach((c, i) => {
    const j = s.joueurs[i]!;
    const gauche = j.equipe % 2 === 0;
    const k = gauche ? rangs.gauche++ : rangs.droite++;
    const traine = fx.suivi(j.id, c.pv);
    if (k === 0) {
      faceCombat(
        ctx,
        {
          nom: j.pseudo,
          pv: c.pv / PV_MAX,
          traine: traine / PV_MAX,
          special: 1 - c.cdSpecial / RECHARGE_SPECIAL,
          specialPret: c.cdSpecial <= 0,
          manchesGagnees: Math.min(MANCHES_VICTOIRE, s.manches[j.equipe] ?? 0),
          manchesTotal: MANCHES_VICTOIRE,
          portrait: (cx, x, y, w, h) =>
            dessinerChibi(cx, {
              x: x + w / 2,
              y: y + h + 38,
              ech: 3,
              a: apparenceDe(j),
              dir: gauche ? "droite" : "gauche",
            }),
        },
        gauche,
        L,
        `${j.id === moi ? "▶ " : ""}${j.pseudo.slice(0, 14).toUpperCase()}`,
      );
    } else {
      // Coéquipier (2v2) : petite barre sous le chrono de son côté.
      const w = 150;
      const x = gauche ? 58 : L - 58 - w;
      const y = 66 + (k - 1) * 14;
      r(ctx, x - 1, y - 1, w + 2, 9, "#12082a");
      r(ctx, gauche ? x : x + w * (1 - c.pv / PV_MAX), y, w * (c.pv / PV_MAX), 7, ROSE_BARRE);
      texte(ctx, j.pseudo.slice(0, 10).toUpperCase(), gauche ? x + w + 6 : x - 6, y + 4, 8, "#ffd2ee", gauche ? "left" : "right");
    }
  });
  const restant = Math.max(0, s.duree - s.t);
  chronoHexagone(
    ctx,
    L / 2,
    30,
    String(Math.ceil(restant)),
    s.phase === "jeu" && restant <= 10 && Math.floor(s.t * 3) % 2 === 0,
  );
  texte(ctx, `MANCHE ${Math.min(s.manche, 3)}`, L / 2, 66, 10, "#cfe9ff");
  if (s.entracte > 0 && s.annonce) {
    r(ctx, 0, H / 2 - 50, L, 100, "rgba(0,0,0,0.55)");
    texte(ctx, s.annonce, L / 2, H / 2, 40, "#ffd166");
  }
  dessinerHud(ctx, s, L, H, false);
}

export const combat: Jeu = {
  id: "combat",
  nom: "Combat 2D",
  icone: "🥊",
  description:
    "Combat façon Street Fighter : poings, pieds, garde, boule d'énergie. Meilleur des 3 manches.",
  aide: [
    "Q D / ← → : avancer, reculer",
    "Z / ↑ : sauter · S / ↓ : garde",
    "Espace : poing · K : pied · L : spécial",
  ],
  boutons: { a: "Poing", b: "Pied", c: "Spécial", haut: "Saut", bas: "Garde" },
  largeur: L,
  hauteur: H,
  creer,
  pas,
  termine,
  finir,
  dessiner,
};
