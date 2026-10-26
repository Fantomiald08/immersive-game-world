import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Monde, type Pnj } from "@/components/game/Monde";
import { Fenetre } from "@/components/game/Fenetre";
import { Combat } from "@/components/game/Combat";
import { ProfilCarte } from "@/components/game/ProfilCarte";
import { Personnage } from "@/components/game/Personnage";
import { apparenceDepuis } from "@/game/apparence";
import { SCENES } from "@/game/scenes";
import { PLACES_COURS, PROF } from "@/game/scenes/Classe";
import { EMOJIS_MONSTRES, PLACES_MONSTRES } from "@/game/scenes/Serveur";
import { BARMAN, TABLEAU_HEROS } from "@/game/scenes/Cafeteria";
import type { Point, SceneId } from "@/game/monde";
import { useSalle } from "@/game/multijoueur";
import { deposerCours, supprimerCours, useCours, type Cours } from "@/game/cours";
import { BANQUE, genererQuestions, melange, type Question } from "@/game/quiz";
import { ajouterXp, useHeros, useMonProfil, useRafraichirProfil } from "@/game/profil";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/jeu")({
  head: () => ({
    meta: [
      { title: "L'école — Isitech World" },
      { name: "description", content: "Promène-toi dans l'école Isitech avec ta classe : cours, cafétéria et combats." },
      { property: "og:title", content: "L'école — Isitech World" },
      { property: "og:description", content: "Le jeu multijoueur de la classe BTS SIO SISR." },
    ],
  }),
  component: Jeu,
});

type Modal =
  | { t: "profil"; id: string } | { t: "cours"; c: Cours } | { t: "depot" } | { t: "liste" } | { t: "heros" }
  | { t: "texte"; nom: string; texte: string }
  | { t: "combat"; nom: string; emoji: string; questions: Question[]; xp: number };

const PROF_APP = apparenceDepuis("professeur-isitech");
const BARMAN_APP = apparenceDepuis("barman-cafet");
const ACCUEIL_APP = apparenceDepuis("accueil-isitech");

