import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TYPE_FICHE, lireFiche } from "./fiche";

/**
 * Crée la fiche de révision d'un cours que l'on a déposé. Lit le texte enregistré côté serveur
 * (jamais celui envoyé par le navigateur) et ne renvoie une fiche existante que si elle est valide.
 */
export const genererFicheRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ coursId: z.string().uuid(), regenerer: z.boolean().default(false) }))
  .handler(async ({ data, context }) => {
    const { data: cours, error } = await context.supabase
      .from("courses")
      .select("id,type,text,author_id")
      .eq("id", data.coursId)
      .single();
    if (error || !cours || cours.author_id !== context.userId || cours.type.startsWith("__"))
      throw new Error("Tu peux générer une fiche uniquement pour tes propres cours.");

    const existantes = await context.supabase
      .from("courses")
      .select("id,text,created_at")
      .eq("type", TYPE_FICHE)
      .eq("title", cours.id)
      .eq("author_id", context.userId)
      .order("created_at", { ascending: false });
    if (existantes.error) throw existantes.error;
    const deja = (existantes.data ?? []).map((f) => ({ id: f.id, fiche: lireFiche(f.text) })).find((f) => f.fiche);
    if (deja?.fiche && !data.regenerer) return { ficheId: deja.id, fiche: deja.fiche };

    let contenu = cours.text;
    try {
      const charge = JSON.parse(cours.text);
      if (charge.v === 3) contenu = [charge.description, charge.contenu].filter(Boolean).join("\n");
    } catch {
      /* Cours en texte brut (ancien format). */
    }
    if (contenu.trim().length < 80) throw new Error("Ajoute au moins 80 caractères de texte au cours pour générer sa fiche.");

    const { genererFicheCours } = await import("@/lib/quiz-ai/generer.server");
    const fiche = await genererFicheCours(contenu);
    const { data: ligne, error: erreurEcriture } = await context.supabase
      .from("courses")
      .insert({ author_id: context.userId, title: cours.id, type: TYPE_FICHE, text: JSON.stringify(fiche) })
      .select("id")
      .single();
    if (erreurEcriture) throw erreurEcriture;
    return { ficheId: ligne.id, fiche };
  });
