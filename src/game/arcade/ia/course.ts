import { aleatoire, borne } from "../moteur";
import { courbure, VMAX, type EtatCourse } from "../jeux/course";
import {
  ecartBoucle,
  LIMITE_INTERIEURE,
  LONGUEUR_TOUR,
  MURET,
  OBSTACLES,
  forkA,
  prochainFork,
  FORKS,
} from "../jeux/circuit";
import { BTN, type EtatBase } from "../types";
import type { Cerveau } from "./outils";

/**
 * Bot de la course : suit une trajectoire (le centre de la route, légèrement vers l'intérieur des virages),
 * choisit une voie à chaque embranchement, contourne plots, blocs, flaques d'huile et voitures,
 * vise les dalles de boost et utilise le turbo quand la route est dégagée.
 * Il ne freine jamais sur une autre voiture (alliée ou non) : il se décale.
 */
export function cerveauCourse(id: string, graine: number): Cerveau {
  const rnd = aleatoire(graine);
  const memoire = {
    attente: 0,
    entree: 0,
    bruit: 0,
    bruitCible: 0,
    voies: new Map<string, "A" | "B">(),
  };
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
    let mini = -0.85;
    let maxi = 0.85;

    // Embranchement : on choisit une voie (une fois par embranchement et par tour) et on s'y tient.
    const fork = prochainFork(moi.z, 100);
    if (fork) {
      const tour = Math.floor(moi.z / LONGUEUR_TOUR);
      const cle = `${tour}-${FORKS.indexOf(fork)}`;
      if (!memoire.voies.has(cle)) memoire.voies.set(cle, rnd() < 0.5 ? "A" : "B");
      if (memoire.voies.get(cle) === "A") {
        cible = -0.5;
        mini = -0.92;
        maxi = -(MURET + 0.12);
      } else {
        cible = 0.36;
        mini = MURET + 0.12;
        maxi = LIMITE_INTERIEURE - 0.1;
      }
    }

    // Obstacles devant : on se décale si l'on est sur leur trajectoire ; on vise les dalles de boost.
    let proche = Infinity;
    let degage = true;
    for (const o of OBSTACLES) {
      const dz = -ecartBoucle(moi.z, o.z);
      if (dz < 3 || dz > 55) continue;
      if (o.type === "boost") {
        if (Math.abs(o.x - cible) < 0.45 && o.x >= mini && o.x <= maxi && dz < proche) cible = o.x;
        continue;
      }
      if (Math.abs(cible - o.x) < o.w / 2 + 0.16) {
        degage = false;
        if (dz < proche) {
          proche = dz;
          const cote = cible >= o.x ? 1 : -1;
          const evite = o.x + cote * (o.w / 2 + 0.2);
          cible = evite >= mini && evite <= maxi ? evite : o.x - cote * (o.w / 2 + 0.2);
        }
      }
    }

    // Voiture lentement devant nous : on prend le côté le plus libre.
    for (const autre of s.v) {
      if (autre.id === id) continue;
      const dz = autre.z - moi.z;
      if (dz > 0 && dz < 30 && Math.abs(autre.x - moi.x) < 0.34) {
        const aDroite = autre.x + 0.45;
        const aGauche = autre.x - 0.45;
        const choix = Math.abs(aDroite) <= Math.abs(aGauche) ? aDroite : aGauche;
        cible = choix >= mini && choix <= maxi ? choix : autre.x < 0 ? aDroite : aGauche;
        break;
      }
    }
    cible = borne(cible, mini, maxi);

    const ecart = cible - moi.x;
    const braque = ecart > 0.07 ? BTN.droite : ecart < -0.07 ? BTN.gauche : 0;
    // On lâche les gaz (sans freiner) quand on est trop près du bord à vive allure, ou au-delà de son rythme.
    const plafond = VMAX * rythme * (moi.nitro > 0 || moi.boost > 0 ? 1.3 : 1);
    const horsVoie = forkA(moi.z)
      ? moi.x < mini - 0.1 || moi.x > maxi + 0.1
      : Math.abs(moi.x) > 0.85;
    const leve = (horsVoie && moi.v > 38) || moi.v > plafond;
    let e = (leve ? 0 : BTN.haut) | braque;
    // Turbo : route dégagée, bien placé, turbo prêt.
    if (
      moi.nitroCd <= 0 &&
      degage &&
      Math.abs(c1) < 0.8 &&
      Math.abs(c2) < 0.8 &&
      Math.abs(moi.x) < 0.4
    )
      e |= BTN.a;

    memoire.entree = e;
    return e;
  };
}
