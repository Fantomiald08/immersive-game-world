import { borne, dessinerHud, formaterChrono } from "../moteur";
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
} from "../types";

/**
 * Mini-jeu 2 : course de véhicules en vue humaine (derrière la voiture, route en perspective).
 * Circuit fermé de 1 400 m, 3 tours. Classement au temps ; les non-arrivés sont classés à la distance.
 */

export const L = 800;
export const H = 480;
export const LONGUEUR_TOUR = 1400;
export const TOURS = 3;
export const VMAX = 56; // m/s (≈ 200 km/h)
const ACCEL = 30;
const FREIN = 62;
const FROTTEMENT = 11;
const NITRO_DUREE = 1.3;
const NITRO_RECHARGE = 6;
const HORS_PISTE_VMAX = 0.35 * VMAX;

/** Circuit : [longueur du tronçon en m, courbure]. >0 = vers la droite. Total = 1 400 m. */
const TRONCONS: ReadonlyArray<readonly [number, number]> = [
  [200, 0],
  [150, 0.9],
  [100, 0],
  [180, -1.1],
  [120, 0],
  [160, 1.4],
  [140, 0],
  [150, -0.8],
  [200, 0],
];

export function courbure(z: number): number {
  let d = ((z % LONGUEUR_TOUR) + LONGUEUR_TOUR) % LONGUEUR_TOUR;
  for (const [l, c] of TRONCONS) {
    if (d < l) return c;
    d -= l;
  }
  return 0;
}

export type Voiture = {
  id: string;
  /** Distance totale parcourue (m). */
  z: number;
  /** Position latérale : -1 = bord gauche de la route, 1 = bord droit. */
  x: number;
  v: number;
  nitro: number;
  nitroCd: number;
  /** Direction braquée (-1, 0, 1), pour le dessin. */
  dir: number;
  /** Temps d'arrivée (s) ou -1. */
  fin: number;
};
export type EtatCourse = EtatBase & { v: Voiture[] };

function creer(joueurs: JoueurPartie[]): EtatCourse {
  return {
    phase: "compte",
    compte: DUREE_COMPTE,
    t: 0,
    duree: DUREE_PARTIE,
    joueurs: joueurs.map((j) => ({ ...j })),
    resultat: null,
    v: joueurs.map((j, i) => ({
      id: j.id,
      z: 0 - i * 6,
      x: joueurs.length === 1 ? 0 : -0.6 + (1.2 * i) / (joueurs.length - 1),
      v: 0,
      nitro: 0,
      nitroCd: 0,
      dir: 0,
      fin: -1,
    })),
  };
}

function pas(base: EtatBase, entrees: Readonly<Record<string, number>>, dt: number): void {
  const s = base as EtatCourse;
  s.v.forEach((c, i) => {
    const arrive = c.fin >= 0;
    const e = arrive || s.joueurs[i]!.absent ? 0 : (entrees[c.id] ?? 0);
    const gaz = presse(e, BTN.haut);
    const frein = presse(e, BTN.bas);
    c.nitroCd = Math.max(0, c.nitroCd - dt);
    c.nitro = Math.max(0, c.nitro - dt);
    if (presse(e, BTN.a) && c.nitroCd <= 0) {
      c.nitro = NITRO_DUREE;
      c.nitroCd = NITRO_RECHARGE;
    }
    const vmax = (c.nitro > 0 ? 1.35 : 1) * VMAX;
    if (arrive) c.v = Math.max(18, c.v - 15 * dt);
    else if (gaz) c.v += (c.nitro > 0 ? ACCEL * 2 : ACCEL) * dt;
    else c.v = c.v > 0 ? Math.max(0, c.v - FROTTEMENT * dt) : Math.min(0, c.v + FROTTEMENT * dt);
    if (frein) c.v -= FREIN * dt;
    c.v = borne(c.v, -8, vmax);

    const horsPiste = Math.abs(c.x) > 1.02;
    if (horsPiste && c.v > HORS_PISTE_VMAX) c.v = Math.max(HORS_PISTE_VMAX, c.v - 70 * dt);

    const braque = (presse(e, BTN.droite) ? 1 : 0) - (presse(e, BTN.gauche) ? 1 : 0);
    c.dir = braque;
    const rapide = borne(c.v / VMAX, -0.3, 1.35);
    c.x += braque * 1.9 * rapide * dt;
    // La force centrifuge pousse vers l'extérieur du virage.
    c.x -= courbure(c.z) * rapide * rapide * 1.1 * dt;
    c.x = borne(c.x, -1.6, 1.6);
    c.z += c.v * dt;

    if (!arrive && c.z >= LONGUEUR_TOUR * TOURS) {
      c.fin = s.t;
      c.z = LONGUEUR_TOUR * TOURS;
    }
  });
  // Pare-chocs : la voiture qui touche celle de devant est ralentie.
  for (let i = 0; i < s.v.length; i++)
    for (let j = i + 1; j < s.v.length; j++) {
      const a = s.v[i]!;
      const b = s.v[j]!;
      if (Math.abs(a.z - b.z) < 7 && Math.abs(a.x - b.x) < 0.24) {
        const [derriere, devant] = a.z < b.z ? [a, b] : [b, a];
        derriere.v = Math.min(derriere.v, devant.v * 0.96);
        const ecart = derriere.x <= devant.x ? -1 : 1;
        derriere.x += ecart * 0.02;
        devant.x -= ecart * 0.02;
      }
    }
}

