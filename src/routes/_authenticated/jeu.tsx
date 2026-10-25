import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Monde, type Pnj } from "@/components/game/Monde";
import { Personnage } from "@/components/game/Personnage";
import { Combat } from "@/components/game/Combat";
import { Fenetre } from "@/components/game/Fenetre";
import { ProfilCarte } from "@/components/game/ProfilCarte";
import { QuizCours } from "@/components/game/QuizCours";
import { apparenceDepuis } from "@/game/apparence";
import { CATEGORIES, titreNiveau } from "@/game/categories";
import { deposerCours, supprimerCours, useCours, type Cours } from "@/game/cours";
import type { Point, SceneId } from "@/game/monde";
import { useSalle } from "@/game/multijoueur";
import { ajouterXp, useHeros, useMonProfil, useRafraichirProfil, type Profil } from "@/game/profil";
import { BANQUE, genererQuestions, melange, type Question } from "@/game/quiz";
import { SCENES } from "@/game/scenes";
import { ACCUEIL_PNJ } from "@/game/scenes/Hall";
import { PLACES_COURS, PROF } from "@/game/scenes/Classe";
import { MONSTRES, PLACES_MONSTRES } from "@/game/scenes/Serveur";
import { BARMAN, TABLEAU_HEROS } from "@/game/scenes/Cafeteria";
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

type Fen =
  | { k: "profil"; id: string }
  | { k: "cours"; c: Cours }
  | { k: "deposer" }
  | { k: "classement" }
  | { k: "aide"; titre: string; texte: string }
  | { k: "quiz"; titre: string; qs: Question[] }
  | { k: "combat"; monstre: string; emoji: string; qs: Question[]; idx: number | null };

const EMOTES = ["👋", "😂", "💃", "👏"];
const AIDE =
  "Déplace-toi avec les flèches ou ZQSD (joystick sur mobile). Approche-toi d'un personnage ou d'un objet et appuie sur E (ou clique dessus). Clique sur un joueur pour voir son profil. Les portes mènent à la salle de classe (cours), la salle serveur (combats) et la cafétéria (classement).";

function Jeu() {
  const { data: p, isLoading } = useMonProfil();
  const nav = useNavigate();
  useEffect(() => {
    if (p && !p.personnage_cree) nav({ to: "/personnage" });
  }, [p, nav]);
  if (isLoading || !p) return <div className="p-8 text-center font-pixel text-xs">Chargement…</div>;
  return <Partie moi={p} />;
}

