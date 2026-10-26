import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Réseau Isitech : cours, fichiers et catégories, stockés dans la table "courses" existante (aucune migration nécessaire).
 *  - un cours      : type = nom de la catégorie, text = JSON { v: 3, description, contenu, fichier? }
 *  - un fichier    : ligne à part (type "__fichier__") qui contient le fichier encodé, relié au cours par "ref"
 *  - une catégorie : ligne (type "__categorie__") dont le titre est le nom de la catégorie
 * Les cours créés avant la V3 (texte simple) restent lisibles.
 */
export const TYPE_CATEGORIE = "__categorie__";
export const TYPE_FICHIER = "__fichier__";
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
export type Reseau = { cours: CoursReseau[]; categories: CategorieReseau[] };

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
  const noms = new Map((ps ?? []).map((p) => [p.id, p.pseudo]));
  const auteur = (id: string) => noms.get(id) ?? "Inconnu";
  const cours: CoursReseau[] = [],
    categories: CategorieReseau[] = [];
  for (const r of data) {
    if (r.type === TYPE_CATEGORIE) {
      categories.push({
        id: r.id,
        nom: r.title,
        auteurId: r.author_id,
        auteur: auteur(r.author_id),
        date: r.created_at,
      });
      continue;
    }
    const c = lire(r.text);
    cours.push({
      id: r.id,
      titre: r.title,
      categorie: r.type,
      auteurId: r.author_id,
      auteur: auteur(r.author_id),
      date: r.created_at,
      description: c.description,
      contenu: c.contenu,
      ...(c.fichier ? { fichier: c.fichier } : {}),
    });
  }
  return { cours, categories };
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
