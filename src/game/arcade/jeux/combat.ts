import { borne, dessinerHud, meilleureEquipe } from "../moteur";
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
    entracte: 0,
    annonce: "",
    suivant: 1,
  };
  placer(s);
  return s;
}

const equipeDe = (s: EtatCombat, id: string): Equipe =>
  s.joueurs.find((j) => j.id === id)?.equipe ?? 0;
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
): void {
  if (cible.ko) return;
  if (cible.garde && devantCible) {
    cible.pv = Math.max(0, cible.pv - defAtt.degats * 0.15);
    cible.vx = sens * 60;
    cible.flash = 0.05;
  } else {
    cible.pv = Math.max(0, cible.pv - defAtt.degats);
    cible.etourdi = defAtt.etourdi;
    cible.atk = null;
    cible.vx = sens * defAtt.recul;
    cible.flash = 0.12;
  }
  if (cible.pv <= 0) {
    cible.ko = true;
    cible.vy = -260;
    cible.etourdi = 99;
    cible.atk = null;
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

    // Regarde toujours l'adversaire le plus proche.
    let proche: Combattant | null = null;
    s.f.forEach((q, k) => {
      if (q.ko || s.joueurs[k]!.equipe === j.equipe) return;
      if (!proche || Math.abs(q.x - c.x) < Math.abs(proche.x - c.x)) proche = q;
    });
    const cible = proche as Combattant | null;
    if (cible && Math.abs(cible.x - c.x) > 6 && !c.etourdi) c.face = cible.x > c.x ? 1 : -1;

    if (c.etourdi > 0) {
      c.garde = false;
      c.etourdi -= dt;
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
            toucher(s, q, def, c.face, devant);
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
    .map(({ c, j }, r) => ({
      id: j.id,
      pseudo: j.pseudo,
      equipe: j.equipe,
      rang: r + 1,
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

/* ───────────── Dessin ───────────── */

function combattant(
  ctx: CanvasRenderingContext2D,
  c: Combattant,
  couleur: string,
  moi: boolean,
  temps: number,
): void {
  const f = c.face;
  const x = c.x;
  const y = c.y;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, SOL + 4, 26 - (SOL - y) * 0.05, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  if (c.ko) {
    ctx.translate(x, y);
    ctx.rotate(f * -1.4);
    ctx.translate(-x, -y);
  }
  const teinte = c.flash > 0 ? "#fff" : couleur;
  const pas = Math.sin(c.marche) * 8;
  const accroupi = c.garde ? 18 : 0;
  // Jambes
  ctx.fillStyle = "#222";
  const att = c.atk;
  const defAtt = att ? ATTAQUES[att.type] : null;
  const actif = !!att && !!defAtt && att.t >= defAtt.debut && att.t <= defAtt.fin;
  ctx.fillRect(x - 14 + pas * 0.5, y - 40 + accroupi * 0.4, 11, 40 - accroupi * 0.4);
  if (att?.type === "b" && actif) ctx.fillRect(x, y - 40, f * 74, 11);
  else ctx.fillRect(x + 3 - pas * 0.5, y - 40 + accroupi * 0.4, 11, 40 - accroupi * 0.4);
  // Torse
  ctx.fillStyle = teinte;
  ctx.fillRect(x - 17, y - 80 + accroupi, 34, 44 - accroupi * 0.3);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x - 17, y - 48 + accroupi * 0.7, 34, 6);
  // Tête
  ctx.fillStyle = "#f1c9a5";
  ctx.fillRect(x - 11, y - 102 + accroupi, 22, 22);
  ctx.fillStyle = "#111";
  ctx.fillRect(x + (f > 0 ? 2 : -9), y - 94 + accroupi, 7, 4);
  ctx.fillStyle = "#3a2410";
  ctx.fillRect(x - 12, y - 106 + accroupi, 24, 7);
  // Bras / poing
  ctx.fillStyle = "#f1c9a5";
  if (att?.type === "a" && actif) ctx.fillRect(x, y - 72 + accroupi, f * 60, 12);
  else if (att?.type === "c") ctx.fillRect(x, y - 70 + accroupi, f * 34, 12);
  else if (c.garde) ctx.fillRect(x + f * 6, y - 92 + accroupi, f * 18, 30);
  else ctx.fillRect(x + f * 10, y - 70 + accroupi, f * 14, 10);
  ctx.restore();
  if (c.garde) {
    ctx.strokeStyle = "rgba(120,200,255,0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + f * 16, y - 60, 40, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (moi && !c.ko) {
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(x, y - 122 + Math.sin(temps * 6) * 2);
    ctx.lineTo(x - 7, y - 134);
    ctx.lineTo(x + 7, y - 134);
    ctx.fill();
  }
}

function dessiner(ctx: CanvasRenderingContext2D, base: EtatBase, moi: string): void {
  const s = base as EtatCombat;
  const fond = ctx.createLinearGradient(0, 0, 0, SOL);
  fond.addColorStop(0, "#1b1340");
  fond.addColorStop(1, "#c2507a");
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, L, SOL);
  // Décor : skyline
  ctx.fillStyle = "#2a1c52";
  for (let k = 0; k < 14; k++) {
    const h = 70 + ((k * 53) % 90);
    ctx.fillRect(k * 60, SOL - h - 20, 48, h + 20);
    ctx.fillStyle = "#ffe08a";
    for (let r = 0; r < h / 24; r++) ctx.fillRect(k * 60 + 10, SOL - h - 8 + r * 24, 6, 8);
    ctx.fillStyle = "#2a1c52";
  }
  ctx.fillStyle = "#3a2a24";
  ctx.fillRect(0, SOL, L, H - SOL);
  ctx.fillStyle = "#5a4034";
  ctx.fillRect(0, SOL, L, 6);
  for (let x = 0; x < L; x += 50) {
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x, SOL + 20, 24, 3);
  }

  s.f.forEach((c, i) => combattant(ctx, c, s.joueurs[i]!.couleur, s.joueurs[i]!.id === moi, s.t));
  for (const b of s.boules) {
    const g = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 18);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.5, COULEUR_EQUIPE[b.eq]);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Barres de vie : équipes 0 et 2 à gauche, 1 et 3 à droite.
  ctx.textBaseline = "middle";
  const rangs = { gauche: 0, droite: 0 };
  s.f.forEach((c, i) => {
    const j = s.joueurs[i]!;
    const gauche = j.equipe % 2 === 0;
    const k = gauche ? rangs.gauche++ : rangs.droite++;
    const w = 290;
    const x = gauche ? 10 : L - 10 - w;
    const y = 8 + k * 24;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x, y, w, 18);
    ctx.fillStyle = c.pv > 50 ? "#6ee7a0" : c.pv > 25 ? "#ffd166" : "#ff6b6b";
    const lp = (w - 4) * (c.pv / PV_MAX);
    ctx.fillRect(gauche ? x + 2 : x + w - 2 - lp, y + 2, lp, 14);
    ctx.fillStyle = COULEUR_EQUIPE[j.equipe];
    ctx.fillRect(gauche ? x : x + w - 4, y, 4, 18);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = gauche ? "left" : "right";
    ctx.fillText(j.pseudo.slice(0, 12), gauche ? x + 10 : x + w - 10, y + 9);
  });
  // Manches gagnées, par équipe
  ctx.textAlign = "center";
  ctx.font = "bold 14px monospace";
  const equipes = equipesDe(s.joueurs);
  equipes.forEach((e, k) => {
    const x = L / 2 + (k - (equipes.length - 1) / 2) * (equipes.length > 2 ? 56 : 120);
    const gagnees = Math.min(MANCHES_VICTOIRE, s.manches[e] ?? 0);
    ctx.fillStyle = COULEUR_EQUIPE[e];
    ctx.fillText("●".repeat(gagnees) + "○".repeat(MANCHES_VICTOIRE - gagnees), x, 44);
  });
  ctx.fillStyle = "#fff";
  ctx.fillText(`MANCHE ${Math.min(s.manche, 3)}`, L / 2, 60);
  const moiC = s.f.find((c) => c.id === moi);
  if (moiC) {
    ctx.fillStyle = moiC.cdSpecial > 0 ? "#999" : "#4fd1c5";
    ctx.font = "12px monospace";
    ctx.fillText(
      moiC.cdSpecial > 0 ? `Spécial ${Math.ceil(moiC.cdSpecial)}s` : "SPÉCIAL PRÊT",
      L / 2,
      H - 14,
    );
  }
  if (s.entracte > 0 && s.annonce) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, H / 2 - 50, L, 100);
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 44px monospace";
    ctx.fillText(s.annonce, L / 2, H / 2);
  }
  dessinerHud(ctx, s, L, H);
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
