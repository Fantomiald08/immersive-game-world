import { aleatoire, borne } from "../moteur";
import { courbure, VMAX, type EtatCourse } from "../jeux/course";
import { BTN, type EtatBase } from "../types";
import type { Cerveau } from "./outils";

/**
 * Bot de la course : suit une trajectoire (le centre de la route, légèrement vers l'intérieur des virages),
 * regarde les virages à venir, contourne les voitures devant lui et utilise le turbo en ligne droite.
 * Il ne freine jamais sur une autre voiture (alliée ou non) : il se décale.
 */
export function cerveauCourse(id: string, graine: number): Cerveau {
  const rnd = aleatoire(graine);
  const memoire = { attente: 0, entree: 0, bruit: 0, bruitCible: 0 };
  // Chaque bot a son rythme : il roule à 84-94 % de la vitesse max, donc un bon pilote humain peut le battre.
  const rythme = 0.84 + rnd() * 0.1;

  return (base: EtatBase, dt: number) => {
    const s = base as EtatCourse;
    const i = s.joueurs.findIndex((j) => j.id === id);
    const moi = s.v[i];
    if (!moi || moi.fin >= 0) return 0;

    memoire.attente -= dt;
    // Le « bruit » est un petit écart de trajectoire qui change lentement : le bot ne roule pas sur des rails.
    memoire.bruit += (memoire.bruitCible - memoire.bruit) * Math.min(1, dt * 1.5);
    if (memoire.attente > 0) return memoire.entree;
    memoire.attente = 0.05 + rnd() * 0.05;
    if (rnd() < 0.08) memoire.bruitCible = (rnd() - 0.5) * 0.2;

    // Points de passage : la courbure juste devant et un peu plus loin.
    const c1 = courbure(moi.z + 30);
    const c2 = courbure(moi.z + 90);
    const virage = Math.abs(c1) >= Math.abs(c2) ? c1 : c2;
    let cible = 0.28 * virage + memoire.bruit;

    // Voiture lentement devant nous : on prend le côté le plus libre.
    for (const autre of s.v) {
      if (autre.id === id) continue;
      const dz = autre.z - moi.z;
      if (dz > 0 && dz < 30 && Math.abs(autre.x - moi.x) < 0.34) {
        const aDroite = autre.x + 0.45;
        const aGauche = autre.x - 0.45;
        const choix = Math.abs(aDroite) <= Math.abs(aGauche) ? aDroite : aGauche;
        cible = Math.abs(choix) <= 0.85 ? choix : autre.x < 0 ? aDroite : aGauche;
        break;
      }
    }
    cible = borne(cible, -0.85, 0.85);

    const ecart = cible - moi.x;
    const braque = ecart > 0.07 ? BTN.droite : ecart < -0.07 ? BTN.gauche : 0;
    // On lâche les gaz (sans freiner) quand on est trop près du bord à vive allure.
    const plafond = VMAX * rythme * (moi.nitro > 0 ? 1.3 : 1);
    const leve = (Math.abs(moi.x) > 0.85 && moi.v > 38) || moi.v > plafond;
    let e = (leve ? 0 : BTN.haut) | braque;
    // Turbo : droite longue, bien centré, turbo prêt.
    if (moi.nitroCd <= 0 && Math.abs(c1) < 0.2 && Math.abs(c2) < 0.2 && Math.abs(moi.x) < 0.35)
      e |= BTN.a;

    memoire.entree = e;
    return e;
  };
}
