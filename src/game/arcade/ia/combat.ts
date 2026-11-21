import { aleatoire } from "../moteur";
import { ATTAQUES, SOL, type Combattant, type EtatCombat } from "../jeux/combat";
import { BTN, type EtatBase } from "../types";
import type { Cerveau } from "./outils";

type Mode = "approche" | "attaque" | "garde" | "saut" | "recule" | "special";

/**
 * Bot du combat 2D : s'approche de l'adversaire le plus proche, attaque à bonne distance,
 * se met en garde quand on l'attaque, saute les boules d'énergie et lance son spécial de loin.
 * Il n'attaque jamais un coéquipier (il ne choisit que des cibles d'une autre équipe).
 */
export function cerveauCombat(id: string, graine: number): Cerveau {
  const rnd = aleatoire(graine);
  const memoire = { attente: 0, mode: "approche" as Mode, duree: 0, entree: 0, sens: 1 as 1 | -1 };

  return (base: EtatBase, dt: number) => {
    const s = base as EtatCombat;
    const i = s.joueurs.findIndex((j) => j.id === id);
    const moi = s.f[i];
    if (!moi || moi.ko || s.entracte > 0) return 0;

    memoire.attente -= dt;
    memoire.duree -= dt;
    if (memoire.attente > 0) return memoire.entree;
    memoire.attente = 0.12 + rnd() * 0.1;

    const equipe = s.joueurs[i]!.equipe;
    let cible: Combattant | null = null;
    s.f.forEach((q, k) => {
      if (q.ko || s.joueurs[k]!.equipe === equipe || s.joueurs[k]!.absent) return;
      if (!cible || Math.abs(q.x - moi.x) < Math.abs(cible.x - moi.x)) cible = q;
    });
    const ennemi = cible as Combattant | null;
    if (!ennemi) return 0;

    const dx = ennemi.x - moi.x;
    const dist = Math.abs(dx);
    const vers: 1 | -1 = dx >= 0 ? 1 : -1;
    const auSol = moi.y >= SOL - 1;

    // Danger : l'adversaire est en train de frapper de près, ou une boule d'énergie arrive.
    const frappe =
      ennemi.atk && ennemi.atk.type !== "c" && dist < ATTAQUES[ennemi.atk.type].portee + 40;
    const boule = s.boules.find(
      (b) =>
        b.eq !== equipe &&
        Math.abs(b.x - moi.x) < 190 &&
        b.vx > 0 === moi.x > b.x &&
        b.y > moi.y - 100 &&
        b.y < moi.y,
    );

    // On ne change de comportement qu'à la fin du précédent, sauf en cas de danger.
    if (
      memoire.duree <= 0 ||
      ((frappe || boule) && memoire.mode !== "garde" && memoire.mode !== "saut")
    ) {
      if (frappe && auSol && rnd() < 0.55) {
        memoire.mode = "garde";
        memoire.duree = 0.35 + rnd() * 0.25;
      } else if (boule && auSol && rnd() < 0.6) {
        memoire.mode = "saut";
        memoire.duree = 0.3;
      } else if (dist > 300 && moi.cdSpecial <= 0 && !moi.atk && rnd() < 0.5) {
        memoire.mode = "special";
        memoire.duree = 0.3;
      } else if (dist > 88) {
        memoire.mode = "approche";
        memoire.duree = 0.15 + rnd() * 0.2;
      } else if (rnd() < 0.2) {
        memoire.mode = "recule";
        memoire.duree = 0.25 + rnd() * 0.25;
        memoire.sens = vers === 1 ? -1 : 1;
      } else {
        memoire.mode = "attaque";
        memoire.duree = 0.2;
      }
    }

    let e = 0;
    switch (memoire.mode) {
      case "approche":
        e = vers === 1 ? BTN.droite : BTN.gauche;
        // Petit saut de temps en temps pour surprendre.
        if (auSol && dist > 150 && rnd() < 0.04) e |= BTN.haut;
        break;
      case "recule":
        e = memoire.sens === 1 ? BTN.droite : BTN.gauche;
        break;
      case "garde":
        e = BTN.bas;
        break;
      case "saut":
        e = BTN.haut;
        break;
      case "special":
        e = BTN.c;
        break;
      case "attaque":
        // Poing de près, pied un peu plus loin ; parfois on rate (hésitation).
        if (rnd() < 0.12) e = 0;
        else if (dist < 62) e = rnd() < 0.6 ? BTN.a : BTN.b;
        else e = BTN.b;
        // Trop loin pour toucher : on avance en même temps.
        if (dist > 70) e |= vers === 1 ? BTN.droite : BTN.gauche;
        break;
    }
    memoire.entree = e;
    return e;
  };
}