function Partie({ moi }: { moi: Profil }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const refresh = useRafraichirProfil();
  const [sceneId, setSceneId] = useState<SceneId>("hall");
  const [depart, setDepart] = useState<Point>(SCENES.hall.entrees.debut!);
  const [fen, setFen] = useState<Fen | null>(null);
  const [filtre, setFiltre] = useState<string>("Toutes");
  const [toast, setToast] = useState("");
  const [vaincus, setVaincus] = useState<number[]>([]);
  const [msg, setMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scene = SCENES[sceneId];
  const { autres, envoyer, dire, bulles } = useSalle(sceneId, moi, depart);
  const { data: cours = [], refetch: recharger } = useCours();
  const { data: heros = [] } = useHeros();

  useEffect(() => {
    if (sceneId === "classe") void recharger();
  }, [sceneId, recharger]);

  const annoncer = useCallback((t: string) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);

  const aller = useCallback(
    (vers: SceneId) => {
      setDepart(SCENES[vers].entrees[sceneId] ?? SCENES[vers].entrees.debut!);
      setSceneId(vers);
    },
    [sceneId],
  );

  const gagnerXp = useCallback(
    async (n: number, texte: string) => {
      if (n <= 0) return;
      try {
        await ajouterXp(n);
        await refresh();
        void qc.invalidateQueries({ queryKey: ["heros"] });
        annoncer(`+${n} XP · ${texte}`);
      } catch {
        annoncer("Impossible d'ajouter l'XP pour le moment.");
      }
    },
    [annoncer, qc, refresh],
  );

  const questionsDeCours = useCallback((c: Cours, n: number) => genererQuestions(c.text, n), []);
  const questionsMix = useCallback(() => {
    const texte = cours
      .map((c) => c.text)
      .join("\n")
      .slice(0, 6000);
    return melange([...genererQuestions(texte, 4), ...melange(BANQUE).slice(0, 4)]);
  }, [cours]);

  const lancerCombat = useCallback(
    (i: number) => {
      const m = MONSTRES[i % MONSTRES.length]!;
      setFen({ k: "combat", monstre: m.nom, emoji: m.emoji, qs: questionsMix(), idx: i });
    },
    [questionsMix],
  );

  const coursVisibles = useMemo(
    () =>
      (filtre === "Toutes" ? cours : cours.filter((c) => c.type === filtre)).slice(
        0,
        PLACES_COURS.length,
      ),
    [cours, filtre],
  );

  const pnjs = useMemo<Pnj[]>(() => {
    if (sceneId === "hall")
      return [
        {
          id: "accueil",
          ...ACCUEIL_PNJ,
          nom: "Accueil",
          label: "Parler à l'accueil",
          apparence: apparenceDepuis("accueil"),
          action: () => setFen({ k: "aide", titre: "Accueil d'Isitech", texte: AIDE }),
        },
      ];
    if (sceneId === "classe") {
      return [
        {
          id: "prof",
          ...PROF,
          nom: "Professeur",
          label: "Déposer un cours",
          apparence: apparenceDepuis("professeur"),
          action: () => setFen({ k: "deposer" }),
        },
        ...coursVisibles.map((c, i): Pnj => ({
          id: c.id,
          ...PLACES_COURS[i]!,
          nom: c.auteur,
          label: `Cours : ${c.title}`,
          apparence: apparenceDepuis(c.author_id),
          action: () => setFen({ k: "cours", c }),
        })),
      ];
    }
    if (sceneId === "serveur") {
      return PLACES_MONSTRES.flatMap((pt, i): Pnj[] => {
        if (vaincus.includes(i)) return [];
        const m = MONSTRES[i % MONSTRES.length]!;
        return [
          {
            id: `m${i}`,
            ...pt,
            nom: m.nom,
            label: `Combattre : ${m.nom}`,
            emoji: m.emoji,
            action: () => lancerCombat(i),
          },
        ];
      });
    }
    return [
      {
        id: "barman",
        ...BARMAN,
        nom: "Cuistot",
        label: "Parler au cuistot",
        apparence: apparenceDepuis("barman"),
        action: () =>
          setFen({
            k: "aide",
            titre: "Cafétéria",
            texte:
              "Bienvenue ! Clique sur un élève pour voir son profil, ou sur le trophée pour le classement. Pour t'entraîner, va combattre les monstres de la salle serveur.",
          }),
      },
      {
        id: "classement",
        ...TABLEAU_HEROS,
        nom: "Classement",
        label: "Voir le classement",
        emoji: "🏆",
        action: () => {
          void qc.invalidateQueries({ queryKey: ["heros"] });
          setFen({ k: "classement" });
        },
      },
    ];
  }, [sceneId, coursVisibles, vaincus, lancerCombat, qc]);

  const fermer = () => setFen(null);
  const deco = async () => {
    await supabase.auth.signOut();
    nav({ to: "/connexion" });
  };
  const envoyerMsg = () => {
    if (dire(msg)) setMsg("");
  };
  const pct = moi.xp % 100;

  return (
    <div className="mx-auto max-w-5xl space-y-2 p-2">
      <div className="pixel-box flex flex-wrap items-center justify-between gap-2 p-2">
        <span className="font-pixel text-xs text-primary">
          ISITECH WORLD · <span className="text-accent">{scene.nom}</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {sceneId !== "hall" && (
            <button className="pixel-btn !px-2 !py-1" onClick={() => aller("hall")}>
              ⬅ Sortir
            </button>
          )}
          <button
            className="pixel-btn !px-2 !py-1"
            onClick={() => setFen({ k: "profil", id: moi.id })}
          >
            👤 Profil
          </button>
          <button
            className="pixel-btn !px-2 !py-1"
            onClick={() => setFen({ k: "aide", titre: "Aide", texte: AIDE })}
          >
            ❓
          </button>
          <button className="pixel-btn !px-2 !py-1" onClick={deco}>
            Déconnexion
          </button>
        </div>
      </div>

      <div className="pixel-box flex items-center gap-3 p-2">
        <span className="font-pixel text-[9px]">Nv {moi.niveau}</span>
        <div className="h-3 flex-1 border-2 border-border bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm">
          {titreNiveau(moi.niveau)} · {moi.xp} XP
        </span>
      </div>

      {sceneId === "classe" && (
        <div className="pixel-box flex flex-wrap items-center gap-2 p-2 text-sm">
          <label className="flex items-center gap-2">
            Catégorie
            <select
              className="pixel-input !w-auto"
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
            >
              <option>Toutes</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <span className="text-muted-foreground">
            {coursVisibles.length} cours affiché{coursVisibles.length > 1 ? "s" : ""}
            {coursVisibles.length === 0 ? " · va voir le professeur pour déposer le premier !" : ""}
          </span>
        </div>
      )}

      <Monde
        key={sceneId}
        scene={scene}
        depart={depart}
        pnjs={pnjs}
        autres={autres}
        moi={moi}
        pause={fen !== null}
        bulles={bulles}
        onPorte={aller}
        onPos={envoyer}
        onClicJoueur={(id) => setFen({ k: "profil", id })}
      />

      <div className="pixel-box flex flex-wrap items-center gap-2 p-2">
        <input
          className="pixel-input !w-auto min-w-0 flex-1"
          placeholder="Écris un message (Entrée pour envoyer)…"
          maxLength={60}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") envoyerMsg();
          }}
        />
        <button className="pixel-btn !px-2 !py-1" onClick={envoyerMsg}>
          Envoyer
        </button>
        {EMOTES.map((e) => (
          <button key={e} className="pixel-btn !px-2 !py-1 text-lg" onClick={() => dire(e)}>
            {e}
          </button>
        ))}
      </div>

      {toast && (
        <div className="pixel-box pointer-events-none fixed bottom-6 left-1/2 z-[4000] -translate-x-1/2 px-4 py-2 font-pixel text-[10px] text-accent">
          {toast}
        </div>
      )}

      {fen?.k === "profil" && (
        <Fenetre titre="Profil" onFermer={fermer}>
          <ProfilCarte id={fen.id} moi={moi} onMaj={refresh} />
        </Fenetre>
      )}

      {fen?.k === "aide" && (
        <Fenetre titre={fen.titre} onFermer={fermer}>
          <p className="text-lg">{fen.texte}</p>
          <button className="pixel-btn mt-3" onClick={fermer}>
            OK
          </button>
        </Fenetre>
      )}

      {fen?.k === "cours" && (
        <Fenetre titre={fen.c.title} onFermer={fermer} large>
          <div className="mb-2 text-sm text-muted-foreground">
            {fen.c.type} · déposé par {fen.c.auteur}
          </div>
          <div className="mb-3 max-h-64 overflow-auto whitespace-pre-wrap border-2 border-border bg-muted p-2 text-lg">
            {fen.c.text ||
              "Ce cours n'a pas de texte. Le quiz utilisera des questions générales SISR."}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="pixel-btn"
              onClick={() =>
                setFen({ k: "quiz", titre: fen.c.title, qs: questionsDeCours(fen.c, 5) })
              }
            >
              ❓ Lancer le quiz
            </button>
            <button
              className="pixel-btn"
              onClick={() =>
                setFen({
                  k: "combat",
                  monstre: `Boss ${fen.c.type}`,
                  emoji: "👹",
                  qs: questionsDeCours(fen.c, 6),
                  idx: null,
                })
              }
            >
              ⚔️ Défier
            </button>
            {fen.c.author_id === moi.id && (
              <button
                className="pixel-btn !bg-destructive"
                onClick={async () => {
                  try {
                    await supprimerCours(fen.c.id);
                    await qc.invalidateQueries({ queryKey: ["cours"] });
                    annoncer("Cours supprimé.");
                    fermer();
                  } catch {
                    annoncer("Suppression impossible.");
                  }
                }}
              >
                🗑 Supprimer
              </button>
            )}
          </div>
        </Fenetre>
      )}

      {fen?.k === "deposer" && (
        <Fenetre titre="Déposer un cours" onFermer={fermer} large>
          <FormDepot
            onAnnuler={fermer}
            onDepose={async (t) => {
              await deposerCours(moi.id, t);
              await qc.invalidateQueries({ queryKey: ["cours"] });
              fermer();
              await gagnerXp(10, "cours déposé");
            }}
          />
        </Fenetre>
      )}

      {fen?.k === "quiz" && (
        <Fenetre titre={`Quiz : ${fen.titre}`} onFermer={fermer} large>
          <QuizCours
            questions={fen.qs}
            onFermer={fermer}
            onFin={(s, t) => gagnerXp(s * 4, `quiz ${s}/${t}`)}
          />
        </Fenetre>
      )}

      {fen?.k === "combat" && (
        <Fenetre titre="Combat !" onFermer={fermer} large>
          <Combat
            monstre={fen.monstre}
            emoji={fen.emoji}
            questions={fen.qs}
            moi={moi}
            gainXp={20}
            onFermer={fermer}
            onVictoire={async () => {
              await gagnerXp(20, `${fen.monstre} vaincu`);
              const idx = fen.idx;
              if (idx !== null) {
                setVaincus((v) => [...v, idx]);
                setTimeout(() => setVaincus((v) => v.filter((x) => x !== idx)), 45000);
              }
            }}
          />
        </Fenetre>
      )}

      {fen?.k === "classement" && (
        <Fenetre titre="🏆 Top 10 · XP" onFermer={fermer}>
          <ol className="space-y-2">
            {heros.slice(0, 10).map((h, i) => (
              <li key={h.id}>
                <button
                  className="pixel-btn flex w-full items-center gap-3 text-left"
                  onClick={() => setFen({ k: "profil", id: h.id })}
                >
                  <span className="w-6 font-pixel text-[10px]">{i + 1}</span>
                  <Personnage a={h.apparence} taille={36} />
                  <span className="flex-1 truncate">{h.pseudo}</span>
                  <span className="text-sm">
                    Nv {h.niveau} · {h.xp} XP
                  </span>
                </button>
              </li>
            ))}
            {heros.length === 0 && (
              <li className="text-muted-foreground">Personne au classement pour l'instant.</li>
            )}
          </ol>
        </Fenetre>
      )}
    </div>
  );
}