function Jeu() {
  const { data: p, isLoading } = useMonProfil();
  const refresh = useRafraichirProfil();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [scene, setScene] = useState<SceneId>("hall");
  const [depart, setDepart] = useState<Point>(SCENES.hall.entrees.debut!);
  const [modal, setModal] = useState<Modal | null>(null);
  const { data: cours = [] } = useCours();
  const { autres, envoyer } = useSalle(scene, p, depart);

  useEffect(() => { if (p && !p.personnage_cree) nav({ to: "/personnage" }); }, [p, nav]);

  const changer = (v: SceneId) => {
    setDepart(SCENES[v].entrees[scene] ?? SCENES[v].entrees.debut!);
    setScene(v);
  };

  const pnjs = useMemo<Pnj[]>(() => {
    if (scene === "hall") return [{ id: "accueil", ...{ x: 10, y: 4.9 }, nom: "Mme Accueil", label: "Parler à l'accueil", apparence: ACCUEIL_APP,
      action: () => setModal({ t: "texte", nom: "Mme Accueil", texte: "Bienvenue à Isitech ! En haut à gauche, la salle de classe : chaque élève qui dépose un cours y est représenté par un PNJ. En haut à droite, la salle serveur : les monstres y posent des questions sur vos cours. À droite, la cafétéria : on y consulte les profils de toute la classe." }) }];
    if (scene === "classe") return [
      { id: "prof", ...PROF, nom: "Professeur", label: "Parler au professeur", apparence: PROF_APP, action: () => setModal({ t: "liste" }) },
      ...cours.slice(0, PLACES_COURS.length).map((c, i) => ({ id: c.id, ...PLACES_COURS[i]!, nom: c.title.slice(0, 16), label: `Écouter « ${c.title.slice(0, 24)} »`,
        apparence: apparenceDepuis(c.id), action: () => setModal({ t: "cours", c }) })),
    ];
    if (scene === "serveur") return [
      { id: "virus", ...PLACES_MONSTRES[0]!, nom: "Virus SISR", label: "Combattre le Virus", emoji: "🦠",
        action: () => setModal({ t: "combat", nom: "Virus SISR", emoji: "🦠", questions: melange(BANQUE).slice(0, 6), xp: 20 }) },
      ...cours.slice(0, PLACES_MONSTRES.length - 1).map((c, i) => {
        const emoji = EMOJIS_MONSTRES[i % EMOJIS_MONSTRES.length]!, nom = `Boss ${c.title.slice(0, 14)}`;
        return { id: c.id, ...PLACES_MONSTRES[i + 1]!, nom, label: `Combattre ${nom}`, emoji,
          action: () => setModal({ t: "combat", nom, emoji, questions: genererQuestions(c.text, 6), xp: 30 }) };
      }),
    ];
    return [
      { id: "barman", ...BARMAN, nom: "Barman", label: "Voir mon profil", apparence: BARMAN_APP, action: () => p && setModal({ t: "profil", id: p.id }) },
      { id: "heros", ...TABLEAU_HEROS, nom: "Héros", label: "Tableau des héros", emoji: "📋", action: () => setModal({ t: "heros" }) },
    ];
  }, [scene, cours, p]);

  if (isLoading || !p) return <div className="p-8 text-center font-pixel text-xs">Chargement…</div>;
  const fermer = () => setModal(null);
  const majTout = async () => { await refresh(); await qc.invalidateQueries({ queryKey: ["profil"] }); await qc.invalidateQueries({ queryKey: ["heros"] }); };

  return (
    <div className="mx-auto max-w-5xl space-y-2 p-2">
      <div className="pixel-box flex flex-wrap items-center justify-between gap-2 p-2">
        <span className="font-pixel text-[10px] text-primary">ISITECH WORLD · <span className="text-accent">{SCENES[scene].nom}</span></span>
        <div className="flex items-center gap-2">
          <span className="text-lg">{p.pseudo} · Nv{p.niveau} · {p.xp} XP</span>
          <button className="pixel-btn !px-2 !py-1" onClick={() => setModal({ t: "profil", id: p.id })}>Profil</button>
          <button className="pixel-btn !px-2 !py-1" onClick={async () => { await supabase.auth.signOut(); nav({ to: "/connexion" }); }}>Quitter</button>
        </div>
      </div>
      <Monde key={scene} scene={SCENES[scene]} depart={depart} pnjs={pnjs} autres={autres} moi={p} pause={!!modal}
        onPorte={changer} onPos={envoyer} onClicJoueur={(id) => setModal({ t: "profil", id })} />
      <p className="text-center text-muted-foreground">Flèches / ZQSD pour bouger · E pour parler · clique un joueur pour voir son profil · {autres.length} autre(s) joueur(s) ici</p>

      {modal?.t === "profil" && <Fenetre titre="Fiche joueur" onFermer={fermer}><ProfilCarte id={modal.id} moi={p} onMaj={majTout} /></Fenetre>}
      {modal?.t === "texte" && <Fenetre titre={modal.nom} onFermer={fermer}><p className="text-xl">{modal.texte}</p></Fenetre>}
      {modal?.t === "heros" && <Fenetre titre="Tableau des héros" onFermer={fermer}><Heros onVoir={(id) => setModal({ t: "profil", id })} /></Fenetre>}
      {modal?.t === "cours" && (
        <Fenetre titre={modal.c.title} onFermer={fermer} large>
          <div className="flex gap-3">
            <Personnage a={apparenceDepuis(modal.c.id)} taille={90} />
            <div className="flex-1 space-y-2">
              <p className="text-muted-foreground">{modal.c.type} · déposé par <b className="text-primary">{modal.c.auteur}</b></p>
              <p className="whitespace-pre-wrap text-xl">{modal.c.text || "(cours vide)"}</p>
              {modal.c.author_id === p.id && (
                <button className="pixel-btn" onClick={async () => { await supprimerCours(modal.c.id); await qc.invalidateQueries({ queryKey: ["cours"] }); fermer(); }}>🗑 Supprimer mon cours</button>
              )}
            </div>
          </div>
        </Fenetre>
      )}
      {modal?.t === "liste" && (
        <Fenetre titre="Professeur — les cours de la classe" onFermer={fermer} large>
          <p className="mb-2">Bonjour {p.pseudo} ! Voici tous les cours déposés. Chaque cours a son élève assis en classe.</p>
          <button className="pixel-btn mb-3" onClick={() => setModal({ t: "depot" })}>＋ Déposer un cours</button>
          <ul className="space-y-1">
            {cours.length === 0 && <li className="text-muted-foreground">Aucun cours pour l'instant.</li>}
            {cours.map((c) => (
              <li key={c.id}><button className="w-full border-2 border-border bg-muted px-2 py-1 text-left" onClick={() => setModal({ t: "cours", c })}>
                📘 {c.title} <span className="text-muted-foreground">— {c.type}, par {c.auteur}</span></button></li>
            ))}
          </ul>
        </Fenetre>
      )}
      {modal?.t === "depot" && <Fenetre titre="Déposer un cours" onFermer={fermer}><Depot onOk={async (c) => { await deposerCours(p.id, c); await qc.invalidateQueries({ queryKey: ["cours"] }); setModal({ t: "liste" }); }} /></Fenetre>}
      {modal?.t === "combat" && (
        <Fenetre titre="Combat !" onFermer={fermer} large>
          <Combat monstre={modal.nom} emoji={modal.emoji} questions={modal.questions} moi={p} gainXp={modal.xp}
            onVictoire={async () => { await ajouterXp(modal.xp); await majTout(); }} onFermer={fermer} />
        </Fenetre>
      )}
    </div>
  );
}

function Heros({ onVoir }: { onVoir: (id: string) => void }) {
  const { data = [], isLoading } = useHeros();
  if (isLoading) return <p>Chargement…</p>;
  return (
    <ul className="space-y-1">
      {data.map((h, i) => (
        <li key={h.id}><button className="flex w-full items-center gap-3 border-2 border-border bg-muted px-2 py-1 text-left" onClick={() => onVoir(h.id)}>
          <span className="font-pixel text-[10px] text-accent">#{i + 1}</span>
          <Personnage a={h.apparence} taille={40} />
          <span className="flex-1">{h.pseudo} <span className="text-muted-foreground">— {h.titre}</span></span>
          <span>Nv{h.niveau} · {h.xp} XP</span>
        </button></li>
      ))}
    </ul>
  );
}

function Depot({ onOk }: { onOk: (c: { title: string; type: string; text: string }) => Promise<void> }) {
  const [title, setTitle] = useState(""), [type, setType] = useState("Cours"), [text, setText] = useState("");
  const [err, setErr] = useState(""), [envoi, setEnvoi] = useState(false);
  return (
    <form className="space-y-2" onSubmit={async (e) => {
      e.preventDefault();
      if (!title.trim() || text.trim().length < 30) { setErr("Un titre et au moins 30 caractères de texte."); return; }
      setEnvoi(true);
      try { await onOk({ title: title.trim().slice(0, 80), type, text: text.trim().slice(0, 8000) }); } catch { setErr("Envoi impossible, réessaie."); setEnvoi(false); }
    }}>
      <input className="pixel-input" placeholder="Titre (ex : Le protocole DHCP)" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
      <select className="pixel-input" value={type} onChange={(e) => setType(e.target.value)}>
        {["Cours", "Fiche", "TP", "Résumé"].map((t) => <option key={t}>{t}</option>)}
      </select>
      <textarea className="pixel-input" rows={8} placeholder="Colle le texte de ton cours : les monstres de la salle serveur en tireront leurs questions." value={text} maxLength={8000} onChange={(e) => setText(e.target.value)} />
      {err && <p className="text-destructive">{err}</p>}
      <button className="pixel-btn" disabled={envoi}>Déposer</button>
    </form>
  );
}
