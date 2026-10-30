import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/connexion")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion — Isitech World" },
      { name: "description", content: "Connecte-toi ou crée ton compte pour entrer dans l'école Isitech World." },
      { property: "og:title", content: "Connexion — Isitech World" },
      { property: "og:description", content: "Entre dans l'école Isitech en multijoueur." },
    ],
  }),
  component: Connexion,
});

function Connexion() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState(""), [mdp, setMdp] = useState(""), [pseudo, setPseudo] = useState("");
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav({ to: "/jeu" }); });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => { if (e === "SIGNED_IN" && s) nav({ to: "/jeu" }); });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(""); setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: mdp });
        if (error) throw error;
      } else {
        if (pseudo.trim().length < 2) throw new Error("Choisis un pseudo d'au moins 2 caractères.");
        const { data, error } = await supabase.auth.signUp({
          email, password: mdp,
          options: { data: { pseudo: pseudo.trim() }, emailRedirectTo: `${window.location.origin}/jeu` },
        });
        if (error) throw error;
        if (!data.session) setMsg("Compte créé ! Clique sur le lien reçu par email pour l'activer, puis connecte-toi.");
      }
    } catch (err) {
      setMsg(err instanceof Error ? traduire(err.message) : "Erreur inconnue");
    } finally { setBusy(false); }
  };

    const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/connexion" });
    if (r.error) setMsg("Connexion Google impossible.");
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="pixel-box w-full max-w-md space-y-3 p-6">
        <h1 className="text-center font-pixel text-xl text-primary">ISITECH <span className="text-accent">WORLD</span></h1>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`pixel-btn ${mode === "in" ? "" : "opacity-50"}`} onClick={() => setMode("in")}>Se connecter</button>
          <button type="button" className={`pixel-btn ${mode === "up" ? "" : "opacity-50"}`} onClick={() => setMode("up")}>Créer un compte</button>
        </div>
        {mode === "up" && <input className="pixel-input" placeholder="Pseudo" value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={20} />}
        <input className="pixel-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="pixel-input" type="password" placeholder="Mot de passe (6 caractères min.)" value={mdp} onChange={(e) => setMdp(e.target.value)} required minLength={6} />
        <button className="pixel-btn w-full" disabled={busy}>{busy ? "…" : mode === "in" ? "▶ Entrer dans l'école" : "▶ Créer mon compte"}</button>
        <button type="button" className="pixel-btn w-full bg-secondary text-secondary-foreground" onClick={google}>Continuer avec Google</button>
        {msg && <p className="text-center text-accent">{msg}</p>}
      </form>
    </div>
  );
}

function traduire(m: string) {
  if (/invalid login/i.test(m)) return "Email ou mot de passe incorrect.";
  if (/already registered/i.test(m)) return "Cet email a déjà un compte.";
  if (/not confirmed/i.test(m)) return "Confirme d'abord ton email via le lien reçu.";
  return m;
}
