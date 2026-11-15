/**
 * ADMINS DU JEU
 * -------------
 * Les admins gèrent les catégories du réseau cours, valident les quiz, masquent des cours et publient des annonces.
 *
 * Pour ajouter un admin : mets son IDENTIFIANT DE COMPTE dans ADMIN_IDS (la personne le voit dans ⚙ Paramètres → « Mon compte »),
 * puis envoie le fichier sur GitHub. Un identifiant ne peut pas être imité, contrairement à un pseudo.
 *
 * Tant que ADMIN_IDS est vide, le jeu est en MODE PROVISOIRE : les pseudos de ADMINS_PROVISOIRES sont reconnus
 * (pratique pour démarrer, mais un élève pourrait prendre le même pseudo). Remplis ADMIN_IDS dès que possible.
 *
 * Pour que l'IA puisse aussi reconnaître les admins, ajoute les mêmes identifiants (séparés par des virgules)
 * dans le secret ADMIN_IDS de Lovable (Cloud → Secrets).
 */
export const ADMIN_IDS: string[] = [];
export const ADMINS_PROVISOIRES: string[] = ["Leo Dupire"];

export const modeProvisoire = () => ADMIN_IDS.length === 0;

const memePseudo = (a: string, b: string) =>
  a.localeCompare(b, "fr", { sensitivity: "base" }) === 0;

/** Cette personne est-elle admin ? */
export function estAdmin(p: { id: string; pseudo: string }): boolean {
  return modeProvisoire()
    ? ADMINS_PROVISOIRES.some((a) => memePseudo(a, p.pseudo))
    : ADMIN_IDS.includes(p.id);
}

/** Faut-il faire confiance à ce que cet auteur a publié (organisation, annonces, quiz officiels) ? */
export function auteurApprouve(id: string, pseudo: string | undefined): boolean {
  return estAdmin({ id, pseudo: pseudo ?? "" });
}
