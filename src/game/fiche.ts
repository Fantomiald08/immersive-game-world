/**
 * Fiche de révision générée par l'IA à partir d'un cours.
 * Module pur (aucun import serveur) : la validation est testée à part.
 * Une fiche est une ligne de la table « courses » de type « __fiche__ », titre = identifiant du cours.
 */
export const TYPE_FICHE = "__fiche__";

export type NotionFiche = { titre: string; texte: string };
export type FicheRevision = {
  titre: string;
  resume: string[];
  notions: NotionFiche[];
  pieges: string[];
  aRetenir: string[];
};

const LIMITES = { resume: 8, notions: 10, pieges: 6, aRetenir: 8 } as const;

/** Texte court et propre : espaces réduits, longueur bornée, vide => null. */
function texte(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim().slice(0, max);
  return t.length > 0 ? t : null;
}

/** Valide une fiche venue de l'IA ou de la base : renvoie null si elle n'a ni titre ni contenu exploitable. */
export function nettoyerFiche(brut: unknown): FicheRevision | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const titre = texte(o["titre"], 120);
  const liste = (v: unknown, max: number, n: number): string[] =>
    Array.isArray(v)
      ? v.map((x) => texte(x, max)).filter((x): x is string => x !== null).slice(0, n)
      : [];
  const notions: NotionFiche[] = Array.isArray(o["notions"])
    ? o["notions"]
        .flatMap((x) => {
          if (!x || typeof x !== "object") return [];
          const n = x as Record<string, unknown>;
          const t = texte(n["titre"], 80);
          const d = texte(n["texte"], 400);
          return t && d ? [{ titre: t, texte: d }] : [];
        })
        .slice(0, LIMITES.notions)
    : [];
  const resume = liste(o["resume"], 240, LIMITES.resume);
  if (!titre || (resume.length === 0 && notions.length === 0)) return null;
  return {
    titre,
    resume,
    notions,
    pieges: liste(o["pieges"], 240, LIMITES.pieges),
    aRetenir: liste(o["aRetenir"], 200, LIMITES.aRetenir),
  };
}

/** Lit le texte stocké en base ; renvoie null si le contenu est illisible. */
export function lireFiche(contenu: string): FicheRevision | null {
  try {
    return nettoyerFiche(JSON.parse(contenu));
  } catch {
    return null;
  }
}