function termine(base: EtatBase): boolean {
  const s = base as EtatCourse;
  return s.v.every((c, i) => c.fin >= 0 || s.joueurs[i]!.absent);
}

/** Classement : arrivés au temps, puis les autres à la distance parcourue. */
function classer(s: EtatCourse): Array<{ c: Voiture; j: JoueurPartie; rang: number }> {
  return s.v
    .map((c, i) => ({ c, j: s.joueurs[i]! }))
    .sort((a, b) => {
      if (a.j.absent !== b.j.absent) return a.j.absent ? 1 : -1;
      if (a.c.fin >= 0 && b.c.fin >= 0) return a.c.fin - b.c.fin;
      if (a.c.fin >= 0) return -1;
      if (b.c.fin >= 0) return 1;
      return b.c.z - a.c.z;
    })
    .map((x, i) => ({ ...x, rang: i + 1 }));
}

function finir(base: EtatBase): Resultat {
  const s = base as EtatCourse;
  const cl = classer(s);
  const pts: Record<Equipe, number> = { 0: 0, 1: 0 };
  const meilleur: Record<Equipe, number> = { 0: 99, 1: 99 };
  for (const x of cl) {
    pts[x.j.equipe] += x.rang;
    meilleur[x.j.equipe] = Math.min(meilleur[x.j.equipe], x.rang);
  }
  let vainqueur: Equipe | null = null;
  if (pts[0] !== pts[1]) vainqueur = pts[0] < pts[1] ? 0 : 1;
  else if (meilleur[0] !== meilleur[1]) vainqueur = meilleur[0] < meilleur[1] ? 0 : 1;
  const lignes: LigneClassement[] = cl.map(({ c, j, rang }) => ({
    id: j.id,
    pseudo: j.pseudo,
    equipe: j.equipe,
    rang,
    texte: j.absent
      ? "a abandonné"
      : c.fin >= 0
        ? formaterChrono(c.fin)
        : `non arrivé · ${Math.round((c.z / (LONGUEUR_TOUR * TOURS)) * 100)} %`,
  }));
  return {
    vainqueur,
    titre:
      vainqueur === null
        ? "Égalité !"
        : cl.length === 2
          ? `${cl[0]!.j.pseudo} gagne la course`
          : `Victoire de l'équipe ${vainqueur === 0 ? "bleue" : "rouge"}`,
    lignes,
  };
}

/* ───────────── Dessin en perspective ───────────── */

const HORIZON = 190;
const LARGEUR_ROUTE_BAS = 330; // demi-largeur de la route (px) en bas de l'écran
const PORTEE = 60; // distance de dessin maximale, en « profondeur » (1 = au pied de la voiture)
const ECHELLE = 16; // mètres par unité de profondeur
const KAPPA = 5e-5; // intensité visuelle des virages

function voiture(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bas: number,
  larg: number,
  couleur: string,
  braque: number,
): void {
  const h = larg * 0.55;
  const x = cx - larg / 2 + braque * larg * 0.03;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x - larg * 0.04, bas - h * 0.08, larg * 1.08, h * 0.12);
  ctx.fillStyle = "#15151c";
  ctx.fillRect(x - larg * 0.02, bas - h * 0.42, larg * 0.2, h * 0.42);
  ctx.fillRect(x + larg * 0.82, bas - h * 0.42, larg * 0.2, h * 0.42);
  ctx.fillStyle = couleur;
  ctx.fillRect(x, bas - h * 0.78, larg, h * 0.5);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(x, bas - h * 0.78, larg, h * 0.08);
  ctx.fillStyle = couleur;
  ctx.fillRect(x + larg * 0.16, bas - h * 1.02, larg * 0.68, h * 0.3);
  ctx.fillStyle = "#1c2a3a";
  ctx.fillRect(x + larg * 0.22, bas - h * 0.98, larg * 0.56, h * 0.22);
  ctx.fillStyle = "#ff3b3b";
  ctx.fillRect(x + larg * 0.04, bas - h * 0.62, larg * 0.16, h * 0.12);
  ctx.fillRect(x + larg * 0.8, bas - h * 0.62, larg * 0.16, h * 0.12);
  ctx.fillStyle = "#222";
  ctx.fillRect(x + larg * 0.3, bas - h * 0.4, larg * 0.4, h * 0.1);
}

