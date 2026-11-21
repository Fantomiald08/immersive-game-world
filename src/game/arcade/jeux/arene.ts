import { aleatoire, borne, dessinerHud, meilleureEquipe } from "../moteur";
import {
  angleVise,
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
  equipesDe,
  nomEquipe,
} from "../types";

/** Mini-jeu 1 : arène vue du dessus, 3 rounds dans 3 arènes différentes, armes à ramasser. */

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
const DASH_DUREE = 0.15;
const DASH_VITESSE = 430;
const DASH_RECHARGE = 2;

export type Arme = "poing" | "pistolet" | "mitraillette" | "pompe" | "sniper";
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
    couleur: "#ddd",
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
  },
  mitraillette: {
    nom: "Mitraillette",
    cd: 0.09,
    degats: 9,
    vitesse: 560,
    vie: 0.7,
    munitions: 40,
    tirs: 1,
    dispersion: 0.1,
    couleur: "#4fd1c5",
  },
  pompe: {
    nom: "Fusil à pompe",
    cd: 0.85,
    degats: 11,
    vitesse: 480,
    vie: 0.45,
    munitions: 7,
    tirs: 5,
    dispersion: 0.34,
    couleur: "#ff8c42",
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
  },
};
export const PORTEE_POING = 26 + RAYON;

export type Arene = { nom: string; fond: string; sol: string; murs: Rect[] };
export const ARENES: Arene[] = [
  {
    nom: "Cour d'Isitech",
    fond: "#27402b",
    sol: "#2f4d34",
    murs: [
      { x: 200, y: 120, w: 40, h: 40 },
      { x: 560, y: 120, w: 40, h: 40 },
      { x: 200, y: 320, w: 40, h: 40 },
      { x: 560, y: 320, w: 40, h: 40 },
      { x: 380, y: 200, w: 40, h: 80 },
    ],
  },
  {
    nom: "Salle des serveurs",
    fond: "#1d2433",
    sol: "#252e42",
    murs: [
      { x: 150, y: 60, w: 30, h: 160 },
      { x: 150, y: 260, w: 30, h: 160 },
      { x: 620, y: 60, w: 30, h: 160 },
      { x: 620, y: 260, w: 30, h: 160 },
      { x: 300, y: 228, w: 200, h: 24 },
    ],
  },
  {
    nom: "Laboratoire",
    fond: "#3a2f45",
    sol: "#463a53",
    murs: [
      { x: 340, y: 180, w: 120, h: 120 },
      { x: 100, y: 60, w: 80, h: 30 },
      { x: 620, y: 60, w: 80, h: 30 },
      { x: 100, y: 390, w: 80, h: 30 },
      { x: 620, y: 390, w: 80, h: 30 },
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
};
export type Ramassable = { id: number; x: number; y: number; type: Arme | "soin" };

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
  // Au départ, on regarde vers le centre de l'arène.
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
  };
}

function libre(arene: Arene, x: number, y: number, marge: number): boolean {
  if (x < marge || y < marge || x > L - marge || y > H - marge) return false;
  return !arene.murs.some(
    (m) => x > m.x - marge && x < m.x + m.w + marge && y > m.y - marge && y < m.y + m.h + marge,
  );
}

function tirerType(rnd: () => number): Arme | "soin" {
  const r = rnd();
  if (r < 0.3) return "pistolet";
  if (r < 0.55) return "mitraillette";
  if (r < 0.75) return "pompe";
  if (r < 0.87) return "sniper";
  return "soin";
}

function faireApparaitre(s: EtatArene, rnd: () => number): void {
  const arene = ARENES[s.manche]!;
  for (let essai = 0; essai < 30; essai++) {
    const x = 60 + rnd() * (L - 120);
    const y = 40 + rnd() * (H - 80);
    if (!libre(arene, x, y, 24)) continue;
    // Pas sous le tableau des scores (en haut à gauche) ni sous la barre d'arme (en bas).
    if ((x < 200 && y < 110) || y > H - 40) continue;
    s.objets.push({ id: s.suivant++, x, y, type: tirerType(rnd) });
    return;
  }
}

