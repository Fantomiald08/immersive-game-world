// Fonction serveur « generer-quiz » (Supabase Edge Function, Deno).
// La clé de l'IA reste ici, dans les secrets : elle n'est JAMAIS envoyée au navigateur.
//
// Secrets à créer (Lovable : Cloud → Secrets) :
//   GEMINI_API_KEY   la clé créée sur Google AI Studio (obligatoire)
//   GEMINI_MODEL     facultatif, nom du modèle (défaut : gemini-2.5-flash)
//   ADMIN_IDS        facultatif, identifiants des admins séparés par des virgules (comme dans src/game/admins.ts)
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { nouvellesLimites, traiter } from "./handler.ts";

declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(h: (r: Request) => Response | Promise<Response>): void;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const limites = nouvellesLimites();
const admins = (Deno.env.get("ADMIN_IDS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const reponse = (corps: unknown) =>
  new Response(JSON.stringify(corps), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = Deno.env.get("SUPABASE_URL")!,
    service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);

  // Qui appelle ? (on vérifie le jeton de connexion nous-mêmes)
  const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } };
  const utilisateurId = data.user?.id ?? null;

  const corps = await req.json().catch(() => null);
  const sortie = await traiter(corps, {
    cleApi: Deno.env.get("GEMINI_API_KEY"),
    modele: Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash",
    utilisateurId,
    limites,
    maintenant: () => Date.now(),
    fetchFn: (u, init) => fetch(u, init),
    // Autorisé : les admins, et l'auteur du cours. Le cas « test » (bouton de l'admin) est réservé aux admins.
    peutGenerer: async (uid, coursId) => {
      if (admins.includes(uid)) return true;
      if (coursId === "test") return false;
      const { data: c } = await admin
        .from("courses")
        .select("author_id")
        .eq("id", coursId)
        .maybeSingle();
      return c?.author_id === uid;
    },
  });
  return reponse(sortie);
});
