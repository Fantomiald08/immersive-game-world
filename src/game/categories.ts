/** Catégories de cours (champ "type" de la table courses) et titres par niveau. */
export const CATEGORIES = [
  "Réseaux",
  "Windows/AD",
  "Linux",
  "Virtualisation",
  "Sécurité",
  "DNS/DHCP",
  "Supervision/GLPI",
  "Cybersécurité",
  "Cloud",
  "Autre",
] as const;

/** Niveau (1, 2, 3…) → titre affiché dans le HUD. Modifie ces paliers à ta guise. */
export function titreNiveau(niveau: number): string {
  if (niveau >= 17) return "Légende SISR";
  if (niveau >= 12) return "Architecte";
  if (niveau >= 8) return "Ingénieur";
  if (niveau >= 5) return "Admin réseau";
  if (niveau >= 3) return "Technicien";
  return "Recrue";
}
