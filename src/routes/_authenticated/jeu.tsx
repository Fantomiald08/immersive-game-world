import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Monde } from "@/components/game/Monde";
import { Personnage } from "@/components/game/Personnage";
import { Combat } from "@/components/game/Combat";
import { Fenetre } from "@/components/game/Fenetre";
import { ProfilCarte } from "@/components/game/ProfilCarte";
import { QuizCours } from "@/components/game/QuizCours";
import { Reseau } from "@/components/game/Reseau";
import { Reglages } from "@/components/game/Reglages";
import { Plan } from "@/components/game/Plan";
import { Journal } from "@/components/game/Journal";
import { Tuto } from "@/components/game/Tuto";
import { titreNiveau } from "@/game/categories";
import type { Cible } from "@/game/carte/moteur";
import {
  SALLES,
  type Arrivee,
  type Sortie,
  type TypeMonstre,
  type ZoneId,
} from "@/game/carte/types";
import { ZONE_DEPART, ZONES } from "@/game/carte/zones";
import { useSalle } from "@/game/multijoueur";
import { ajouterXp, useHeros, useMonProfil, useRafraichirProfil, type Profil } from "@/game/profil";
import { evenement, ouvrirJour, type Evenement, type Prog } from "@/game/progression";
import { BANQUE, genererQuestions, melange, type Question } from "@/game/quiz";
import { majReglages, useReglages } from "@/game/reglages";
import type { CoursReseau } from "@/game/reseau";
import { useReseau } from "@/game/reseau";
import { jouer } from "@/game/son";
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
  | { k: "texte"; titre: string; texte: string }
  | { k: "classement" }
  | { k: "quiz"; titre: string; qs: Question[] }
  | { k: "combat"; monstre: string; type: TypeMonstre; qs: Question[]; id: string | null }
  | { k: "reglages" }
  | { k: "plan" }
  | { k: "journal" }
  | { k: "tuto" };

