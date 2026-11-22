import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Reads the saved course as the caller, never trusting submitted course text or author IDs. */
export const genererQuizAutomatique = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ coursId: z.string().uuid(), nombre: z.number().int().min(3).max(15).default(8), enregistrer: z.boolean().default(true) }))
  .handler(async ({ data, context }) => {
    const { data: cours, error } = await context.supabase.from("courses")
      .select("id,title,type,text,author_id").eq("id", data.coursId).single();
    if (error || !cours || cours.author_id !== context.userId || cours.type.startsWith("__"))
      throw new Error("Tu peux générer un quiz uniquement pour tes propres cours.");
    const existants = await context.supabase.from("courses").select("id,text")
      .eq("type", "__quiz__").eq("title", cours.id).eq("author_id", context.userId);
    if (existants.error) throw existants.error;
    const deja = existants.data.find((q) => {
      try { return JSON.parse(q.text).source === "ia"; } catch { return false; }
    });
    if (deja && data.enregistrer) return { quizId: deja.id, questions: JSON.parse(deja.text).questions };
    let contenu = cours.text;
    try {
      const charge = JSON.parse(cours.text);
      if (charge.v === 3) contenu = [charge.description, charge.contenu].filter(Boolean).join("\n");
    } catch { /* Legacy plain text course. */ }
    if (contenu.trim().length < 80) throw new Error("Ajoute au moins 80 caractères de texte au cours pour générer son quiz.");
    const { genererQuestionsCours } = await import("@/lib/quiz-ai/generer.server");
    const questions = await genererQuestionsCours(contenu, data.nombre);
    if (!data.enregistrer) return { quizId: null, questions };
    const { data: quiz, error: erreurQuiz } = await context.supabase.from("courses").insert({
      author_id: context.userId, title: cours.id, type: "__quiz__",
      text: JSON.stringify({ source: "ia", questions }),
    }).select("id").single();
    if (erreurQuiz) throw erreurQuiz;
    return { quizId: quiz.id, questions };
  });