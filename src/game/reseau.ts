import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { auteurApprouve } from "./admins";
import { lireOrganisation, type Organisation } from "./organisation";
import {
  nettoyerQuestions,
  type QuestionQuiz,
} from "../../supabase/functions/generer-quiz/handler";

/**
 * Réseau Isitech : cours, fichiers et catégories, stockés dans la table "courses" existante (aucune migration nécessaire).
 *  - un cours      : type = nom de la catégorie, text = JSON { v: 3, description, contenu, fichier? }
 *  - un fichier    : ligne à part (type "__fichier__") qui contient le fichier encodé, relié au cours par "ref"
 *  - une catégorie : ligne (type "__categorie__") dont le titre est le nom de la catégorie
 * Les cours créés avant la V3 (texte simple) restent lisibles.
 */
export const TYPE_CATEGORIE = "__categorie__";
export const TYPE_FICHIER = "__fichier__";
export const TYPE_ANNONCE = "__annonce__";
export const TYPE_ORG = "__organisation__";
export const TYPE_QUIZ = "__quiz__";
export const TAILLE_MAX = 2 * 1024 * 1024;
export const FORMATS = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg,.gif,.zip";

export type FichierMeta = { nom: string; mime: string; taille: number; ref: string };
export type CoursReseau = {
  id: string;
  titre: string;
  categorie: string;
  auteurId: string;
  auteur: string;
  date: string;
  description: string;
  contenu: string;
  fichier?: FichierMeta;
};
export type CategorieReseau = {
  id: string;
  nom: string;
  auteurId: string;
  auteur: string;
  date: string;
};
export type AnnonceReseau = {
  id: string;
  titre: string;
  corps: string;
  auteurId: string;
  auteur: string;
  date: string;
};
export type QuizReseau = {
  id: string;
  coursId: string;
  auteurId: string;
  auteur: string;
  date: string;
  source: "ia" | "manuel";
  questions: QuestionQuiz[];
};
export type Reseau = {
  cours: CoursReseau[];
  categories: CategorieReseau[];
  annonces: AnnonceReseau[];
  organisation: Organisation | null;
  quiz: QuizReseau[];
};

type Charge = { v: 3; description: string; contenu: string; fichier?: FichierMeta };

function lire(texte: string): Charge {
  try {
    const j = JSON.parse(texte) as Partial<Charge>;
    if (j && j.v === 3)
      return {
        v: 3,
        description: j.description ?? "",
        contenu: j.contenu ?? "",
        ...(j.fichier ? { fichier: j.fichier } : {}),
      };
  } catch {
    /* texte simple d'une ancienne version */
  }
  return { v: 3, description: "", contenu: texte };
}

type Ligne = {
  id: string;
  title: string;
  type: string;
  text: string;
  author_id: string;
  created_at: string;
};

/** Transforme les lignes de la table en cours, annonces, quiz et organisation. Seuls les admins sont crus pour l'organisation et les annonces. */
export function assembler(lignes: readonly Ligne[], pseudos: ReadonlyMap<string, string>): Reseau {
  const auteur = (id: string) => pseudos.get(id) ?? "Inconnu";
  const cours: CoursReseau[] = [],
    categories: CategorieReseau[] = [],
    annonces: AnnonceReseau[] = [],
    quiz: QuizReseau[] = [];
  let organisation: Organisation | null = null,
    dateOrg = "";
  for (const r of lignes) {
    const base = {
      id: r.id,
      auteurId: r.author_id,
      auteur: auteur(r.author_id),
      date: r.created_at,
    };
    if (r.type === TYPE_CATEGORIE) {
      categories.push({ ...base, nom: r.title });
      continue;
    }
    if (r.type === TYPE_ANNONCE) {
      if (auteurApprouve(r.author_id, pseudos.get(r.author_id)))
        annonces.push({ ...base, titre: r.title, corps: r.text });
      continue;
    }
    if (r.type === TYPE_ORG) {
      // l'organisation la plus récente écrite par un admin fait foi
      if (auteurApprouve(r.author_id, pseudos.get(r.author_id)) && r.created_at > dateOrg) {
        const o = lireOrganisation(r.text);
        if (o) {
          organisation = o;
          dateOrg = r.created_at;
        }
      }
      continue;
    }
    if (r.type === TYPE_QUIZ) {
      try {
        const j = JSON.parse(r.text) as { source?: string; questions?: unknown };
        const questions = nettoyerQuestions(j.questions, 30);
        if (questions.length)
          quiz.push({
            ...base,
            coursId: r.title,
            source: j.source === "ia" ? "ia" : "manuel",
            questions,
          });
      } catch {
        /* quiz illisible : ignoré */
      }
      continue;
    }
    const c = lire(r.text);
    cours.push({
      ...base,
      titre: r.title,
      categorie: r.type,
      description: c.description,
      contenu: c.contenu,
      ...(c.fichier ? { fichier: c.fichier } : {}),
    });
  }
  return { cours, categories, annonces, organisation, quiz };
}

