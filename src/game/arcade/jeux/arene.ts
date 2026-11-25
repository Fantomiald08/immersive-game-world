import { nuance } from "../../carte/couleur";
import type { Direction } from "../../apparence";
import type { Effets } from "../fx";
import { aleatoire, borne, dessinerHud, emettre, meilleureEquipe } from "../moteur";
import {
  apparenceDe,
  bloc,
  decorEnCache,
  dessinerChibi,
  halo,
  hash,
  ombre,
  OL,
  panneau,
  r,
  texte,
} from "../rendu/pixel";
import {
  angleVise,
  BTN,
  COULEUR_EQUIPE,
  DUREE_COMPTE,
  DUREE_PARTIE,
  equipesDe,
  nomEquipe,
  presse,
  type Equipe,
  type EtatBase,
  type Jeu,
  type JoueurPartie,
  type LigneClassement,
  type Resultat,
} from "../types";

/**
 * Mini-jeu : arène multi-rounds à armes, vue du dessus (3/4) comme le monde d'ISITECH WORLD.
 * 3 rounds de 40 s dans 3 arènes (Labo / serveurs, Vénus néon, Hangar urbain). Armes qui apparaissent
 * sur des points fixes avec un télégraphe, attaque de base permanente, tir allié désactivé.
 */

/** Munitions illimitées : une vraie valeur, car l'infini ne passe pas dans le JSON du réseau. */
const ILLIMITE = 1e9;
export const L = 800;
export const H = 480;
export const RAYON = 12;
const VITESSE = 150;
const PV_MAX = 100;
const NB_ROUNDS = 3;
const DUREE_ROUND = DUREE_PARTIE / NB_ROUNDS;
const ENTRACTE = 2.5;
const RESPAWN = 2.5;
const INVUL = 1.5;
const MAX_OBJETS = 5;
const TELEGRAPHE = 1.3;
const DASH_DUREE = 0.15;
const DASH_VITESSE = 430;
const DASH_RECHARGE = 2;
const HAUTEUR_MUR = 16;
const RAYON_EXPLOSION = 74;

export type Arme = "poing" | "pistolet" | "mitraillette" | "pompe" | "sniper" | "roquette";
type Rect = { x: number; y: number; w: number; h: number };

type DefArme = {
  nom: string;
  cd: number;
  degats: number;
  vitesse: number;
  vie: number;
  munitions: number;
  tirs: number;
  dispersion: number;
  couleur: string;
  /** Recul subi par le tireur (px/s). */
  recul: number;
  explosive: boolean;
};
export const ARMES: Record<Arme, DefArme> = {
  poing: {
    nom: "Poings",
    cd: 0.45,
    degats: 20,
    vitesse: 0,
    vie: 0,
    munitions: ILLIMITE,
    tirs: 1,
    dispersion: 0,
    couleur: "#dddddd",
    recul: 0,
    explosive: false,
  },
  pistolet: {
    nom: "Pistolet",
    cd: 0.33,
    degats: 22,
    vitesse: 520,
    vie: 0.9,
    munitions: 16,
    tirs: 1,
    dispersion: 0.03,
    couleur: "#ffd166",
    recul: 40,
    explosive: false,
  },
  mitraillette: {
    nom: "Blaster rapide",
    cd: 0.09,
    degats: 9,
    vitesse: 560,
    vie: 0.7,
    munitions: 40,
    tirs: 1,
    dispersion: 0.1,
    couleur: "#4fd1c5",
    recul: 18,
    explosive: false,
  },
  pompe: {
    nom: "Fusil à dispersion",
    cd: 0.85,
    degats: 11,
    vitesse: 480,
    vie: 0.45,
    munitions: 7,
    tirs: 5,
    dispersion: 0.34,
    couleur: "#ff8c42",
    recul: 170,
    explosive: false,
  },
  sniper: {
    nom: "Sniper",
    cd: 1.3,
    degats: 70,
    vitesse: 1100,
    vie: 1.2,
    munitions: 5,
    tirs: 1,
    dispersion: 0,
    couleur: "#c084fc",
    recul: 120,
    explosive: false,
  },
  roquette: {
    nom: "Lance-impulsion",
    cd: 1.5,
    degats: 30,
    vitesse: 300,
    vie: 1.8,
    munitions: 3,
    tirs: 1,
    dispersion: 0.02,
    couleur: "#ff5d73",
    recul: 210,
    explosive: true,
  },
};
export const PORTEE_POING = 26 + RAYON;

export type Theme = "labo" | "venus" | "hangar";
export type Arene = {
  nom: string;
  theme: Theme;
  murs: Rect[];
  spawns: Array<{ x: number; y: number }>;
};
export const ARENES: Arene[] = [
  {
    nom: "Laboratoire · Salle des serveurs",
    theme: "labo",
    murs: [
      { x: 150, y: 60, w: 30, h: 160 },
      { x: 150, y: 260, w: 30, h: 160 },
      { x: 620, y: 60, w: 30, h: 160 },
      { x: 620, y: 260, w: 30, h: 160 },
      { x: 300, y: 228, w: 200, h: 24 },
    ],
    spawns: [
      { x: 100, y: 240 },
      { x: 700, y: 240 },
      { x: 400, y: 120 },
      { x: 400, y: 380 },
      { x: 250, y: 160 },
      { x: 550, y: 330 },
    ],
  },
  {
    nom: "Arène Vénus néon",
    theme: "venus",
    murs: [
      { x: 170, y: 110, w: 36, h: 36 },
      { x: 594, y: 110, w: 36, h: 36 },
      { x: 170, y: 334, w: 36, h: 36 },
      { x: 594, y: 334, w: 36, h: 36 },
      { x: 382, y: 150, w: 36, h: 36 },
      { x: 382, y: 294, w: 36, h: 36 },
    ],
    spawns: [
      { x: 400, y: 240 },
      { x: 260, y: 240 },
      { x: 540, y: 240 },
      { x: 300, y: 70 },
      { x: 500, y: 410 },
      { x: 110, y: 240 },
    ],
  },
  {
    nom: "Bastion · Hangar urbain",
    theme: "hangar",
    murs: [
      { x: 110, y: 70, w: 90, h: 40 },
      { x: 600, y: 70, w: 90, h: 40 },
      { x: 110, y: 370, w: 90, h: 40 },
      { x: 600, y: 370, w: 90, h: 40 },
      { x: 330, y: 190, w: 140, h: 100 },
    ],
    spawns: [
      { x: 400, y: 100 },
      { x: 400, y: 390 },
      { x: 220, y: 240 },
      { x: 580, y: 240 },
      { x: 270, y: 150 },
      { x: 540, y: 340 },
    ],
  },
];

