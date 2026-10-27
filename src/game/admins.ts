/**
 * Pseudos autorisés à publier des annonces sur le tableau d'affichage de l'accueil.
 * Ajoute ici le pseudo exact des délégués / professeurs (majuscules et accents ignorés).
 * Remarque : cette vérification est faite dans le navigateur ; pour une sécurité totale il faudra plus tard
 * un vrai système de rôles côté base de données.
 */
export const ADMINS: string[] = ["Leo Dupire"];
export const estAdmin = (pseudo: string) =>
  ADMINS.some((a) => a.localeCompare(pseudo, "fr", { sensitivity: "base" }) === 0);