function dessiner(ctx: CanvasRenderingContext2D, base: EtatBase, moi: string): void {
  const s = base as EtatCourse;
  const me = s.v.find((c) => c.id === moi) ?? s.v[0];
  if (!me) return;

  // Ciel, soleil, montagnes
  const ciel = ctx.createLinearGradient(0, 0, 0, HORIZON);
  ciel.addColorStop(0, "#2a1b5c");
  ciel.addColorStop(0.6, "#e0577a");
  ciel.addColorStop(1, "#ffc371");
  ctx.fillStyle = ciel;
  ctx.fillRect(0, 0, L, HORIZON + 1);
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath();
  ctx.arc(L / 2 + 160 - me.x * 14, HORIZON - 36, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3d2457";
  const decal = -me.x * 18 - (me.z % 900) * 0.05;
  ctx.beginPath();
  ctx.moveTo(-60, HORIZON);
  for (let k = 0; k <= 12; k++)
    ctx.lineTo(-60 + k * 80 + decal, HORIZON - 26 - ((k * 37) % 5) * 12);
  ctx.lineTo(L + 60, HORIZON);
  ctx.fill();

  // Route : on dessine ligne par ligne, de l'horizon vers le bas.
  const lignes = H - HORIZON;
  const centre = new Float32Array(H);
  const demi = new Float32Array(H);
  const tMin = 1 / PORTEE;
  // On calcule du plus proche au plus loin pour accumuler les virages.
  let pente = 0;
  let decalage = 0;
  let zPrec = 0;
  const lignesDessin: Array<{ y: number; stripe: number }> = [];
  for (let y = H - 1; y > HORIZON; y--) {
    const t = (y - HORIZON) / lignes;
    if (t < tMin) break;
    const dz = (1 / t - 1) * ECHELLE;
    const pas2 = dz - zPrec;
    zPrec = dz;
    const c = courbure(me.z + dz);
    pente += c * pas2 * KAPPA;
    decalage += pente * pas2;
    const hw = LARGEUR_ROUTE_BAS * t;
    demi[y] = hw;
    centre[y] = L / 2 - me.x * hw + decalage * hw;
    lignesDessin.push({ y, stripe: Math.floor((me.z + dz) / 14) });
  }
  ctx.fillStyle = "#34a853";
  ctx.fillRect(0, HORIZON, L, H - HORIZON);
  for (const { y, stripe } of lignesDessin) {
    const hw = demi[y]!;
    const cx = centre[y]!;
    const pair = stripe % 2 === 0;
    ctx.fillStyle = pair ? "#2f9a4a" : "#3cb55a";
    ctx.fillRect(0, y, L, 1);
    ctx.fillStyle = pair ? "#d93a3a" : "#f2f2f2";
    ctx.fillRect(cx - hw * 1.14, y, hw * 2.28, 1);
    ctx.fillStyle = pair ? "#5a5a66" : "#63636f";
    ctx.fillRect(cx - hw, y, hw * 2, 1);
    ctx.fillStyle = "#f2f2f2";
    if (stripe % 4 < 2) {
      ctx.fillRect(cx - hw * 0.012, y, hw * 0.024, 1);
    }
    ctx.fillRect(cx - hw * 0.99, y, Math.max(1, hw * 0.02), 1);
    ctx.fillRect(cx + hw * 0.97, y, Math.max(1, hw * 0.02), 1);
    // Ligne d'arrivée
    const m =
      (((me.z + (1 / ((y - HORIZON) / lignes) - 1) * ECHELLE) % LONGUEUR_TOUR) + LONGUEUR_TOUR) %
      LONGUEUR_TOUR;
    if (m < 8 || m > LONGUEUR_TOUR - 1) {
      const n = 10;
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = (k + Math.floor(m)) % 2 === 0 ? "#fff" : "#111";
        ctx.fillRect(cx - hw + (k * hw * 2) / n, y, (hw * 2) / n, 1);
      }
    }
  }

  // Autres voitures, de la plus lointaine à la plus proche
  const autres = s.v
    .map((c, i) => ({ c, j: s.joueurs[i]! }))
    .filter(({ c }) => c.id !== me.id && c.z - me.z > 1 && c.z - me.z < PORTEE * ECHELLE)
    .sort((a, b) => b.c.z - a.c.z);
  for (const { c, j } of autres) {
    const prof = 1 + (c.z - me.z) / ECHELLE;
    const y = Math.round(HORIZON + (1 / prof) * lignes);
    if (y <= HORIZON || y >= H) continue;
    const hw = demi[y] ?? 0;
    if (hw <= 0) continue;
    const cx = (centre[y] ?? 0) + c.x * hw;
    const larg = hw * 0.5;
    voiture(ctx, cx, y, larg, j.couleur, c.dir);
    if (larg > 18) {
      ctx.fillStyle = "#fff";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(j.pseudo.slice(0, 10), cx, y - larg * 0.7);
    }
  }

  // Ma voiture, vue de derrière
  const moiJ = s.joueurs[s.v.indexOf(me)]!;
  const secousse = Math.abs(me.x) > 1.02 ? Math.sin(s.t * 60) * 3 : 0;
  if (me.nitro > 0) {
    ctx.fillStyle = "#4fd1c5";
    ctx.fillRect(L / 2 - 50 + secousse, H - 40, 18, 24 + Math.random() * 10);
    ctx.fillRect(L / 2 + 32 + secousse, H - 40, 18, 24 + Math.random() * 10);
  }
  voiture(ctx, L / 2 + secousse, H - 22, 170, moiJ.couleur, me.dir * 3);

  // Tableau de bord
  const classement = classer(s);
  const place = classement.find((x) => x.c.id === me.id)?.rang ?? 1;
  const tour = Math.min(TOURS, Math.floor(me.z / LONGUEUR_TOUR) + 1);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(6, 4, 170, 76);
  ctx.textAlign = "left";
  ctx.font = "bold 22px monospace";
  ctx.fillStyle = "#ffd166";
  ctx.fillText(`${place}/${s.v.length}`, 14, 28);
  ctx.font = "14px monospace";
  ctx.fillStyle = "#fff";
  ctx.fillText(`Tour ${tour}/${TOURS}`, 14, 48);
  ctx.fillText(formaterChrono(me.fin >= 0 ? me.fin : s.t), 14, 68);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(L - 176, 4, 170, 56);
  ctx.textAlign = "right";
  ctx.fillStyle = "#4fd1c5";
  ctx.font = "bold 26px monospace";
  ctx.fillText(`${Math.round(Math.max(0, me.v) * 3.6)} km/h`, L - 14, 30);
  ctx.font = "12px monospace";
  ctx.fillStyle = me.nitroCd > 0 ? "#999" : "#ffd166";
  ctx.fillText(me.nitroCd > 0 ? `Turbo ${Math.ceil(me.nitroCd)}s` : "TURBO PRÊT", L - 14, 50);
  // Mini-classement
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(6, 86, 150, 8 + Math.min(4, classement.length) * 15);
  ctx.textAlign = "left";
  classement.slice(0, 4).forEach((x, k) => {
    ctx.fillStyle = x.j.couleur;
    ctx.font = "12px monospace";
    ctx.fillText(
      `${x.rang}. ${x.j.pseudo.slice(0, 9)} ${x.c.fin >= 0 ? formaterChrono(x.c.fin) : ""}`,
      8,
      100 + k * 15,
    );
  });
  if (me.fin >= 0 && s.phase === "jeu") {
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 36px monospace";
    ctx.fillText(`ARRIVÉ ! ${formaterChrono(me.fin)}`, L / 2, 150);
  }
  dessinerHud(ctx, s, L, H);
}

export const course: Jeu = {
  id: "course",
  nom: "Course de véhicules",
  icone: "🏎️",
  description:
    "3 tours de circuit, vue derrière la voiture. Le meilleur temps gagne (120 s maximum).",
  aide: ["Z / ↑ : accélérer", "S / ↓ : freiner", "Q D / ← → : tourner", "Espace : turbo"],
  boutons: { a: "Turbo", haut: "Gaz", bas: "Frein" },
  largeur: L,
  hauteur: H,
  creer,
  pas,
  termine,
  finir,
  dessiner,
};