export type PersoArene = {
  id: string;
  x: number;
  y: number;
  /** Direction regardée (vecteur unitaire). */
  fx: number;
  fy: number;
  pv: number;
  arme: Arme;
  munitions: number;
  recharge: number;
  kills: number;
  morts: number;
  /** > 0 : le joueur est éliminé et reviendra dans ce temps. */
  respawn: number;
  invul: number;
  dash: number;
  dashT: number;
  /** Éclair de dégâts (dessin). */
  touche: number;
  /** Vitesse de poussée (recul, explosions). */
  kx: number;
  ky: number;
  /** Phase de marche (animation) et indicateur de mouvement. */
  marche: number;
  mv: number;
  /** Éclair de tir (dessin). */
  tir: number;
};
export type Balle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  par: string;
  eq: Equipe;
  degats: number;
  vie: number;
  couleur: string;
  explosive: boolean;
};
export type Ramassable = {
  id: number;
  x: number;
  y: number;
  type: Arme | "soin";
  /** > 0 : l'objet est en cours d'apparition (télégraphe) et ne peut pas encore être pris. */
  delai?: number;
};

export type EtatArene = EtatBase & {
  p: PersoArene[];
  balles: Balle[];
  objets: Ramassable[];
  manche: number;
  /** > 0 : pause entre deux rounds. */
  entracte: number;
  prochainObjet: number;
  suivant: number;
  graine: number;
};

const equipeDe = (s: EtatArene, id: string): Equipe =>
  s.joueurs.find((j) => j.id === id)?.equipe ?? 0;

/** Où réapparaît un joueur : gauche (équipe 0), droite (1), haut (2) ou bas (3) de l'arène. */
function pointDepart(s: EtatArene, i: number): { x: number; y: number } {
  const j = s.joueurs[i]!;
  const rang = s.joueurs.slice(0, i).filter((q) => q.equipe === j.equipe).length;
  const ys = [140, 340, 240, 90];
  const xs = [L / 2 - 90, L / 2 + 90, L / 2, L / 2 - 180];
  switch (j.equipe) {
    case 0:
      return { x: 60, y: ys[rang % ys.length]! };
    case 1:
      return { x: L - 60, y: ys[rang % ys.length]! };
    case 2:
      return { x: xs[rang % xs.length]!, y: 50 };
    default:
      return { x: xs[rang % xs.length]!, y: H - 50 };
  }
}

function nouveauPerso(s: EtatArene, i: number): PersoArene {
  const { x, y } = pointDepart(s, i);
  const d = Math.hypot(L / 2 - x, H / 2 - y) || 1;
  return {
    id: s.joueurs[i]!.id,
    x,
    y,
    fx: (L / 2 - x) / d,
    fy: (H / 2 - y) / d,
    pv: PV_MAX,
    arme: "poing",
    munitions: ILLIMITE,
    recharge: 0,
    kills: 0,
    morts: 0,
    respawn: 0,
    invul: INVUL,
    dash: 0,
    dashT: 0,
    touche: 0,
    kx: 0,
    ky: 0,
    marche: 0,
    mv: 0,
    tir: 0,
  };
}

function tirerType(rnd: () => number): Arme | "soin" {
  const r0 = rnd();
  if (r0 < 0.22) return "pistolet";
  if (r0 < 0.44) return "mitraillette";
  if (r0 < 0.62) return "pompe";
  if (r0 < 0.76) return "roquette";
  if (r0 < 0.86) return "sniper";
  return "soin";
}

/** Fait apparaître un objet sur un point de spawn libre ; il reste « en télégraphe » un instant. */
function faireApparaitre(s: EtatArene, rnd: () => number): void {
  const arene = ARENES[s.manche]!;
  const libres = arene.spawns.filter(
    (sp) => !s.objets.some((o) => Math.hypot(o.x - sp.x, o.y - sp.y) < 30),
  );
  if (!libres.length) return;
  const sp = libres[Math.floor(rnd() * libres.length)]!;
  const type = tirerType(rnd);
  s.objets.push({ id: s.suivant++, x: sp.x, y: sp.y, type, delai: TELEGRAPHE });
}

/** Début d'un round : on remet tout le monde à neuf, dans la nouvelle arène. */
function lancerRound(s: EtatArene, rnd: () => number, manche: number): void {
  s.manche = manche;
  s.entracte = manche === 0 ? 0 : ENTRACTE;
  s.balles = [];
  s.objets = [];
  s.prochainObjet = 2;
  for (let i = 0; i < s.joueurs.length; i++) {
    const ancien = s.p[i];
    const n = nouveauPerso(s, i);
    if (ancien) {
      n.kills = ancien.kills;
      n.morts = ancien.morts;
    }
    s.p[i] = n;
    emettre(s, {
      k: "respawn",
      x: n.x,
      y: n.y,
      c: COULEUR_EQUIPE[s.joueurs[i]!.equipe],
      qui: n.id,
    });
  }
  for (let i = 0; i < 3; i++) faireApparaitre(s, rnd);
}

/** Pousse un cercle hors des murs et des bords de l'arène. */
function resoudre(arene: Arene, p: { x: number; y: number }): void {
  p.x = borne(p.x, RAYON + 8, L - RAYON - 8);
  p.y = borne(p.y, RAYON + 8, H - RAYON - 8);
  for (const m of arene.murs) {
    const cx = borne(p.x, m.x, m.x + m.w);
    const cy = borne(p.y, m.y, m.y + m.h);
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= RAYON * RAYON) continue;
    if (d2 === 0) {
      const g = p.x - m.x;
      const dr = m.x + m.w - p.x;
      const hh = p.y - m.y;
      const b = m.y + m.h - p.y;
      const mn = Math.min(g, dr, hh, b);
      if (mn === g) p.x = m.x - RAYON;
      else if (mn === dr) p.x = m.x + m.w + RAYON;
      else if (mn === hh) p.y = m.y - RAYON;
      else p.y = m.y + m.h + RAYON;
    } else {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * RAYON;
      p.y = cy + (dy / d) * RAYON;
    }
  }
}

function creer(joueurs: JoueurPartie[], graine: number): EtatArene {
  const s: EtatArene = {
    phase: "compte",
    compte: DUREE_COMPTE,
    t: 0,
    duree: DUREE_PARTIE,
    joueurs: joueurs.map((j) => ({ ...j })),
    resultat: null,
    ev: [],
    evN: 0,
    p: [],
    balles: [],
    objets: [],
    manche: 0,
    entracte: 0,
    prochainObjet: 2,
    suivant: 1,
    graine,
  };
  lancerRound(s, aleatoire(graine), 0);
  return s;
}