const EMOTES = ["👋", "😂", "💃", "👏"];

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
  const reglages = useReglages();
  const { data: reseau } = useReseau();
  const { data: heros = [] } = useHeros();

  const [zoneId, setZoneId] = useState<ZoneId>(ZONE_DEPART);
  const [depart, setDepart] = useState<Arrivee>(ZONES[ZONE_DEPART].depart);
  const [fondu, setFondu] = useState(false);
  const [fen, setFen] = useState<Fen | null>(null);
  const [terminal, setTerminal] = useState(false);
  const [toast, setToast] = useState("");
  const [vaincus, setVaincus] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [prog, setProg] = useState<Prog | null>(null);
  const [montee, setMontee] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const niveauPrec = useRef(moi.niveau);

  const zone = ZONES[zoneId];
  const { autres, envoyer, dire, bulles } = useSalle(zoneId, moi, depart);

  const annoncer = useCallback((t: string) => {
    setToast(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3200);
  }, []);

  const gagnerXp = useCallback(
    async (n: number, texte: string) => {
      if (n <= 0) return;
      try {
        await ajouterXp(n);
        await refresh();
        void qc.invalidateQueries({ queryKey: ["heros"] });
        jouer("xp");
        annoncer(`+${n} XP · ${texte}`);
      } catch {
        annoncer("Impossible d'ajouter l'XP pour le moment.");
      }
    },
    [annoncer, qc, refresh],
  );

  /** Quêtes et badges : enregistre l'événement, donne l'XP des quêtes terminées. */
  const evt = useCallback(
    async (ev: Evenement) => {
      const { prog: pr, gains } = evenement(moi.id, ev);
      setProg(pr);
      if (gains.xp > 0) await gagnerXp(gains.xp, `quête : ${gains.quetes.join(", ")}`);
      if (gains.badges.length)
        setTimeout(
          () => annoncer(`🏅 Badge débloqué : ${gains.badges.join(", ")}`),
          gains.xp > 0 ? 1800 : 0,
        );
    },
    [annoncer, gagnerXp, moi.id],
  );

  /* Ouverture de la journée : série, quêtes remises à zéro, tutoriel */
  useEffect(() => {
    const { prog: pr, gains } = ouvrirJour(moi.id);
    setProg(pr);
    if (gains.badges.length) annoncer(`🏅 Badge débloqué : ${gains.badges.join(", ")}`);
    if (!lireTuto()) setFen({ k: "tuto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Animation de montée de niveau */
  useEffect(() => {
    if (moi.niveau > niveauPrec.current) {
      setMontee(moi.niveau);
      jouer("niveau");
      setTimeout(() => setMontee(0), 2400);
    }
    niveauPrec.current = moi.niveau;
  }, [moi.niveau]);

  /** Change de zone avec un fondu au noir. */
  const aller = useCallback(
    (vers: ZoneId, arrivee: Arrivee) => {
      setFondu(true);
      setTimeout(() => {
        setDepart(arrivee);
        setZoneId(vers);
        setFondu(false);
        if ((SALLES as readonly string[]).includes(vers)) void evt({ k: "visite", salle: vers });
      }, 230);
    },
    [evt],
  );

  const questionsCours = (c: CoursReseau) =>
    genererQuestions(c.contenu || c.description || c.titre, 5);
  const questionsMix = useCallback(() => {
    const texte = (reseau?.cours ?? [])
      .map((c) => c.contenu)
      .join("\n")
      .slice(0, 6000);
    return melange([...genererQuestions(texte, 4), ...melange(BANQUE).slice(0, 4)]);
  }, [reseau]);

  const onAction = useCallback(
    (c: Cible) => {
      if (c.k === "pnj") {
        const n = c.p;
        if (n.monstre) {
          jouer("ok");
          setFen({ k: "combat", monstre: n.nom, type: n.monstre, qs: questionsMix(), id: n.id });
        } else {
          jouer("ok");
          setFen({ k: "texte", titre: n.nom, texte: n.texte ?? "..." });
        }
        return;
      }
      const a = c.o.agir!;
      if (a.k === "porte") {
        jouer("porte");
        aller(a.vers, a.arrivee);
      } else if (a.k === "terminal") {
        jouer("ok");
        setTerminal(true);
      } else if (a.k === "classement") {
        jouer("ok");
        void qc.invalidateQueries({ queryKey: ["heros"] });
        setFen({ k: "classement" });
      } else {
        jouer("ok");
        setFen({ k: "texte", titre: a.titre, texte: a.texte });
      }
    },
    [aller, qc, questionsMix],
  );

  const onSortie = useCallback((s: Sortie) => aller(s.vers, s.arrivee), [aller]);

  const pnjs = useMemo(() => zone.pnjs.filter((n) => !vaincus.includes(n.id)), [zone, vaincus]);
  const fermer = () => setFen(null);
  const finTuto = () => {
    majReglages({ tutoVu: true });
    fermer();
  };
  const deco = async () => {
    await supabase.auth.signOut();
    nav({ to: "/connexion" });
  };
  const envoyerMsg = () => {
    if (dire(msg)) setMsg("");
  };
  const pause = fen !== null || terminal || fondu;

  return (
    <div
      className="mx-auto max-w-5xl space-y-2 p-2"
      style={{
        zoom: reglages.grandeUi ? 1.15 : 1,
        filter: reglages.contraste ? "contrast(1.25) saturate(1.1)" : undefined,
      }}
    >
      <div className="pixel-box flex flex-wrap items-center justify-between gap-2 p-2">
        <span className="font-pixel text-xs text-primary">
          ISITECH WORLD · <span className="text-accent">{zone.nom}</span>
        </span>
        <div className="flex flex-wrap gap-2">
          <button className="pixel-btn !px-2 !py-1" onClick={() => setFen({ k: "plan" })}>
            🗺 Plan
          </button>
          <button className="pixel-btn !px-2 !py-1" onClick={() => setFen({ k: "journal" })}>
            📔 Journal
          </button>
          <button
            className="pixel-btn !px-2 !py-1"
            onClick={() => setFen({ k: "profil", id: moi.id })}
          >
            👤 Profil
          </button>
          <button className="pixel-btn !px-2 !py-1" onClick={() => setFen({ k: "reglages" })}>
            ⚙
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
            style={{ width: `${moi.xp % 100}%` }}
          />
        </div>
        <span className="text-sm">
          {titreNiveau(moi.niveau)} · {moi.xp} XP
        </span>
      </div>

      <div className="relative">
        <Monde
          key={zoneId}
          zone={zone}
          depart={depart}
          pnjs={pnjs}
          autres={autres}
          moi={moi}
          pause={pause}
          bulles={bulles}
          reglages={reglages}
          onAction={onAction}
          onSortie={onSortie}
          onPos={envoyer}
          onClicJoueur={(id) => setFen({ k: "profil", id })}
        />
        <div
          className="pointer-events-none absolute inset-0 z-[2600] bg-black transition-opacity duration-200"
          style={{ opacity: fondu ? 1 : 0 }}
        />
      </div>

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
        <div className="pixel-box pointer-events-none fixed bottom-6 left-1/2 z-[4000] max-w-[90vw] -translate-x-1/2 px-4 py-2 text-center font-pixel text-[10px] text-accent">
          {toast}
        </div>
      )}
      {montee > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[4100] grid place-items-center bg-black/50">
          <div className="pixel-box anim-bob px-8 py-6 text-center">
            <div className="font-pixel text-lg text-accent">NIVEAU {montee} !</div>
            <div className="mt-2">{titreNiveau(montee)}</div>
          </div>
        </div>
      )}

      {terminal && (
        <Reseau
          moi={moi}
          onFermer={() => setTerminal(false)}
          onEntree={() => void evt({ k: "reseau" })}
          onDepose={() => {
            void evt({ k: "depot" });
            void gagnerXp(10, "cours déposé");
          }}
          onQuiz={(c) => setFen({ k: "quiz", titre: c.titre, qs: questionsCours(c) })}
          onDefier={(c) =>
            setFen({
              k: "combat",
              monstre: `Boss ${c.categorie}`.slice(0, 20),
              type: "malware",
              qs: genererQuestions(c.contenu || c.description || c.titre, 6),
              id: null,
            })
          }
        />
      )}

      {fen?.k === "profil" && (
        <Fenetre titre="Profil" onFermer={fermer}>
          <ProfilCarte id={fen.id} moi={moi} onMaj={refresh} />
        </Fenetre>
      )}
      {fen?.k === "texte" && (
        <Fenetre titre={fen.titre} onFermer={fermer}>
          <p className="text-xl">{fen.texte}</p>
          <button className="pixel-btn mt-3" onClick={fermer}>
            OK
          </button>
        </Fenetre>
      )}
      {fen?.k === "quiz" && (
        <Fenetre titre={`Quiz : ${fen.titre}`} onFermer={fermer} large>
          <QuizCours
            questions={fen.qs}
            onFermer={fermer}
            onFin={async (s, t) => {
              await gagnerXp(s * 4, `quiz ${s}/${t}`);
              void evt({ k: "quiz", score: s, total: t });
            }}
          />
        </Fenetre>
      )}
      {fen?.k === "combat" && (
        <Fenetre titre="Combat !" onFermer={fermer} large>
          <Combat
            monstre={fen.monstre}
            type={fen.type}
            questions={fen.qs}
            moi={moi}
            gainXp={20}
            onFermer={fermer}
            onVictoire={async () => {
              jouer("niveau");
              await gagnerXp(20, `${fen.monstre} vaincu`);
              void evt({ k: "monstre" });
              const id = fen.id;
              if (id) {
                setVaincus((v) => [...v, id]);
                setTimeout(() => setVaincus((v) => v.filter((x) => x !== id)), 45000);
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
                  <Personnage a={h.apparence} taille={44} />
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
      {fen?.k === "reglages" && <Reglages onFermer={fermer} onTuto={() => setFen({ k: "tuto" })} />}
      {fen?.k === "plan" && <Plan zone={zoneId} lieu={zone.lieu} onFermer={fermer} />}
      {fen?.k === "journal" && prog && <Journal prog={prog} onFermer={fermer} />}
      {fen?.k === "tuto" && <Tuto onFin={finTuto} />}
    </div>
  );
}

/** Le tutoriel a-t-il déjà été vu ? (réglage sauvegardé dans le navigateur) */
function lireTuto() {
  try {
    return JSON.parse(window.localStorage.getItem("isitech.reglages.v3") ?? "{}").tutoVu === true;
  } catch {
    return false;
  }
}
