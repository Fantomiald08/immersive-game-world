import type { JeuId } from "../types";
import { cerveauArene } from "./arene";
import { cerveauCombat } from "./combat";
import { cerveauCourse } from "./course";
import type { Cerveau } from "./outils";

export type { Cerveau } from "./outils";

/**
 * Crée le cerveau d'un joueur ordinateur pour un mini-jeu. Pour ajouter l'IA d'un nouveau jeu :
 * écrire un module qui renvoie un `Cerveau` et l'ajouter ici.
 */
export function creerCerveau(jeu: JeuId, id: string, graine: number): Cerveau {
  switch (jeu) {
    case "arene":
      return cerveauArene(id, graine);
    case "course":
      return cerveauCourse(id, graine);
    case "combat":
      return cerveauCombat(id, graine);
  }
}
