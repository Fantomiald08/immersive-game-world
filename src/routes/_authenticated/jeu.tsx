import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Personnage } from "@/components/game/Personnage";
import { majProfil, useMonProfil, useRafraichirProfil } from "@/game/profil";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/jeu")({
  head: () => ({
    meta: [
      { title: "L'école — Isitech World" },
      { name: "description", content: "Promène-toi dans l'école Isitech avec ta classe." },
      { property: "og:title", content: "L'école — Isitech World" },
      { property: "og:description", content: "Le jeu multijoueur de la classe BTS SIO SISR." },
    ],
  }),
  component: Jeu,
});

/** Étape 1 : accueil du joueur + profil. Le hall (étape 2) viendra remplacer cet écran. */
function Jeu() {
  const { data: p, isLoading } = useMonProfil();
  const refresh = useRafraichirProfil();
  const nav = useNavigate();
  const [edit, setEdit] = useState(false);
  const [pseudo, setPseudo] = useState(""), [bio, setBio] = useState("");

  useEffect(() => { if (p && !p.personnage_cree) nav({ to: "/personnage" }); }, [p, nav]);
  useEffect(() => { if (p) { setPseudo(p.pseudo); setBio(p.bio); } }, [p]);

  if (isLoading || !p) return <div className="p-8 text-center font-pixel text-xs">Chargement…</div>;

  const deco = async () => { await supabase.auth.signOut(); nav({ to: "/connexion" }); };
  const save = async () => { await majProfil(p.id, { pseudo: pseudo.trim() || p.pseudo, bio }); await refresh(); setEdit(false); };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="pixel-box flex items-center justify-between p-3">
        <span className="font-pixel text-xs text-primary">ISITECH WORLD</span>
        <button className="pixel-btn" onClick={deco}>Déconnexion</button>
      </div>
      <div className="pixel-box flex flex-col items-center gap-3 p-6 md:flex-row md:items-start">
        <div className="tile-tile grid h-56 w-44 place-items-center border-4 border-border">
          <Personnage a={p.apparence} taille={150} pseudo={p.pseudo} niveau={p.niveau} />
        </div>
        <div className="flex-1 space-y-2">
          {edit ? (
            <>
              <input className="pixel-input" value={pseudo} maxLength={20} onChange={(e) => setPseudo(e.target.value)} />
              <textarea className="pixel-input" rows={3} placeholder="Ta bio" value={bio} maxLength={200} onChange={(e) => setBio(e.target.value)} />
              <button className="pixel-btn" onClick={save}>Enregistrer</button>
            </>
          ) : (
            <>
              <div className="font-pixel text-sm text-accent">{p.pseudo}</div>
              <div>{p.titre} · Niveau {p.niveau} · {p.xp} XP</div>
              <p className="text-muted-foreground">{p.bio || "Pas encore de bio."}</p>
              <div className="flex flex-wrap gap-2">
                <button className="pixel-btn" onClick={() => setEdit(true)}>✎ Modifier le profil</button>
                <Link to="/personnage" className="pixel-btn">👕 Changer d'apparence</Link>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="pixel-box p-4 text-center text-muted-foreground">Le hall de l'école arrive à l'étape 2.</div>
    </div>
  );
}