export async function chargerReseau(): Promise<Reseau> {
  const { data, error } = await supabase
    .from("courses")
    .select("id,title,type,text,author_id,created_at")
    .neq("type", TYPE_FICHIER)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = [...new Set(data.map((c) => c.author_id))];
  const { data: ps } = ids.length
    ? await supabase.from("profiles").select("id,pseudo").in("id", ids)
    : { data: [] };
  return assembler(data, new Map((ps ?? []).map((p) => [p.id, p.pseudo])));
}

export const useReseau = () => useQuery({ queryKey: ["reseau"], queryFn: chargerReseau });

const versDataUrl = (f: File) =>
  new Promise<string>((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => ko(new Error("Lecture du fichier impossible"));
    r.readAsDataURL(f);
  });

export async function deposerCours(
  auteurId: string,
  c: {
    titre: string;
    categorie: string;
    description: string;
    contenu: string;
    fichier?: File | null;
  },
) {
  let meta: FichierMeta | undefined;
  if (c.fichier) {
    if (c.fichier.size > TAILLE_MAX) throw new Error("Le fichier dépasse 2 Mo.");
    const data = await versDataUrl(c.fichier);
    const { data: ligne, error } = await supabase
      .from("courses")
      .insert({
        author_id: auteurId,
        title: c.fichier.name.slice(0, 120),
        type: TYPE_FICHIER,
        text: data,
      })
      .select("id")
      .single();
    if (error) throw error;
    meta = {
      nom: c.fichier.name,
      mime: c.fichier.type || "application/octet-stream",
      taille: c.fichier.size,
      ref: ligne.id,
    };
  }
  const charge: Charge = {
    v: 3,
    description: c.description,
    contenu: c.contenu,
    ...(meta ? { fichier: meta } : {}),
  };
  const { error } = await supabase.from("courses").insert({
    author_id: auteurId,
    title: c.titre,
    type: c.categorie,
    text: JSON.stringify(charge),
  });
  if (error) {
    if (meta) await supabase.from("courses").delete().eq("id", meta.ref);
    throw error;
  }
}

export async function supprimerCours(c: CoursReseau) {
  const { error } = await supabase.from("courses").delete().eq("id", c.id);
  if (error) throw error;
  if (c.fichier) await supabase.from("courses").delete().eq("id", c.fichier.ref);
}

export async function chargerFichier(ref: string): Promise<string> {
  const { data, error } = await supabase.from("courses").select("text").eq("id", ref).single();
  if (error) throw error;
  return data.text;
}

export async function creerCategorie(auteurId: string, nom: string) {
  const { error } = await supabase.from("courses").insert({
    author_id: auteurId,
    title: nom.trim().slice(0, 40),
    type: TYPE_CATEGORIE,
    text: "",
  });
  if (error) throw error;
}
export async function supprimerCategorie(id: string) {
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw error;
}

export const formaterTaille = (o: number) =>
  o < 1024 * 1024
    ? `${Math.max(1, Math.round(o / 1024))} Ko`
    : `${(o / 1024 / 1024).toFixed(1)} Mo`;
export const formaterDate = (d: string) =>
  new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Annonces du tableau d'affichage (même table, type "__annonce__"). */
export async function publierAnnonce(auteurId: string, titre: string, corps: string) {
  const { error } = await supabase.from("courses").insert({
    author_id: auteurId,
    title: titre.trim().slice(0, 100),
    type: TYPE_ANNONCE,
    text: corps.trim().slice(0, 1000),
  });
  if (error) throw error;
}
export async function supprimerAnnonce(id: string) {
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw error;
}

/** Publie une nouvelle version de l'organisation (admin) et supprime les anciennes versions du même admin. */
export async function publierOrganisation(auteurId: string, org: Organisation) {
  const { data, error } = await supabase
    .from("courses")
    .insert({
      author_id: auteurId,
      title: "Organisation du réseau",
      type: TYPE_ORG,
      text: JSON.stringify(org),
    })
    .select("id")
    .single();
  if (error) throw error;
  await supabase
    .from("courses")
    .delete()
    .eq("author_id", auteurId)
    .eq("type", TYPE_ORG)
    .neq("id", data.id);
}

/** Enregistre un quiz pour un cours (écrit à la main ou généré par l'IA puis relu). */
export async function creerQuiz(
  auteurId: string,
  coursId: string,
  questions: QuestionQuiz[],
  source: "ia" | "manuel",
) {
  const q = nettoyerQuestions(questions, 30);
  if (!q.length) throw new Error("Aucune question valide.");
  const { error } = await supabase.from("courses").insert({
    author_id: auteurId,
    title: coursId,
    type: TYPE_QUIZ,
    text: JSON.stringify({ source, questions: q }),
  });
  if (error) throw error;
}
export async function supprimerQuiz(id: string) {
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw error;
}