function FormDepot({
  onDepose,
  onAnnuler,
}: {
  onDepose: (c: { title: string; type: string; text: string }) => Promise<void>;
  onAnnuler: () => void;
}) {
  const [title, setTitle] = useState(""),
    [type, setType] = useState<string>(CATEGORIES[0]),
    [text, setText] = useState("");
  const [err, setErr] = useState(""),
    [envoi, setEnvoi] = useState(false);
  const go = async () => {
    if (!title.trim()) {
      setErr("Donne un titre à ton cours.");
      return;
    }
    setEnvoi(true);
    setErr("");
    try {
      await onDepose({ title: title.trim().slice(0, 80), type, text: text.slice(0, 8000) });
    } catch {
      setErr("Le dépôt a échoué. Réessaie.");
      setEnvoi(false);
    }
  };
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Titre
        <input
          className="pixel-input"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex : Configurer un serveur DHCP"
        />
      </label>
      <label className="block text-sm">
        Catégorie
        <select className="pixel-input" value={type} onChange={(e) => setType(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Texte du cours (sert à générer le quiz)
        <textarea
          className="pixel-input"
          rows={8}
          value={text}
          maxLength={8000}
          onChange={(e) => setText(e.target.value)}
          placeholder="Colle ici ton cours en texte. Plus il est détaillé, meilleur sera le quiz."
        />
      </label>
      {err && <p className="text-destructive">{err}</p>}
      <div className="flex gap-2">
        <button className="pixel-btn" disabled={envoi} onClick={go}>
          {envoi ? "Envoi…" : "📥 Déposer"}
        </button>
        <button className="pixel-btn" onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </div>
  );
}