/** Dégâts à un joueur, avec recul. Renvoie vrai s'il a été éliminé. */
function infliger(
  s: EtatArene,
  cible: PersoArene,
  tireur: string,
  degats: number,
  dirx: number,
  diry: number,
  recul: number,
): boolean {
  if (cible.respawn > 0 || cible.invul > 0) return false;
  cible.pv -= degats;
  cible.touche = 0.15;
  cible.kx += dirx * recul;
  cible.ky += diry * recul;
  emettre(s, { k: "impact", x: cible.x, y: cible.y, v: degats, c: "#ff6b6b" });
  if (cible.pv > 0) return false;
  cible.pv = 0;
  cible.morts += 1;
  cible.respawn = RESPAWN;
  const k = s.p.find((q) => q.id === tireur);
  const couleur = COULEUR_EQUIPE[equipeDe(s, tireur)];
  if (k && k.id !== cible.id) k.kills += 1;
  emettre(s, { k: "kill", x: cible.x, y: cible.y, c: couleur, qui: tireur });
  return true;
}

/** Explosion du lance-impulsion : dégâts décroissants et forte poussée (les alliés sont poussés mais jamais blessés). */
function exploser(
  s: EtatArene,
  x: number,
  y: number,
  tireur: string,
  eq: Equipe,
  degatsMax: number,
): void {
  emettre(s, { k: "explosion", x, y, v: degatsMax });
  s.p.forEach((q, i) => {
    if (q.respawn > 0) return;
    const d = Math.hypot(q.x - x, q.y - y);
    if (d > RAYON_EXPLOSION) return;
    const f = 1 - d / RAYON_EXPLOSION;
    const nx = d > 0.001 ? (q.x - x) / d : 0;
    const ny = d > 0.001 ? (q.y - y) / d : -1;
    if (s.joueurs[i]!.equipe === eq) {
      q.kx += nx * 330 * f;
      q.ky += ny * 330 * f;
    } else infliger(s, q, tireur, Math.round(12 + degatsMax * f), nx, ny, 120 + 360 * f);
  });
}

function tirer(s: EtatArene, i: number, rnd: () => number): void {
  const p = s.p[i]!;
  const def = ARMES[p.arme];
  p.recharge = def.cd;
  p.tir = 0.09;
  const eq = s.joueurs[i]!.equipe;
  if (p.arme === "poing") {
    // Coup de poing : touche le premier adversaire devant soi.
    for (const q of s.p) {
      if (q.id === p.id || q.respawn > 0 || equipeDe(s, q.id) === eq) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > PORTEE_POING + RAYON || d === 0) continue;
      if ((dx * p.fx + dy * p.fy) / d < 0.3) continue;
      infliger(s, q, p.id, def.degats, dx / d, dy / d, 160);
      break;
    }
    return;
  }
  const angle = Math.atan2(p.fy, p.fx);
  for (let k = 0; k < def.tirs; k++) {
    const a = angle + (rnd() - 0.5) * 2 * def.dispersion;
    s.balles.push({
      id: s.suivant++,
      x: p.x + p.fx * (RAYON + 4),
      y: p.y + p.fy * (RAYON + 4),
      vx: Math.cos(a) * def.vitesse,
      vy: Math.sin(a) * def.vitesse,
      par: p.id,
      eq,
      degats: def.degats,
      vie: def.vie,
      couleur: def.couleur,
      explosive: def.explosive,
    });
  }
  p.kx -= p.fx * def.recul;
  p.ky -= p.fy * def.recul;
  emettre(s, { k: "tir", x: p.x + p.fx * 22, y: p.y + p.fy * 22, v: angle, c: def.couleur });
  p.munitions -= 1;
  if (p.munitions <= 0) {
    p.arme = "poing";
    p.munitions = ILLIMITE;
  }
}

