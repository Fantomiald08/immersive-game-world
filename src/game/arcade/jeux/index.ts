import type { Jeu, JeuId } from "../types";
import { arene } from "./arene";
import { combat } from "./combat";
import { course } from "./course";

/**
 * Catalogue des mini-jeux. Pour en ajouter un : écrire un module qui respecte l'interface `Jeu`
 * (voir ../types.ts), ajouter son identifiant à `JeuId` et l'enregistrer ici.
 */
export const JEUX: Record<JeuId, Jeu> = { arene, course, combat };
export const LISTE_JEUX: Jeu[] = [arene, course, combat];
