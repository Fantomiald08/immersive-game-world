import { supabase } from "@/integrations/supabase/client";
import {
  nettoyerQuestions,
  type QuestionQuiz,
} from "../../supabase/functions/generer-quiz/handler";

export type ReponseIA = { ok: true; questions: QuestionQuiz[] } | { ok: false; message: string };

/** Demande à la fonction serveur « generer-quiz » d'écrire un quiz. La clé de l'IA reste côté serveur. */
export async function genererQuizIA(e: {
  coursId: string;
  titre: string;
  categorie: string;
  contenu: string;
  nombre: number;
  difficulte: "facile" | "normal" | "difficile" | "mixte";
}): Promise<ReponseIA> {
  try {
    const { data, error } = await supabase.functions.invoke("generer-quiz", { body: e });
    if (error)
      return {
        ok: false,
        message:
          "La fonction IA ne répond pas. Elle n'est peut-être pas encore déployée (voir le fichier LISEZMOI-V5).",
      };
    const r = data as { ok?: boolean; message?: string; questions?: unknown } | null;
    if (!r) return { ok: false, message: "Réponse vide de la fonction IA." };
    if (!r.ok) return { ok: false, message: r.message ?? "La génération a échoué." };
    const questions = nettoyerQuestions(r.questions, 20);
    return questions.length
      ? { ok: true, questions }
      : { ok: false, message: "L'IA n'a renvoyé aucune question exploitable." };
  } catch {
    return { ok: false, message: "Impossible de contacter la fonction IA." };
  }
}

/** Test de connexion pour les admins : une petite génération réelle. */
export const testerIA = (coursId = "test") =>
  genererQuizIA({
    coursId,
    titre: "Test de connexion",
    categorie: "Réseaux",
    nombre: 3,
    difficulte: "facile",
    contenu:
      "Le protocole DHCP attribue automatiquement une adresse IP aux machines d'un réseau. Le serveur DNS traduit un nom de domaine en adresse IP. Le port 443 est utilisé par HTTPS.",
  });