function pas(base: EtatBase, entrees: Readonly<Record<string, number>>, dt: number): void {
  const s = base as EtatArene;
  const rnd = aleatoire(s.graine + Math.floor(s.t * 60) * 7919);
  const arene = ARENES[s.manche]!;

  // Changement de round : toutes les 40 s, nouvelle arène.
  const rondeAttendue = Math.min(NB_ROUNDS - 1, Math.floor(s.t / DUREE_ROUND));
  if (rondeAttendue !== s.manche) lancerRound(s, rnd, rondeAttendue);

  if (s.entracte > 0) {
    s.entracte = Math.max(0, s.entracte - dt);
    return;
  }

  for (let i = 0; i < s.p.length; i++) {
    const p = s.p[i]!;
    p.recharge = Math.max(0, p.recharge - dt);
    p.invul = Math.max(0, p.invul - dt);
    p.dash = Math.max(0, p.dash - dt);
    p.touche = Math.max(0, p.touche - dt);
    p.tir = Math.max(0, p.tir - dt);
    if (p.respawn > 0) {
      p.respawn -= dt;
      if (p.respawn <= 0) {
        const n = nouveauPerso(s, i);
        n.kills = p.kills;
        n.morts = p.morts;
        s.p[i] = n;
        emettre(s, {
          k: "respawn",
          x: n.x,
          y: n.y,
          c: COULEUR_EQUIPE[s.joueurs[i]!.equipe],
          qui: n.id,
        });
      }
      continue;
    }
    const e = s.joueurs[i]!.absent ? 0 : (entrees[p.id] ?? 0);
    let dx = (presse(e, BTN.droite) ? 1 : 0) - (presse(e, BTN.gauche) ? 1 : 0);
    let dy = (presse(e, BTN.bas) ? 1 : 0) - (presse(e, BTN.haut) ? 1 : 0);
    const n = Math.hypot(dx, dy);
    if (n > 0) {
      dx /= n;
      dy /= n;
      p.fx = dx;
      p.fy = dy;
    }
    // Visée précise (ordinateurs seulement) : elle remplace la direction regardée.
    if (presse(e, BTN.visee)) {
      const ang = angleVise(e);
      p.fx = Math.cos(ang);
      p.fy = Math.sin(ang);
    }
    if (presse(e, BTN.b) && p.dash <= 0) {
      p.dash = DASH_RECHARGE;
      p.dashT = DASH_DUREE;
    }
    let vx = dx * VITESSE;
    let vy = dy * VITESSE;
    if (p.dashT > 0) {
      p.dashT -= dt;
      vx = p.fx * DASH_VITESSE;
      vy = p.fy * DASH_VITESSE;
    }
    // Poussée (recul des armes, explosions) : elle s'ajoute au mouvement puis s'amortit vite.
    vx += p.kx;
    vy += p.ky;
    const amort = Math.exp(-8 * dt);
    p.kx *= amort;
    p.ky *= amort;
    p.mv = n > 0 || p.dashT > 0 ? 1 : 0;
    if (p.mv) p.marche += dt * 9;
    p.x += vx * dt;
    p.y += vy * dt;
    resoudre(arene, p);
    if (presse(e, BTN.a) && p.recharge <= 0) tirer(s, i, rnd);

    for (let k = s.objets.length - 1; k >= 0; k--) {
      const o = s.objets[k]!;
      if ((o.delai ?? 0) > 0) continue;
      if (Math.hypot(o.x - p.x, o.y - p.y) > RAYON + 10) continue;
      if (o.type === "soin") {
        if (p.pv >= PV_MAX) continue;
        p.pv = Math.min(PV_MAX, p.pv + 40);
      } else {
        p.arme = o.type;
        p.munitions = ARMES[o.type].munitions;
      }
      s.objets.splice(k, 1);
    }
  }

  // Objets : fin du télégraphe
  for (const o of s.objets)
    if ((o.delai ?? 0) > 0) {
      o.delai = Math.max(0, (o.delai ?? 0) - dt);
      if (o.delai === 0)
        emettre(s, {
          k: "spawn",
          x: o.x,
          y: o.y,
          c: o.type === "soin" ? "#6ee7a0" : ARMES[o.type].couleur,
        });
    }

  // Balles : déplacement en 2 sous-pas pour ne rien traverser.
  for (let k = s.balles.length - 1; k >= 0; k--) {
    const b = s.balles[k]!;
    let mort = false;
    for (let sp = 0; sp < 2 && !mort; sp++) {
      b.x += (b.vx * dt) / 2;
      b.y += (b.vy * dt) / 2;
      if (b.x < 0 || b.x > L || b.y < 0 || b.y > H) mort = true;
      else if (arene.murs.some((m) => b.x > m.x && b.x < m.x + m.w && b.y > m.y && b.y < m.y + m.h))
        mort = true;
      else
        for (let i = 0; i < s.p.length; i++) {
          const q = s.p[i]!;
          if (q.respawn > 0 || q.id === b.par || s.joueurs[i]!.equipe === b.eq) continue;
          if (Math.hypot(q.x - b.x, q.y - b.y) <= RAYON + 2) {
            if (!b.explosive) {
              const v = Math.hypot(b.vx, b.vy) || 1;
              infliger(s, q, b.par, b.degats, b.vx / v, b.vy / v, 90);
            }
            mort = true;
            break;
          }
        }
    }
    b.vie -= dt;
    if (mort || b.vie <= 0) {
      if (b.explosive) exploser(s, b.x, b.y, b.par, b.eq, b.degats + 12);
      s.balles.splice(k, 1);
    }
  }

  s.prochainObjet -= dt;
  if (s.prochainObjet <= 0) {
    s.prochainObjet = 3.2;
    if (s.objets.length < MAX_OBJETS) faireApparaitre(s, rnd);
  }
}

function scoreEquipe(s: EtatArene, e: Equipe) {
  let kills = 0;
  let morts = 0;
  s.p.forEach((p, i) => {
    if (s.joueurs[i]!.equipe === e) {
      kills += p.kills;
      morts += p.morts;
    }
  });
  return { kills, morts };
}

function finir(base: EtatBase): Resultat {
  const s = base as EtatArene;
  const equipes = equipesDe(s.joueurs);
  const scores = equipes.map((e) => scoreEquipe(s, e));
  // Le plus de kills gagne ; à égalité, le moins de morts.
  const vainqueur = meilleureEquipe(equipes, (e) => {
    const sc = scoreEquipe(s, e);
    return [-sc.kills, sc.morts];
  });
  const total = scores.map((x) => x.kills).join(" – ");
  const lignes: LigneClassement[] = s.p
    .map((p, i) => ({ p, j: s.joueurs[i]! }))
    .sort((x, y) => y.p.kills - x.p.kills || x.p.morts - y.p.morts)
    .map(({ p, j }, rang) => ({
      id: j.id,
      pseudo: j.pseudo,
      equipe: j.equipe,
      rang: rang + 1,
      texte: `${p.kills} kill${p.kills > 1 ? "s" : ""} · ${p.morts} mort${p.morts > 1 ? "s" : ""}`,
    }));
  const titre =
    vainqueur === null
      ? `Égalité (${total})`
      : `Victoire de ${nomEquipe(s.joueurs, vainqueur)} (${total})`;
  return { vainqueur, titre, lignes };
}

/* ═════════════════════════ RENDU ═════════════════════════ */

const dirDe = (fx: number, fy: number): Direction =>
  Math.abs(fx) > Math.abs(fy) ? (fx > 0 ? "droite" : "gauche") : fy > 0 ? "bas" : "haut";

