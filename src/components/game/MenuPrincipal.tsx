import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Chargement } from "@/components/game/Chargement";
import { Fenetre } from "@/components/game/Fenetre";
import { Personnage } from "@/components/game/Personnage";
import { ProfilCarte } from "@/components/game/ProfilCarte";
import { Reglages } from "@/components/game/Reglages";
import { Tuto } from "@/components/game/Tuto";
import { estAdmin } from "@/game/admins";
import { titreNiveau } from "@/game/categories";
import { lireHistoire, resume } from "@/game/histoire";
import { useMonProfil, useRafraichirProfil } from "@/game/profil";
import { majReglages } from "@/game/reglages";
import { jouer } from "@/game/son";
import { lireSolo } from "@/game/solo";
import { supabase } from "@/integrations/supabase/client";

type Fen = "profil" | "reglages" | "tuto" | null;
const DELAI_FONDU = 280;

/** Accueil du joueur connecté : choix du mode de jeu, profil, paramètres. */
export function MenuPrincipal() {
  const nav = useNavigate();
  const { data: moi, isLoading, isError, refetch } = useMonProfil();
  const refresh = useRafraichirProfil();
  const [fen, setFen] = useState<Fen>(null);
  const [sortie, setSortie] = useState(false);

  useEffect(() => {
    if (moi && !moi.personnage_cree) nav({ to: "/personnage" });
  }, [moi, nav]);

  // Avancement du mode histoire, lu sur l'appareil.
  const histoire = useMemo(() => {
    if (!moi) return null;
    const r = resume(lireHistoire(moi.id));
    return { ...r, reprise: lireSolo(moi.id) !== null };
  }, [moi]);

  const partir = (vers: "/jeu" | "/histoire") => {
    if (sortie) return;
    jouer("ok");
    setSortie(true);
    setTimeout(() => nav({ to: vers }), DELAI_FONDU);
  };
  const deco = async () => {
    await supabase.auth.signOut();
    nav({ to: "/" });
  };

  if (isLoading)
    return (
      <Chargement plein texte="Connexion à ton profil…" detail="Un instant, on te retrouve." />
    );
  if (isError || !moi || !histoire)
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="pixel-box max-w-sm space-y-3 p-5">
          <p className="font-pixel text-xs text-destructive">Connexion impossible</p>
          <p className="text-lg">On n'arrive pas à charger ton profil pour le moment.</p>
          <div className="flex justify-center gap-2">
            <button className="pixel-btn" onClick={() => void refetch()}>
              ↻ Réessayer
            </button>
            <button className="pixel-btn !bg-destructive" onClick={deco}>
              ⏻ Déconnexion
            </button>
          </div>
        </div>
      </div>
    );

  const blocs = [
    {
      icone: "👥",
      titre: "Mode Multijoueur",
      texte: "Retrouve ta classe dans l'école, en temps réel.",
      pastille: "EN LIGNE",
      onClick: () => partir("/jeu"),
    },
    {
      icone: "📖",
      titre: "Mode Histoire",
      texte: histoire.terminee
        ? "Histoire terminée — rejoue-la en solo."
        : `Solo · ${histoire.chapitre?.titre ?? "Chapitre 1"} · ${histoire.pourcent} %`,
      pastille: histoire.reprise ? "CONTINUER" : "SOLO",
      onClick: () => partir("/histoire"),
    },
    {
      icone: "👤",
      titre: "Profil",
      texte: `${moi.pseudo} · ${titreNiveau(moi.niveau)}`,
      onClick: () => setFen("profil"),
    },
    {
      icone: "⚙",
      titre: "Paramètres",
      texte: "Touches, son, affichage, mobile.",
      onClick: () => setFen("reglages"),
    },
  ];

  return (
    <div
      className="anim-fade-in relative min-h-screen overflow-hidden transition-opacity duration-300"
      style={{
        opacity: sortie ? 0 : 1,
        backgroundImage:
          "linear-gradient(color-mix(in oklab, var(--border) 18%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--border) 18%, transparent) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-4 text-center">
        <div className="anim-rise-in space-y-3">
          <div className="anim-bob inline-block">
            <Personnage a={moi.apparence} marche taille={110} />
          </div>
          <h1 className="font-pixel text-3xl leading-snug text-primary md:text-5xl">
            ISITECH
            <br />
            <span className="text-accent">WORLD</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Salut {moi.pseudo} ! Nv {moi.niveau} · {moi.xp} XP
          </p>
        </div>

        <nav aria-label="Menu principal" className="grid w-full gap-4 sm:grid-cols-2">
          {blocs.map((b, i) => (
            <button
              key={b.titre}
              onClick={b.onClick}
              disabled={sortie}
              style={{ animationDelay: `${120 + i * 90}ms` }}
              className="pixel-box anim-rise-in group relative space-y-1 p-4 text-left transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring active:translate-y-0 disabled:opacity-60"
            >
              {"pastille" in b && b.pastille && (
                <span className="absolute right-3 top-3 bg-accent px-2 py-1 font-pixel text-[8px] text-accent-foreground">
                  {b.pastille}
                </span>
              )}
              <div className="text-4xl">{b.icone}</div>
              <div className="font-pixel text-xs text-primary group-hover:text-accent">
                {b.titre}
              </div>
              <div className="text-lg leading-tight text-muted-foreground">{b.texte}</div>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4 text-lg text-muted-foreground">
          <span>Échap en jeu = menu pause</span>
          <button className="underline hover:text-foreground" onClick={deco}>
            Déconnexion
          </button>
        </div>
      </div>

      {fen === "profil" && (
        <Fenetre titre="Profil" onFermer={() => setFen(null)}>
          <ProfilCarte id={moi.id} moi={moi} onMaj={refresh} />
        </Fenetre>
      )}
      {fen === "reglages" && (
        <Reglages
          onFermer={() => setFen(null)}
          onTuto={() => setFen("tuto")}
          compte={{ id: moi.id, pseudo: moi.pseudo, admin: estAdmin(moi) }}
        />
      )}
      {fen === "tuto" && (
        <Tuto
          onFin={() => {
            majReglages({ tutoVu: true });
            setFen(null);
          }}
        />
      )}
    </div>
  );
}
