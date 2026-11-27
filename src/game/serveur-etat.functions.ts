import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { estAdmin } from "./admins";

/**
 * Indique si la clé d'accès à l'IA est configurée. La clé elle-même ne quitte jamais le serveur.
 * Réservé aux administrateurs : vérifié côté serveur, pas seulement dans l'interface.
 */
export const lireEtatIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({}))
  .handler(async ({ context }) => {
    const { data: profil } = await context.supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", context.userId)
      .single();
    if (!estAdmin({ id: context.userId, pseudo: profil?.pseudo ?? "" }))
      throw new Error("Réservé aux administrateurs.");
    return { iaConfiguree: Boolean(process.env["LOVABLE_API_KEY"]) };
  });