/** Sol et cadre de chaque arène : dessinés une seule fois dans un canvas en cache. */
function dessinerFond(ctx: CanvasRenderingContext2D, arene: Arene): void {
  const th = arene.theme;
  const base = th === "labo" ? "#1b2335" : th === "venus" ? "#110b1f" : "#37373d";
  r(ctx, 0, 0, L, H, base);
  for (let x = 0; x < L; x += 40)
    for (let y = 0; y < H; y += 40) {
      const k = hash(x * 3 + y * 7 + (th === "labo" ? 1 : th === "venus" ? 2 : 3));
      if (th === "labo") {
        r(ctx, x, y, 40, 40, ((x + y) / 40) % 2 === 0 ? "#222c41" : "#1d2639");
        r(ctx, x, y, 40, 1, "#121826");
        r(ctx, x, y, 1, 40, "#121826");
        for (const [bx, by] of [
          [3, 3],
          [35, 3],
          [3, 35],
          [35, 35],
        ] as const)
          r(ctx, x + bx, y + by, 2, 2, "#3a4764");
        if (k > 0.86) r(ctx, x + 8, y + 17, 24, 6, "#161d2e"); // trappe d'accès
      } else if (th === "venus") {
        r(ctx, x, y, 40, 40, k > 0.5 ? "#150d26" : "#120a22");
        if (k > 0.9) r(ctx, x + 10, y + 10, 20, 20, "#1a1030");
      } else {
        r(ctx, x, y, 40, 40, k > 0.5 ? "#3c3c43" : "#35353b");
        for (let i = 0; i < 5; i++)
          r(ctx, x + hash(x + y + i) * 36, y + hash(x * 2 + y + i * 5) * 36, 2, 2, "#2a2a30");
        r(ctx, x, y + 39, 40, 1, "#2d2d33");
        r(ctx, x + 39, y, 1, 40, "#2d2d33");
      }
    }
  if (th === "labo") {
    // Câbles au sol et bandes de danger
    for (const [cy, col] of [
      [180, "#2e4d7a"],
      [300, "#6b2e55"],
    ] as const) {
      r(ctx, 40, cy, L - 80, 4, "#0f1522");
      r(ctx, 40, cy + 1, L - 80, 2, col);
    }
    for (let x = 0; x < L; x += 16) {
      r(ctx, x, 8, 8, 6, "#d9a521");
      r(ctx, x + 8, 8, 8, 6, "#1b1b1b");
      r(ctx, x, H - 14, 8, 6, "#d9a521");
      r(ctx, x + 8, H - 14, 8, 6, "#1b1b1b");
    }
  } else if (th === "venus") {
    for (let x = 0; x <= L; x += 80) r(ctx, x, 0, 2, H, "rgba(255,60,200,0.35)");
    for (let y = 0; y <= H; y += 80) r(ctx, 0, y, L, 2, "rgba(60,220,255,0.3)");
    ctx.strokeStyle = "rgba(255,60,200,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(L / 2, H / 2, 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(60,220,255,0.5)";
    ctx.beginPath();
    ctx.arc(L / 2, H / 2, 60, 0, Math.PI * 2);
    ctx.stroke();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(255,255,255,0.08)");
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,255,255,0.05)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, H);
  } else {
    for (const [x, y, w, h] of [
      [30, 30, L - 60, H - 60],
      [220, 130, L - 440, H - 260],
    ] as const) {
      ctx.strokeStyle = "#d9a521";
      ctx.lineWidth = 3;
      ctx.setLineDash([22, 14]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
    for (const [x, y] of [
      [90, 210],
      [690, 290],
      [250, 400],
      [560, 60],
    ] as const) {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(x, y, 26, 14, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [x, y] of [
      [60, 430],
      [740, 40],
    ] as const) {
      r(ctx, x - 14, y - 14, 28, 28, "#26262b");
      for (let i = 0; i < 4; i++) r(ctx, x - 12 + i * 7, y - 12, 3, 24, "#3d3d44");
    }
  }
  // Cadre de l'arène : mur bas avec liseré néon
  const neon = th === "labo" ? "#4fd1c5" : th === "venus" ? "#ff3ec8" : "#ffb02e";
  r(ctx, 0, 0, L, 8, "#0c0e16");
  r(ctx, 0, H - 8, L, 8, "#0c0e16");
  r(ctx, 0, 0, 8, H, "#0c0e16");
  r(ctx, L - 8, 0, 8, H, "#0c0e16");
  r(ctx, 8, 8, L - 16, 2, neon);
  r(ctx, 8, H - 10, L - 16, 2, neon);
  r(ctx, 8, 8, 2, H - 16, neon);
  r(ctx, L - 10, 8, 2, H - 16, neon);
}

const COUL_CONTENEUR = ["#a8402f", "#2f5f8f", "#c79a2b", "#3f7a4a"];

/** Un obstacle avec relief : ombre, face avant, dessus. Le style dépend du thème. */
function dessinerMur(
  ctx: CanvasRenderingContext2D,
  m: Rect,
  theme: Theme,
  idx: number,
  t: number,
): void {
  const hh = HAUTEUR_MUR;
  const { x, y, w, h } = m;
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.fillRect(x + 6, y + h - 2, w, 10);
  ctx.fillRect(x + w, y - hh + 8, 8, h + hh - 2);
  if (theme === "labo") {
    r(ctx, x, y + h - hh, w, hh, "#0e1422");
    r(ctx, x, y - hh, w, h, "#2c3a58");
    r(ctx, x, y - hh, w, 2, "#4a5f8a");
    r(ctx, x, y - hh, 2, h, "#3a4c72");
    // LED qui clignotent et grilles d'aération
    const horiz = w >= h;
    const n = Math.max(2, Math.floor((horiz ? w : h) / 14));
    for (let i = 0; i < n; i++) {
      const on = hash(idx * 31 + i * 7 + Math.floor(t * 2.5 + i)) > 0.35;
      const col = i % 3 === 0 ? "#44ff88" : i % 3 === 1 ? "#4aa8ff" : "#ff5d5d";
      const px = horiz ? x + 5 + i * 14 : x + w / 2 - 2;
      const py = horiz ? y + h - hh + 4 : y - hh + 6 + i * 14;
      r(ctx, px, py, 3, 3, on ? col : "#1a2236");
    }
    for (let i = 0; i < Math.floor(w / 6); i++) r(ctx, x + 3 + i * 6, y + h - 6, 3, 2, "#06090f");
    ctx.strokeStyle = OL;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y - hh + 0.5, w - 1, h + hh - 1);
  } else if (theme === "venus") {
    const pulse = 0.55 + 0.45 * Math.sin(t * 3 + idx);
    const col = idx % 2 === 0 ? "255,62,200" : "60,220,255";
    halo(ctx, x + w / 2, y + h, 46, idx % 2 === 0 ? "#ff3ec8" : "#3cdcff", 0.35 * pulse);
    r(ctx, x, y + h - hh, w, hh, "#170d2c");
    r(ctx, x, y - hh, w, h, "#2a1850");
    ctx.strokeStyle = `rgba(${col},${0.5 + pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y - hh + 1, w - 2, h - 2);
    ctx.strokeRect(x + 1, y + h - hh + 3, w - 2, hh - 6);
    r(ctx, x + 4, y + h - hh + 6, w - 8, 2, `rgba(${col},${0.4 + pulse * 0.6})`);
  } else {
    const c = COUL_CONTENEUR[idx % COUL_CONTENEUR.length]!;
    r(ctx, x, y + h - hh, w, hh, nuance(c, 0.7));
    for (let i = 3; i < w - 2; i += 6) r(ctx, x + i, y + h - hh, 2, hh, nuance(c, 0.5));
    r(ctx, x, y - hh, w, h, nuance(c, 1.15));
    for (let i = 3; i < w - 2; i += 8) r(ctx, x + i, y - hh, 1, h, nuance(c, 0.9));
    r(ctx, x, y - hh, w, 2, nuance(c, 1.45));
    r(ctx, x, y + h - 3, w, 3, nuance(c, 0.4));
    ctx.strokeStyle = OL;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y - hh + 0.5, w - 1, h + hh - 1);
    r(ctx, x + w / 2 - 1, y - hh, 2, h, nuance(c, 0.55)); // porte du conteneur
  }
}

/** Silhouette d'arme (vue de côté, pointant vers +x, centrée sur l'origine). */
function dessinerArmeSprite(ctx: CanvasRenderingContext2D, type: Arme, ech = 1): void {
  ctx.save();
  ctx.scale(ech, ech);
  const R = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  switch (type) {
    case "pistolet":
      R(-5, -3, 11, 5, OL);
      R(-4, -2, 9, 3, "#9aa3b2");
      R(-3, 1, 4, 5, OL);
      R(-2, 1, 2, 4, "#6b5a45");
      R(3, -2, 3, 1, "#ffd166");
      break;
    case "mitraillette":
      R(-8, -4, 17, 7, OL);
      R(-7, -3, 15, 5, "#2d3a4a");
      R(-7, -3, 15, 1, "#4fd1c5");
      R(5, -2, 6, 2, "#4fd1c5");
      R(-3, 3, 4, 6, OL);
      R(-2, 3, 2, 5, "#1e2a38");
      R(-6, 1, 4, 1, "#7ff0e3");
      break;
    case "pompe":
      R(-10, -3, 21, 6, OL);
      R(-9, -2, 19, 4, "#8a5a2b");
      R(-1, -2, 11, 4, "#a8a8b8");
      R(1, 1, 5, 2, "#555");
      R(8, -1, 4, 2, "#ff8c42");
      break;
    case "sniper":
      R(-11, -3, 25, 5, OL);
      R(-10, -2, 23, 3, "#4a3a6a");
      R(-2, -6, 8, 3, OL);
      R(-1, -5, 6, 1, "#c084fc");
      R(10, -1, 5, 1, "#ddd");
      break;
    case "roquette":
      R(-10, -5, 22, 10, OL);
      R(-9, -4, 20, 8, "#5a5f70");
      R(-9, -4, 20, 2, "#8a90a4");
      R(8, -4, 5, 8, "#ff5d73");
      R(11, -3, 3, 6, OL);
      R(-6, -6, 3, 3, OL);
      R(-5, -5, 1, 1, "#ffd166");
      break;
    default:
      break;
  }
  ctx.restore();
}

/** Objet au sol : halo coloré, ou télégraphe (anneau qui se resserre) pendant l'apparition. */
function dessinerObjet(ctx: CanvasRenderingContext2D, o: Ramassable, t: number): void {
  const couleur = o.type === "soin" ? "#6ee7a0" : ARMES[o.type].couleur;
  if ((o.delai ?? 0) > 0) {
    const k = (o.delai ?? 0) / TELEGRAPHE;
    ctx.strokeStyle = couleur;
    ctx.globalAlpha = 0.35 + 0.5 * (1 - k);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(o.x, o.y + 4, 10 + 22 * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(o.x, o.y + 4, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k));
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  const bob = Math.sin(t * 4 + o.id) * 2;
  halo(ctx, o.x, o.y + 4, 26 + Math.sin(t * 5 + o.id) * 3, couleur, 0.55);
  ombre(ctx, o.x, o.y + 10, 10, 3, 0.4);
  ctx.save();
  ctx.translate(Math.round(o.x), Math.round(o.y - 2 + bob));
  if (o.type === "soin") {
    bloc(ctx, -8, -8, 16, 16, "#f4f4f4");
    r(ctx, -2, -6, 4, 12, "#e04b4b");
    r(ctx, -6, -2, 12, 4, "#e04b4b");
  } else dessinerArmeSprite(ctx, o.type, 1.3);
  ctx.restore();
}

function dessinerPersonnage(
  ctx: CanvasRenderingContext2D,
  s: EtatArene,
  i: number,
  moi: string,
  t: number,
): void {
  const p = s.p[i]!;
  const j = s.joueurs[i]!;
  const eq = COULEUR_EQUIPE[j.equipe];
  const mien = j.id === moi;
  const moiJ = s.joueurs.find((q) => q.id === moi);
  const allie = !mien && !!moiJ && moiJ.equipe === j.equipe;
  const piedsY = p.y + 10;
  if (p.respawn > 0) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = eq;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      p.x,
      piedsY - 8,
      14,
      -Math.PI / 2,
      -Math.PI / 2 + (Math.PI * 2 * (RESPAWN - p.respawn)) / RESPAWN,
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
    texte(ctx, `${j.pseudo.slice(0, 8)} ${Math.ceil(p.respawn)}`, p.x, piedsY - 8, 11, "#fff");
    return;
  }
  // Anneau d'équipe sous les pieds : moi (double + pleine), allié (pointillé), adversaire (fin)
  ombre(ctx, p.x, piedsY, 15, 6, 0.4);
  ctx.strokeStyle = eq;
  ctx.lineWidth = mien ? 3 : 2;
  if (allie) ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.ellipse(p.x, piedsY, 17, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (mien) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(p.x, piedsY, 20, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Invulnérabilité après réapparition : bulle clignotante
  const invul = p.invul > 0;
  if (invul) {
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 18);
    ctx.fillStyle = "#8fe0ff";
    ctx.beginPath();
    ctx.ellipse(p.x, piedsY - 18, 20, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Traînée de l'esquive
  if (p.dashT > 0) {
    ctx.globalAlpha = 0.35;
    dessinerChibi(ctx, {
      x: p.x - p.fx * 16,
      y: piedsY - p.fy * 16,
      ech: 2,
      a: apparenceDe(j),
      dir: dirDe(p.fx, p.fy),
      pose: "marche",
      frame: 1,
    });
    ctx.globalAlpha = 1;
  }
  const dir = dirDe(p.fx, p.fy);
  const arriere = dir === "haut";
  const dessinerArme = () => {
    if (p.arme === "poing") return;
    ctx.save();
    ctx.translate(Math.round(p.x + p.fx * 12), Math.round(piedsY - 16 + p.fy * 8));
    const a = Math.atan2(p.fy, p.fx);
    ctx.rotate(a);
    if (Math.cos(a) < 0) ctx.scale(1, -1);
    dessinerArmeSprite(ctx, p.arme, 1);
    if (p.tir > 0) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(12, -2, 6, 4);
      ctx.fillStyle = ARMES[p.arme].couleur;
      ctx.fillRect(16, -3, 5, 6);
    }
    ctx.restore();
  };
  if (arriere) dessinerArme();
  dessinerChibi(ctx, {
    x: p.x,
    y: piedsY,
    ech: 2,
    a: apparenceDe(j),
    dir,
    pose: p.mv ? "marche" : p.touche > 0 ? "degat" : "idle",
    frame: Math.floor(p.marche) % 4,
    blanc: p.touche > 0,
  });
  if (!arriere) dessinerArme();
  // Coup de poing visuel
  if (p.arme === "poing" && p.recharge > ARMES.poing.cd - 0.12) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      p.x + p.fx * 20,
      piedsY - 14 + p.fy * 12,
      11,
      Math.atan2(p.fy, p.fx) - 0.9,
      Math.atan2(p.fy, p.fx) + 0.9,
    );
    ctx.stroke();
  }
  // Pastille de vie, nom et repères d'équipe
  const bx = Math.round(p.x - 17);
  const by = Math.round(piedsY - 58);
  r(ctx, bx - 1, by - 1, 36, 7, OL);
  r(ctx, bx, by, 34, 5, "#222");
  r(
    ctx,
    bx,
    by,
    34 * (p.pv / PV_MAX),
    5,
    p.pv > 50 ? "#6ee7a0" : p.pv > 25 ? "#ffd166" : "#ff6b6b",
  );
  texte(ctx, (allie ? "♦ " : "") + j.pseudo.slice(0, 9), p.x, by - 8, 11, mien ? "#ffd166" : eq);
  if (mien) {
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(p.x, by - 17 + Math.sin(t * 6) * 2);
    ctx.lineTo(p.x - 5, by - 24 + Math.sin(t * 6) * 2);
    ctx.lineTo(p.x + 5, by - 24 + Math.sin(t * 6) * 2);
    ctx.fill();
  } else if (allie) texte(ctx, "ALLIÉ", p.x, piedsY + 15, 9, "#6ee7a0");
}

function dessinerBalle(ctx: CanvasRenderingContext2D, b: Balle, fx: Effets): void {
  const v = Math.hypot(b.vx, b.vy) || 1;
  const ux = b.vx / v;
  const uy = b.vy / v;
  if (b.explosive) {
    ctx.save();
    ctx.translate(Math.round(b.x), Math.round(b.y));
    ctx.rotate(Math.atan2(b.vy, b.vx));
    dessinerArmeSprite(ctx, "roquette", 0.7);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(-14, -3, 6, 6);
    ctx.fillStyle = "#ff8c42";
    ctx.fillRect(-18, -2, 5, 4);
    ctx.restore();
    halo(ctx, b.x, b.y, 22, "#ff8c42", 0.5);
    if (Math.random() < 0.8)
      fx.particule({
        x: b.x - ux * 12,
        y: b.y - uy * 12,
        vx: -ux * 40 + (Math.random() - 0.5) * 30,
        vy: -uy * 40 + (Math.random() - 0.5) * 30,
        vie: 0.4,
        taille: 5,
        couleur: Math.random() < 0.5 ? "#8a8a96" : "#ffb347",
        lueur: true,
      });
    return;
  }
  const lon = Math.min(26, v * 0.04);
  ctx.strokeStyle = b.couleur;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(b.x - ux * lon, b.y - uy * lon);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(b.x - ux * lon * 0.6, b.y - uy * lon * 0.6);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function evenements(s: EtatArene, fx: Effets): void {
  for (const e of fx.nouveaux(s.ev)) {
    switch (e.k) {
      case "tir":
        fx.gerbe(e.x, e.y, 4, {
          couleur: ["#ffffff", e.c ?? "#ffd166"],
          vitesse: 150,
          vie: 0.16,
          taille: 3,
          lueur: true,
          angle: e.v ?? 0,
          ouverture: 0.9,
        });
        break;
      case "impact":
        fx.gerbe(e.x, e.y - 12, 9, {
          couleur: ["#ffffff", "#ffd166", "#ff6b6b"],
          vitesse: 170,
          vie: 0.35,
          lueur: true,
          frein: 3,
        });
        fx.popup(e.x, e.y - 40, `-${Math.round(e.v ?? 0)}`, "#ff6b6b", 13);
        if ((e.v ?? 0) >= 40) fx.secouer(3);
        break;
      case "explosion":
        fx.gerbe(e.x, e.y, 30, {
          couleur: ["#fff4b0", "#ffb347", "#ff5d3a", "#8a8a96"],
          vitesse: 260,
          vie: 0.6,
          taille: 6,
          lueur: true,
          frein: 3,
        });
        fx.gerbe(e.x, e.y, 10, {
          couleur: "#55555f",
          vitesse: 90,
          vie: 0.9,
          taille: 7,
          frein: 2,
          grav: -30,
        });
        fx.onde(e.x, e.y, RAYON_EXPLOSION, "#ffb347", 0.4);
        fx.secouer(9);
        fx.flash = 0.5;
        break;
      case "kill":
        fx.popup(e.x, e.y - 52, "+1 KO", e.c ?? "#ffd166", 18);
        fx.gerbe(e.x, e.y - 14, 18, {
          couleur: ["#ffd166", e.c ?? "#fff", "#ffffff"],
          vitesse: 200,
          vie: 0.7,
          lueur: true,
          grav: 280,
          frein: 1,
        });
        fx.secouer(4);
        break;
      case "respawn":
        fx.onde(e.x, e.y + 6, 34, e.c ?? "#8fe0ff", 0.45);
        fx.gerbe(e.x, e.y, 8, {
          couleur: [e.c ?? "#8fe0ff", "#ffffff"],
          vitesse: 90,
          vie: 0.5,
          lueur: true,
          grav: -60,
        });
        break;
      case "spawn":
        fx.onde(e.x, e.y + 4, 26, e.c ?? "#fff", 0.35);
        fx.gerbe(e.x, e.y, 6, {
          couleur: [e.c ?? "#fff", "#ffffff"],
          vitesse: 70,
          vie: 0.4,
          lueur: true,
          grav: -40,
        });
        break;
      default:
        break;
    }
  }
}

function dessiner(ctx: CanvasRenderingContext2D, base: EtatBase, moi: string, fx: Effets): void {
  const s = base as EtatArene;
  const idx = Math.min(s.manche, ARENES.length - 1);
  const arene = ARENES[idx]!;
  const t = fx.horloge;
  evenements(s, fx);

  fx.debut(ctx);
  if (!decorEnCache(`arene-${idx}`, L, H, (c) => dessinerFond(c, arene), ctx))
    dessinerFond(ctx, arene);

  // Tout ce qui est dessiné « debout » est trié du plus haut au plus bas de l'écran (profondeur).
  const liste: Array<{ y: number; d: () => void }> = [];
  arene.murs.forEach((m, i) =>
    liste.push({ y: m.y + m.h, d: () => dessinerMur(ctx, m, arene.theme, i, t) }),
  );
  for (const o of s.objets) liste.push({ y: o.y, d: () => dessinerObjet(ctx, o, t) });
  s.p.forEach((_, i) =>
    liste.push({ y: s.p[i]!.y + RAYON, d: () => dessinerPersonnage(ctx, s, i, moi, t) }),
  );
  liste.sort((a, b) => a.y - b.y);
  for (const e of liste) e.d();
  for (const b of s.balles) dessinerBalle(ctx, b, fx);

  fx.dessinerOndes(ctx);
  fx.dessinerParticules(ctx);
  fx.dessinerPopups(ctx);
  fx.fin(ctx);
  fx.dessinerFlash(ctx, L, H);

  // Tableau des scores
  const n = s.p.length;
  panneau(
    ctx,
    8,
    8,
    190,
    24 + n * 17,
    COULEUR_EQUIPE[s.joueurs.find((j) => j.id === moi)?.equipe ?? 0],
  );
  texte(ctx, `KILLS · ROUND ${s.manche + 1}/${NB_ROUNDS}`, 16, 21, 11, "#ffd166", "left");
  s.p.forEach((p, i) => {
    const j = s.joueurs[i]!;
    r(ctx, 16, 33 + i * 17, 6, 11, COULEUR_EQUIPE[j.equipe]);
    texte(
      ctx,
      `${j.pseudo.slice(0, 11)}${j.id === moi ? " ◄" : ""}`,
      28,
      39 + i * 17,
      11,
      "#fff",
      "left",
    );
    texte(ctx, String(p.kills), 186, 39 + i * 17, 12, "#ffd166", "right");
  });
  // Arme, munitions et esquive
  const moiP = s.p.find((p) => p.id === moi);
  if (moiP) {
    const def = ARMES[moiP.arme];
    panneau(ctx, L / 2 - 170, H - 34, 340, 26, def.couleur);
    ctx.save();
    ctx.translate(L / 2 - 148, H - 21);
    if (moiP.arme !== "poing") dessinerArmeSprite(ctx, moiP.arme, 1);
    else r(ctx, -5, -4, 10, 8, "#f1c9a5");
    ctx.restore();
    texte(ctx, def.nom, L / 2 - 126, H - 21, 11, def.couleur, "left");
    const mun = moiP.munitions > 1000 ? "∞" : String(Math.round(moiP.munitions));
    texte(ctx, mun, L / 2 - 20, H - 21, 13, "#fff");
    const k = 1 - moiP.dash / DASH_RECHARGE;
    r(ctx, L / 2 + 20, H - 26, 120, 8, "#222");
    r(ctx, L / 2 + 20, H - 26, 120 * k, 8, k >= 1 ? "#4fd1c5" : "#556");
    texte(ctx, k >= 1 ? "ESQUIVE (B)" : "ESQUIVE…", L / 2 + 80, H - 12, 9, "#cde");
  }
  dessinerScoresEquipes(ctx, s);
  dessinerMinicarte(ctx, s, arene, moi);
  texte(ctx, arene.nom, L / 2, 64, 11, "rgba(255,255,255,0.7)");
  if (s.entracte > 0 && s.phase === "jeu") {
    r(ctx, 0, H / 2 - 52, L, 104, "rgba(0,0,0,0.7)");
    texte(ctx, `ROUND ${s.manche + 1}`, L / 2, H / 2 - 14, 36, "#ffd166");
    texte(ctx, arene.nom, L / 2, H / 2 + 24, 20, "#fff");
  }
  dessinerHud(ctx, s, L, H);
}

const NOM_EQUIPE_HUD: Record<Equipe, string> = {
  0: "TEAM BLUE",
  1: "TEAM RED",
  2: "TEAM GREEN",
  3: "TEAM YELLOW",
};

/** Scores d'équipe (kills cumulés) sous le chrono : « TEAM BLUE 12 - TEAM RED 9 ». */
function dessinerScoresEquipes(ctx: CanvasRenderingContext2D, s: EtatArene): void {
  const equipes = equipesDe(s.joueurs);
  const total = (e: Equipe) =>
    s.p.reduce((t, p, i) => t + (s.joueurs[i]!.equipe === e ? p.kills : 0), 0);
  const l = equipes.length > 2 ? 150 : 100;
  panneau(ctx, L / 2 - l * 1.1, 36, l * 2.2, 20, "#19e6ff");
  const pas = (l * 2) / equipes.length;
  equipes.forEach((e, i) => {
    const cx = L / 2 - l + pas * (i + 0.5);
    const txt = equipes.length > 2 ? `${NOM_EQUIPE_HUD[e].slice(5)} ${total(e)}` : `${NOM_EQUIPE_HUD[e]} ${total(e)}`;
    texte(ctx, txt, cx, 47, 9, COULEUR_EQUIPE[e]);
  });
}

/** Minicarte en haut à droite : murs, armes au sol et joueurs vivants (toi en blanc cerclé). */
function dessinerMinicarte(
  ctx: CanvasRenderingContext2D,
  s: EtatArene,
  arene: Arene,
  moi: string,
): void {
  const w = 120;
  const h = Math.round((w * H) / L);
  const x0 = L - w - 10;
  const y0 = 8;
  const k = w / L;
  ctx.save();
  ctx.fillStyle = "rgba(6,10,24,0.82)";
  ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
  ctx.strokeStyle = "#19e6ff";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 1.5, y0 - 1.5, w + 3, h + 3);
  ctx.fillStyle = "rgba(90,110,160,0.75)";
  for (const m of arene.murs)
    ctx.fillRect(x0 + m.x * k, y0 + m.y * k, Math.max(1, m.w * k), Math.max(1, m.h * k));
  for (const o of s.objets) {
    ctx.fillStyle = (o.delai ?? 0) > 0 ? "rgba(255,47,180,0.6)" : "#ffe14d";
    ctx.fillRect(Math.round(x0 + o.x * k - 1.5), Math.round(y0 + o.y * k - 1.5), 3, 3);
  }
  s.p.forEach((p, i) => {
    if (p.respawn > 0) return;
    const j = s.joueurs[i]!;
    const px = Math.round(x0 + p.x * k);
    const py = Math.round(y0 + p.y * k);
    ctx.fillStyle = COULEUR_EQUIPE[j.equipe];
    ctx.fillRect(px - 2, py - 2, 4, 4);
    if (j.id === moi) {
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(px - 3.5, py - 3.5, 7, 7);
    }
  });
  ctx.restore();
}

export const arene: Jeu = {
  id: "arene",
  nom: "Arène multi-rounds",
  icone: "🔫",
  description:
    "3 rounds dans 3 arènes. Ramasse des armes et élimine tes adversaires : le plus de kills gagne.",
  aide: ["ZQSD / flèches : se déplacer", "Espace : tirer / frapper", "K : esquive (dash)"],
  boutons: { a: "Tirer", b: "Esquive" },
  largeur: L,
  hauteur: H,
  creer,
  pas,
  finir,
  dessiner,
};
