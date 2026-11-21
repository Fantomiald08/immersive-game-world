import { aleatoire } from "../moteur";
import { ARENES, ARMES, PORTEE_POING, RAYON, type EtatArene, type PersoArene } from "../jeux/arene";
import { BTN, viser, type EtatBase } from "../types";
import { bitsDirection, distance, projeter, segmentBloque, type Cerveau } from "./outils";

/** Distance à laquelle l'ordinateur aime se battre, selon l'arme. */
const DISTANCE_IDEALE = {
  poing: 24,
  pistolet: 190,
  mitraillette: 150,
  pompe: 90,
  sniper: 320,
} as const;

/**
 * Bot de l'arène : ramasse une arme (ou un soin), puis poursuit l'adversaire le plus proche,
 * garde sa distance idéale, tire quand la ligne est dégagée et esquive quand il est blessé.
 * Il ne vise jamais un coéquipier et ne tire pas si un coéquipier est sur la ligne de tir.
 */
export function cerveauArene(id: string, graine: number): Cerveau {
  const rnd = aleatoire(graine);
  const memoire = {
    attente: 0,
    entree: 0,
    strafe: 1 as 1 | -1,
    changeStrafe: 0,
    x: 0,
    y: 0,
    immobile: 0,
    detour: 0,
    detourSens: 1 as 1 | -1,
  };

  return (base: EtatBase, dt: number) => {
    const s = base as EtatArene;
    const i = s.joueurs.findIndex((j) => j.id === id);
    const moi = s.p[i];
    if (!moi || moi.respawn > 0 || s.entracte > 0) return 0;

    // Temps de réaction : une décision toutes les ~0.13 s, entre-temps on garde la dernière.
    memoire.attente -= dt;
    memoire.changeStrafe -= dt;
    memoire.detour -= dt;
    const bouge = distance(moi.x, moi.y, memoire.x, memoire.y);
    memoire.immobile = bouge < 0.6 ? memoire.immobile + dt : 0;
    memoire.x = moi.x;
    memoire.y = moi.y;
    if (memoire.attente > 0) return memoire.entree;
    memoire.attente = 0.1 + rnd() * 0.07;
    if (memoire.changeStrafe <= 0) {
      memoire.strafe = rnd() < 0.5 ? 1 : -1;
      memoire.changeStrafe = 0.7 + rnd() * 1.1;
    }

    const equipe = s.joueurs[i]!.equipe;
    const murs = ARENES[Math.min(s.manche, ARENES.length - 1)]!.murs;
    const ennemis: PersoArene[] = [];
    const allies: PersoArene[] = [];
    s.p.forEach((q, k) => {
      if (q.id === id || q.respawn > 0 || s.joueurs[k]!.absent) return;
      (s.joueurs[k]!.equipe === equipe ? allies : ennemis).push(q);
    });
    const cible = ennemis.reduce<PersoArene | null>(
      (m, q) => (!m || distance(moi.x, moi.y, q.x, q.y) < distance(moi.x, moi.y, m.x, m.y) ? q : m),
      null,
    );
    const dCible = cible ? distance(moi.x, moi.y, cible.x, cible.y) : Infinity;

    // 1) Ramasser : une arme si on a les poings (ou presque plus de munitions), un soin si on est blessé.
    const besoinArme = moi.arme === "poing" || moi.munitions <= 3;
    const besoinSoin = moi.pv < 45;
    let objet = null as { x: number; y: number } | null;
    if (besoinSoin || besoinArme) {
      let meilleur = Infinity;
      for (const o of s.objets) {
        const veut = besoinSoin ? o.type === "soin" : o.type !== "soin";
        if (!veut) continue;
        const d = distance(moi.x, moi.y, o.x, o.y);
        if (d < meilleur && d < 380) {
          meilleur = d;
          objet = o;
        }
      }
    }
    // Un adversaire collé à nous passe avant le ramassage, sauf si on n'a que les poings.
    const urgence = cible !== null && dCible < 90 && moi.arme !== "poing";

    // Direction voulue (vecteur), transformée en touches à la fin.
    let vx = 0;
    let vy = 0;
    let bouton = 0;
    if (objet && !urgence) {
      vx = objet.x - moi.x;
      vy = objet.y - moi.y;
    }
    if (cible && !(objet && !urgence)) {
      const ideal = DISTANCE_IDEALE[moi.arme];
      const ux = (cible.x - moi.x) / (dCible || 1);
      const uy = (cible.y - moi.y) / (dCible || 1);
      if (dCible > ideal + 30) {
        vx = ux;
        vy = uy;
      } else if (dCible < ideal - 45 && moi.arme !== "poing") {
        vx = -ux;
        vy = -uy;
      } else {
        // Dans la bonne zone : on se déplace sur le côté pour être moins facile à toucher.
        vx = -uy * memoire.strafe;
        vy = ux * memoire.strafe;
      }
    }

    // 2) Tirer : arme visible, à portée, sans mur ni coéquipier sur la ligne.
    if (cible) {
      const def = ARMES[moi.arme];
      const portee = moi.arme === "poing" ? PORTEE_POING + RAYON : def.vitesse * def.vie * 0.9;
      const visible = !segmentBloque(moi.x, moi.y, cible.x, cible.y, murs);
      const ligneLibre = !allies.some((a) => {
        const p = projeter(a.x, a.y, moi.x, moi.y, cible.x, cible.y);
        return p.t > 0 && p.t < 1 && p.dist < RAYON + 6;
      });
      if (dCible <= portee && visible && ligneLibre && rnd() < 0.82) {
        // Petite erreur de visée : plus grande de loin, pour rester battable.
        const erreur = (rnd() - 0.5) * (0.05 + dCible / 2500);
        bouton = BTN.a | viser(Math.atan2(cible.y - moi.y, cible.x - moi.x) + erreur);
      }
      // 3) Esquive : blessé et collé à un adversaire.
      if (moi.pv < 40 && dCible < 120 && moi.dash <= 0 && rnd() < 0.4) bouton |= BTN.b;
    }

    // Coincé contre un mur : on contourne un instant en tournant la direction de 90°.
    if (memoire.immobile > 0.35 && (vx || vy)) {
      memoire.detour = 0.5;
      memoire.detourSens = rnd() < 0.5 ? 1 : -1;
      memoire.immobile = 0;
    }
    if (memoire.detour > 0 && (vx || vy)) {
      const sens = memoire.detourSens;
      [vx, vy] = [-vy * sens, vx * sens];
    }

    memoire.entree = bitsDirection(vx, vy) | bouton;
    return memoire.entree;
  };
}