/** Début d'un round : on remet tout le monde à neuf, dans la nouvelle arène. */
function lancerRound(s: EtatArene, rnd: () => number, manche: number): void {
  s.manche = manche;
  s.entracte = manche === 0 ? 0 : ENTRACTE;
  s.balles = [];
  s.objets = [];
  s.prochainObjet = 3;
  for (let i = 0; i < s.joueurs.length; i++) {
    const ancien = s.p[i];
    const n = nouveauPerso(s, i);
    if (ancien) {
      n.kills = ancien.kills;
      n.morts = ancien.morts;
    }
    s.p[i] = n;
  }
  for (let i = 0; i < 3; i++) faireApparaitre(s, rnd);
}

/** Pousse un cercle hors des murs et des bords de l'arène. */
function resoudre(arene: Arene, p: { x: number; y: number }): void {
  p.x = borne(p.x, RAYON, L - RAYON);
  p.y = borne(p.y, RAYON, H - RAYON);
  for (const m of arene.murs) {
    const cx = borne(p.x, m.x, m.x + m.w);
    const cy = borne(p.y, m.y, m.y + m.h);
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= RAYON * RAYON) continue;
    if (d2 === 0) {
      // Centre dans le mur : on sort par le côté le plus proche.
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
    p: [],
    balles: [],
    objets: [],
    manche: 0,
    entracte: 0,
    prochainObjet: 3,
    suivant: 1,
    graine,
  };
  lancerRound(s, aleatoire(graine), 0);
  return s;
}

function infliger(s: EtatArene, cible: PersoArene, tireur: string, degats: number): void {
  if (cible.respawn > 0 || cible.invul > 0) return;
  cible.pv -= degats;
  cible.touche = 0.15;
  if (cible.pv > 0) return;
  cible.pv = 0;
  cible.morts += 1;
  cible.respawn = RESPAWN;
  const k = s.p.find((q) => q.id === tireur);
  if (k && k.id !== cible.id) k.kills += 1;
}

function tirer(s: EtatArene, i: number, rnd: () => number): void {
  const p = s.p[i]!;
  const def = ARMES[p.arme];
  p.recharge = def.cd;
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
      infliger(s, q, p.id, def.degats);
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
    });
  }
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
    if (p.respawn > 0) {
      p.respawn -= dt;
      if (p.respawn <= 0) {
        const n = nouveauPerso(s, i);
        n.kills = p.kills;
        n.morts = p.morts;
        s.p[i] = n;
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
    p.x += vx * dt;
    p.y += vy * dt;
    resoudre(arene, p);
    if (presse(e, BTN.a) && p.recharge <= 0) tirer(s, i, rnd);

    for (let k = s.objets.length - 1; k >= 0; k--) {
      const o = s.objets[k]!;
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
            infliger(s, q, b.par, b.degats);
            mort = true;
            break;
          }
        }
    }
    b.vie -= dt;
    if (mort || b.vie <= 0) s.balles.splice(k, 1);
  }

  s.prochainObjet -= dt;
  if (s.prochainObjet <= 0) {
    s.prochainObjet = 3.5;
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
    .map(({ p, j }, r) => ({
      id: j.id,
      pseudo: j.pseudo,
      equipe: j.equipe,
      rang: r + 1,
      texte: `${p.kills} kill${p.kills > 1 ? "s" : ""} · ${p.morts} mort${p.morts > 1 ? "s" : ""}`,
    }));
  const titre =
    vainqueur === null
      ? `Égalité (${total})`
      : `Victoire de ${nomEquipe(s.joueurs, vainqueur)} (${total})`;
  return { vainqueur, titre, lignes };
}

function dessiner(ctx: CanvasRenderingContext2D, base: EtatBase, moi: string): void {
  const s = base as EtatArene;
  const arene = ARENES[Math.min(s.manche, ARENES.length - 1)]!;
  ctx.fillStyle = arene.fond;
  ctx.fillRect(0, 0, L, H);
  ctx.fillStyle = arene.sol;
  for (let x = 0; x < L; x += 40)
    for (let y = 0; y < H; y += 40) if (((x + y) / 40) % 2 === 0) ctx.fillRect(x, y, 40, 40);
  for (const m of arene.murs) {
    ctx.fillStyle = "#12161f";
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle = "#5b6577";
    ctx.fillRect(m.x, m.y, m.w, 4);
    ctx.fillRect(m.x, m.y, 4, m.h);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const o of s.objets) {
    const c = o.type === "soin" ? "#6ee7a0" : ARMES[o.type].couleur;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(o.x, o.y + 9, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.fillRect(o.x - 9, o.y - 9, 18, 18);
    ctx.fillStyle = "#111";
    ctx.font = "bold 12px monospace";
    ctx.fillText(o.type === "soin" ? "+" : o.type[0]!.toUpperCase(), o.x, o.y + 1);
  }
  for (const b of s.balles) {
    ctx.fillStyle = b.couleur;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  s.p.forEach((p, i) => {
    const j = s.joueurs[i]!;
    if (p.respawn > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "12px monospace";
      ctx.fillText(`${j.pseudo} ${Math.ceil(p.respawn)}`, p.x, p.y);
      return;
    }
    ctx.globalAlpha = p.invul > 0 && Math.floor(s.t * 10) % 2 === 0 ? 0.45 : 1;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 9, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ARMES[p.arme].couleur;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.fx * (RAYON + 9), p.y + p.fy * (RAYON + 9));
    ctx.stroke();
    ctx.fillStyle = p.touche > 0 ? "#fff" : j.couleur;
    ctx.beginPath();
    ctx.arc(p.x, p.y, RAYON, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = j.id === moi ? "#ffd166" : "#111";
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#111";
    ctx.fillRect(p.x - 16, p.y - 25, 32, 5);
    ctx.fillStyle = p.pv > 50 ? "#6ee7a0" : p.pv > 25 ? "#ffd166" : "#ff6b6b";
    ctx.fillRect(p.x - 15, p.y - 24, 30 * (p.pv / PV_MAX), 3);
    ctx.fillStyle = "#fff";
    ctx.font = "11px monospace";
    ctx.fillText(j.pseudo.slice(0, 10), p.x, p.y - 32);
  });

  // Tableau des scores
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(6, 4, 178, 22 + s.p.length * 16);
  ctx.font = "bold 12px monospace";
  ctx.fillStyle = "#ffd166";
  ctx.fillText(`KILLS  ·  Round ${s.manche + 1}/${NB_ROUNDS}`, 12, 16);
  ctx.font = "12px monospace";
  s.p.forEach((p, i) => {
    ctx.fillStyle = s.joueurs[i]!.couleur;
    ctx.fillText(`${s.joueurs[i]!.pseudo.slice(0, 10).padEnd(10)} ${p.kills}`, 12, 34 + i * 16);
  });
  const moiP = s.p.find((p) => p.id === moi);
  ctx.textAlign = "center";
  if (moiP) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(L / 2 - 150, H - 28, 300, 22);
    ctx.fillStyle = ARMES[moiP.arme].couleur;
    ctx.font = "bold 13px monospace";
    const mun = moiP.munitions > 1000 ? "∞" : String(Math.round(moiP.munitions));
    ctx.fillText(
      `${ARMES[moiP.arme].nom} · ${mun}  |  Esquive ${moiP.dash > 0 ? Math.ceil(moiP.dash) + "s" : "prête"}`,
      L / 2,
      H - 17,
    );
  }
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "12px monospace";
  ctx.fillText(arene.nom, L / 2, 40);
  if (s.entracte > 0 && s.phase === "jeu") {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, H / 2 - 50, L, 100);
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 34px monospace";
    ctx.fillText(`ROUND ${s.manche + 1}`, L / 2, H / 2 - 12);
    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";
    ctx.fillText(arene.nom, L / 2, H / 2 + 24);
  }
  dessinerHud(ctx, s, L, H);
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
