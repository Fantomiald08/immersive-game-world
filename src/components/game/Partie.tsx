import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Monde } from "@/components/game/Monde";
import { Personnage } from "@/components/game/Personnage";
import { ReseauCombat } from "@/components/game/ReseauCombat";
import { TerminalLinux } from "@/components/game/TerminalLinux";
import { Arcade } from "@/components/game/arcade/Arcade";
import { Chargement } from "@/components/game/Chargement";
import { PauseMenu } from "@/components/game/PauseMenu";
import { Fenetre } from "@/components/game/Fenetre";
import { ProfilCarte } from "@/components/game/ProfilCarte";
import { Reseau } from "@/components/game/Reseau";
import { Reglages } from "@/components/game/Reglages";
import { Plan } from "@/components/game/Plan";
import { Tableau } from "@/components/game/Tableau";
import { Messages } from "@/components/game/Messages";
import { Tuto } from "@/components/game/Tuto";
import { EnigmeFenetre } from "@/components/game/Enigme";
import {
  progresser,
  lireHistoire,
  ecrireHistoire,
  type Evenement as EvHistoire,
  type EtatHistoire,
  enigmeEnAttente,
  type Enigme,
} from "@/game/histoire";
import { enregistrerCombat, ecrirePerf, lirePerf } from "@/game/ia";
import { estAdmin } from "@/game/admins";
import { titreNiveau } from "@/game/categories";
import type { Cible } from "@/game/carte/moteur";
import { SALLES, type Arrivee, type Pt, type Sortie, type ZoneId } from "@/game/carte/types";
import { ZONE_DEPART, ZONES } from "@/game/carte/zones";
import { useEcole, useSalle } from "@/game/multijoueur";
import { DUREE_STATUT, MAX_STATUT, type Etat } from "@/game/salle";
import { ajouterXp, useHeros, useMonProfil, useRafraichirProfil, type Profil } from "@/game/profil";
import { evenement, ouvrirJour, type Evenement, type Prog } from "@/game/progression";
import type { Etat as EtatCombat } from "@/game/combat";
import { majReglages, useReglages } from "@/game/reglages";
import { jouer } from "@/game/son";
import { departSolo, ecrireSolo } from "@/game/solo";
import { supabase } from "@/integrations/supabase/client";

type Fen =
  | { k: "profil"; id: string }
  | { k: "texte"; titre: string; texte: string }
  | { k: "classement" }
  | { k: "reglages" }
  | { k: "plan" }
  | { k: "tableau" }
  | { k: "messages"; id: string | null }
  | { k: "tuto" }
  | { k: "enigme"; enigme: Enigme };

const EMOTES = ["👋", "😂", "💃", "👏"];

export type ModeJeu = "multi" | "solo";

/** Écran de jeu : « multi » = monde en réseau, « solo » = mode histoire isolé (aucun canal temps réel). */
export function EcranJeu({ mode }: { mode: ModeJeu }) {
  const { data: p, isLoading } = useMonProfil();
  const nav = useNavigate();
  useEffect(() => {
    if (p && !p.personnage_cree) nav({ to: "/personnage" });
  }, [p, nav]);
  if (isLoading)
    return (
      <Chargement plein texte="Connexion à ton profil…" detail="Un instant, on te retrouve." />
    );
  if (!p)
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="pixel-box space-y-3 p-5">
          <p className="font-pixel text-xs text-destructive">Profil introuvable</p>
          <p className="text-lg">Impossible de charger ton profil pour le moment.</p>
          <button className="pixel-btn" onClick={() => nav({ to: "/" })}>
            🏠 Retour au menu
          </button>
        </div>
      </div>
    );
  return <Partie moi={p} mode={mode} />;
}

function Partie({ moi, mode }: { moi: Profil; mode: ModeJeu }) {
  const solo = mode === "solo";
  const nav = useNavigate();
  const qc = useQueryClient();
  const refresh = useRafraichirProfil();
  const reglages = useReglages();
  const { data: heros = [] } = useHeros();

  // Solo : on reprend là où on s'était arrêté. Multijoueur : toujours l'entrée de l'école.
  const [init] = useState(() => (solo ? departSolo(moi.id) : null));
  const [zoneId, setZoneId] = useState<ZoneId>(init?.zone ?? ZONE_DEPART);
  const [depart, setDepart] = useState<Arrivee>(init?.arrivee ?? ZONES[ZONE_DEPART].depart);
  const [pauseOuverte, setPauseOuverte] = useState(false);
  const [sortie, setSortie] = useState(false);
  const [pret, setPret] = useState(false);
  const [chargeFini, setChargeFini] = useState(false);
  const xpSolo = useRef(init?.xpSolo ?? 0);
  const zoneIdRef = useRef(zoneId);
  zoneIdRef.current = zoneId;
  const [fondu, setFondu] = useState(false);
  const [fen, setFen] = useState<Fen | null>(null);
  const [terminal, setTerminal] = useState<null | "cours" | "combat" | "linux" | "arcade">(null);
  const [defiFait, setDefiFait] = useState(() => lireDefi(moi.id));
  const [toast, setToast] = useState("");
  const [msg, setMsg] = useState("");
  const [statutOuvert, setStatutOuvert] = useState(false);
  const [statutTexte, setStatutTexte] = useState("");
  const [prog, setProg] = useState<Prog | null>(null);
  const [histoire, setHistoire] = useState<EtatHistoire>(() => lireHistoire(moi.id));
  const histRef = useRef(histoire);
  const [dialogue, setDialogue] = useState<{ titre: string; texte: string } | null>(null);
  const histFn = useRef<(ev: EvHistoire) => void>(() => {});
  const [montee, setMontee] = useState(0);
  const [, tictac] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const niveauPrec = useRef(moi.niveau);

  const zone = ZONES[zoneId];
  const etatRef = useRef<() => Etat>(() => ({
    x: depart.x,
    y: depart.y,
    dir: depart.dir,
    marche: false,
    run: false,
  })) as MutableRefObject<() => Etat>;
  const positionsRef = useRef<() => { moi: Pt; autres: Array<Pt & { id: string }> }>(() => ({
    moi: { x: depart.x, y: depart.y },
    autres: [],
  })) as MutableRefObject<() => { moi: Pt; autres: Array<Pt & { id: string }> }>;

  const annoncer = useCallback((t: string) => {
    setToast(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3200);
  }, []);

  const salle = useSalle(zoneId, moi, () => etatRef.current(), !solo);
  const ecole = useEcole(
    moi,
    zoneId,
    (pseudo, t) => {
      annoncer(`✉ ${pseudo} : ${t.slice(0, 50)}`);
      jouer("ok");
    },
    !solo,
  );

  // Petit rafraîchissement pour le compte à rebours du statut
  useEffect(() => {
    const t = setInterval(() => tictac((v) => v + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const gagnerXp = useCallback(
    async (n: number, texte: string) => {
      if (n <= 0) return;
      try {
        await ajouterXp(n);
        if (solo) xpSolo.current += n;
        await refresh();
        void qc.invalidateQueries({ queryKey: ["heros"] });
        jouer("xp");
        annoncer(`+${n} XP · ${texte}`);
      } catch {
        annoncer("Impossible d'ajouter l'XP pour le moment.");
      }
    },
    [annoncer, qc, refresh, solo],
  );

  /** Quêtes et badges : enregistre l'événement, donne l'XP des quêtes terminées. */
  const evt = useCallback(
    async (ev: Evenement) => {
      const { prog: pr, gains } = evenement(moi.id, ev);
      setProg(pr);
      if (gains.xp > 0)
        await gagnerXp(gains.xp, solo ? "progression" : `quête : ${gains.quetes.join(", ")}`);
      if (gains.badges.length && !solo)
        setTimeout(
          () => annoncer(`🏅 Badge débloqué : ${gains.badges.join(", ")}`),
          gains.xp > 0 ? 1800 : 0,
        );
      for (const id of gains.badgesIds) histFn.current({ k: "badge", id });
    },
    [annoncer, gagnerXp, moi.id, solo],
  );

  useEffect(() => {
    const { prog: pr, gains } = ouvrirJour(moi.id);
    setProg(pr);
    if (gains.badges.length && !solo) annoncer(`🏅 Badge débloqué : ${gains.badges.join(", ")}`);
    if (!lireTuto()) setFen({ k: "tuto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (moi.niveau > niveauPrec.current) {
      setMontee(moi.niveau);
      jouer("niveau");
      setTimeout(() => setMontee(0), 2400);
    }
    niveauPrec.current = moi.niveau;
  }, [moi.niveau]);

  /** Change de zone avec un fondu au noir. */
  /** Mode histoire : une action du jeu peut valider une mission (XP, dialogue, fin de chapitre). */
  const evHistoire = useCallback(
    (ev: EvHistoire) => {
      const { etat, gains } = progresser(histRef.current, ev);
      if (gains.missions.length === 0) return;
      histRef.current = etat;
      setHistoire(etat);
      ecrireHistoire(moi.id, etat);
      for (const m of gains.missions) annoncer(`📖 Mission accomplie : ${m.objectif}`);
      if (gains.chapitreTermine)
        setDialogue({ titre: "📖 Fin du chapitre", texte: gains.chapitreTermine.conclusion });
      else
        setDialogue({
          titre: "📖 Histoire",
          texte: gains.missions.map((m) => m.dialogue).join(" "),
        });
      if (gains.xp > 0) void gagnerXp(gains.xp, "mode histoire");
    },
    [annoncer, gagnerXp, moi.id],
  );
  histFn.current = evHistoire;

  const aller = useCallback(
    (vers: ZoneId, arrivee: Arrivee) => {
      setFondu(true);
      setTimeout(() => {
        setDepart(arrivee);
        setZoneId(vers);
        setFondu(false);
        if ((SALLES as readonly string[]).includes(vers)) void evt({ k: "visite", salle: vers });
        histFn.current({ k: "visite", salle: vers });
      }, 230);
    },
    [evt],
  );

  const onAction = useCallback(
    (c: Cible) => {
      jouer("ok");
      if (c.k === "pnj") {
        const n = c.p;
        const enigme = enigmeEnAttente(histRef.current, n.id);
        if (enigme) {
          setFen({ k: "enigme", enigme });
          return;
        }
        setFen({ k: "texte", titre: n.nom, texte: n.texte ?? "..." });
        histFn.current({ k: "parler", pnj: n.id });
        return;
      }
      const a = c.o.agir;
      if (!a) return;
      switch (a.k) {
        case "porte":
          jouer("porte");
          aller(a.vers, a.arrivee);
          break;
        case "terminal":
          setTerminal("cours");
          break;
        case "combat":
          setTerminal("combat");
          break;
        case "terminal_linux":
          setTerminal("linux");
          break;
        case "arcade":
          if (solo) annoncer("🕹️ La borne d'arcade est réservée au mode multijoueur.");
          else setTerminal("arcade");
          break;
        case "classement":
          void qc.invalidateQueries({ queryKey: ["heros"] });
          setFen({ k: "classement" });
          break;
        case "tableau":
          histFn.current({ k: "tableau" });
          void qc.invalidateQueries({ queryKey: ["reseau"] });
          setFen({ k: "tableau" });
          break;
        case "texte":
          setFen({ k: "texte", titre: a.titre, texte: a.texte });
          break;
        default: {
          const actionNonGeree: never = a;
          return actionNonGeree;
        }
      }
    },
    [aller, qc, annoncer, solo],
  );

  const onSortie = useCallback((s: Sortie) => aller(s.vers, s.arrivee), [aller]);

  const pnjs = zone.pnjs;
  const noms = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of ecole.roster) m[p.id] = p.pseudo;
    for (const a of salle.autres) m[a.id] = a.pseudo;
    return m;
  }, [ecole.roster, salle.autres]);

  /** Fin d'un combat : XP selon la difficulté et la précision, quêtes, badges, défi du jour (bonus une fois par jour). */
  const finCombat = useCallback(
    async (e: EtatCombat, xp: number, defi: boolean) => {
      let gain = xp;
      if (defi) {
        if (e.fin === "victoire") gain = Math.min(50, Math.round(xp * 1.5));
        marquerDefi(moi.id);
        setDefiFait(true);
      }
      await gagnerXp(
        gain,
        e.fin === "victoire"
          ? `combat gagné${defi ? " (défi du jour ×1,5)" : ""}`
          : "combat terminé",
      );
      void evt({ k: "quiz", score: e.bonnes, total: e.bonnes + e.mauvaises });
      if (e.fin === "victoire") void evt({ k: "monstre" });
      ecrirePerf(
        moi.id,
        enregistrerCombat(lirePerf(moi.id), {
          bonnes: e.bonnes,
          mauvaises: e.mauvaises,
          victoire: e.fin === "victoire",
          positions: e.historique,
        }),
      );
      histFn.current({
        k: "combat",
        victoire: e.fin === "victoire",
        difficulte: e.difficulte,
        bonnes: e.bonnes,
      });
    },
    [evt, gagnerXp, moi.id],
  );

  /** Sauvegarde du mode solo (position, zone, XP, histoire). Ne fait rien en multijoueur. */
  const sauvegarder = useCallback(() => {
    if (!solo) return;
    const e = etatRef.current();
    ecrireSolo(moi.id, {
      zone: zoneIdRef.current,
      x: e.x,
      y: e.y,
      dir: e.dir,
      xpSolo: xpSolo.current,
    });
    ecrireHistoire(moi.id, histRef.current);
  }, [solo, moi.id]);
  const sauvegarderRef = useRef(sauvegarder);
  sauvegarderRef.current = sauvegarder;

  // Solo : sauvegarde régulière, en quittant la page, en changeant d'onglet et en quittant l'écran.
  useEffect(() => {
    if (!solo) return;
    const sauver = () => sauvegarderRef.current();
    const cache = () => {
      if (document.visibilityState === "hidden") sauver();
    };
    window.addEventListener("pagehide", sauver);
    document.addEventListener("visibilitychange", cache);
    const t = setInterval(sauver, 10000);
    return () => {
      clearInterval(t);
      window.removeEventListener("pagehide", sauver);
      document.removeEventListener("visibilitychange", cache);
      sauver();
    };
  }, [solo]);
  useEffect(() => {
    if (solo) sauvegarderRef.current();
  }, [solo, zoneId]);

  // Écran de chargement : le temps que la carte et le réseau s'initialisent.
  useEffect(() => {
    const a = setTimeout(() => setPret(true), 700);
    const b = setTimeout(() => setChargeFini(true), 1150);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  /** Retour à l'accueil : fondu, sauvegarde (solo), puis navigation. La session de connexion est conservée. */
  const retourMenu = useCallback(() => {
    sauvegarderRef.current();
    setPauseOuverte(false);
    setSortie(true);
    setTimeout(() => nav({ to: "/" }), 280);
  }, [nav]);

  // Échap : ferme la fenêtre ouverte, sinon ouvre le menu pause (Radix ferme la pause lui-même).
  const etatUi = useRef({ fen, terminal, pauseOuverte, pret });
  etatUi.current = { fen, terminal, pauseOuverte, pret };
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const u = etatUi.current;
      if (u.pauseOuverte || u.terminal !== null || !u.pret || u.fen?.k === "tuto") return;
      const cible = e.target as HTMLElement | null;
      if (cible && (cible.tagName === "INPUT" || cible.tagName === "TEXTAREA")) {
        cible.blur();
        return;
      }
      if (u.fen !== null) setFen(null);
      else setPauseOuverte(true);
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, []);

  const fermer = () => setFen(null);
  const finTuto = () => {
    majReglages({ tutoVu: true });
    fermer();
  };
  const deco = async () => {
    sauvegarderRef.current();
    await supabase.auth.signOut();
    nav({ to: "/connexion" });
  };
  const envoyerMsg = () => {
    if (salle.dire(msg)) setMsg("");
  };
  const afficherStatut = () => {
    salle.definirStatut(statutTexte);
    setStatutOuvert(false);
    if (statutTexte.trim()) annoncer("📌 Statut affiché pendant 5 minutes.");
  };
  const retirerStatut = () => {
    salle.definirStatut("");
    setStatutTexte("");
  };
  const pause = fen !== null || terminal !== null || fondu || pauseOuverte || !pret || sortie;
  const minutes = salle.statutMoi
    ? Math.max(1, Math.ceil((salle.statutMoi.fin - Date.now()) / 60000))
    : 0;
  const onOuvrirMsg = useCallback((id: string | null) => ecole.ouvrir(id), [ecole.ouvrir]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="anim-fade-in mx-auto max-w-5xl space-y-2 p-2 transition-opacity duration-300"
      style={{
        opacity: sortie ? 0 : 1,
        zoom: reglages.grandeUi ? 1.15 : 1,
        filter: reglages.contraste ? "contrast(1.25) saturate(1.1)" : undefined,
      }}
    >
      <div className="pixel-box flex flex-wrap items-center justify-between gap-2 p-2">
        <span className="font-pixel text-xs text-primary">
          ISITECH WORLD · <span className="text-accent">{zone.nom}</span>
          {solo && <span className="ml-2 text-[9px] text-muted-foreground">📖 MODE HISTOIRE</span>}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            className="pixel-btn !px-2 !py-1"
            onClick={() => setPauseOuverte(true)}
            title="Menu (Échap)"
          >
            ☰ Menu
          </button>
          <button className="pixel-btn !px-2 !py-1" onClick={() => setFen({ k: "plan" })}>
            🗺 Carte
          </button>
          {solo ? (
            <button
              className="pixel-btn !px-2 !py-1"
              onClick={() => {
                void qc.invalidateQueries({ queryKey: ["reseau"] });
                setFen({ k: "tableau" });
              }}
            >
              📖 Missions
            </button>
          ) : (
            <button
              className="pixel-btn !px-2 !py-1"
              onClick={() => setFen({ k: "messages", id: null })}
            >
              ✉ Messages
              {ecole.nonLus > 0 && (
                <span className="ml-1 rounded-full bg-destructive px-2 text-xs text-white">
                  {ecole.nonLus}
                </span>
              )}
            </button>
          )}
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
        {!solo && (
          <span className="hidden text-sm text-muted-foreground sm:inline">
            👥 {ecole.roster.length} en ligne
          </span>
        )}
      </div>

      <div className="relative">
        <Monde
          key={zoneId}
          zone={zone}
          depart={depart}
          pnjs={pnjs}
          autres={salle.autres}
          lireAutres={salle.lireAutres}
          moi={moi}
          pause={pause}
          bulles={salle.bulles}
          statuts={salle.statuts}
          reglages={reglages}
          onAction={onAction}
          onSortie={onSortie}
          onEtat={salle.envoyerEtat}
          onClicJoueur={(id) => setFen({ k: "profil", id })}
          etatRef={etatRef}
          positionsRef={positionsRef}
        />
        <div
          className="pointer-events-none absolute inset-0 z-[2600] bg-black transition-opacity duration-200"
          style={{ opacity: fondu ? 1 : 0 }}
        />
      </div>

      {!solo && (
        <div className="pixel-box space-y-2 p-2">
          <div className="flex flex-wrap items-center gap-2">
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
              <button
                key={e}
                className="pixel-btn !px-2 !py-1 text-lg"
                onClick={() => salle.dire(e)}
              >
                {e}
              </button>
            ))}
            <button
              className={`pixel-btn !px-2 !py-1 ${salle.statutMoi ? "!bg-accent" : ""}`}
              onClick={() => setStatutOuvert((v) => !v)}
            >
              📌 Statut
            </button>
          </div>
          {(statutOuvert || salle.statutMoi) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {salle.statutMoi && (
                <span className="text-accent">
                  📌 « {salle.statutMoi.t} » · encore ~{minutes} min
                </span>
              )}
              {statutOuvert && (
                <>
                  <input
                    className="pixel-input !w-auto min-w-0 flex-1"
                    maxLength={MAX_STATUT}
                    placeholder={`Ton message au-dessus de ta tête (reste ${DUREE_STATUT / 60000} min)`}
                    value={statutTexte}
                    onChange={(e) => setStatutTexte(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") afficherStatut();
                    }}
                  />
                  <button className="pixel-btn !px-2 !py-1" onClick={afficherStatut}>
                    Afficher
                  </button>
                </>
              )}
              {salle.statutMoi && (
                <button className="pixel-btn !px-2 !py-1" onClick={retirerStatut}>
                  ✕ Retirer
                </button>
              )}
            </div>
          )}
        </div>
      )}

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

      {terminal === "cours" && (
        <Reseau
          moi={moi}
          onFermer={() => setTerminal(null)}
          onEntree={() => void evt({ k: "reseau" })}
          onDepose={() => {
            void evt({ k: "depot" });
            histFn.current({ k: "depot" });
            void gagnerXp(10, "cours déposé");
          }}
        />
      )}
      {terminal === "arcade" && !solo && (
        <Arcade
          moi={{ id: moi.id, pseudo: moi.pseudo, niveau: moi.niveau }}
          onFermer={() => setTerminal(null)}
        />
      )}
      {terminal === "linux" && <TerminalLinux onFermer={() => setTerminal(null)} />}
      {terminal === "combat" && (
        <ReseauCombat
          moi={moi}
          defiFait={defiFait}
          onFermer={() => setTerminal(null)}
          onTermine={finCombat}
        />
      )}

      {fen?.k === "profil" && (
        <Fenetre titre="Profil" onFermer={fermer}>
          <ProfilCarte id={fen.id} moi={moi} onMaj={refresh} />
          {!solo && fen.id !== moi.id && (
            <button
              className="pixel-btn mt-3"
              onClick={() => setFen({ k: "messages", id: fen.id })}
            >
              ✉ Message privé
            </button>
          )}
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
      {fen?.k === "reglages" && (
        <Reglages
          onFermer={fermer}
          onTuto={() => setFen({ k: "tuto" })}
          compte={{ id: moi.id, pseudo: moi.pseudo, admin: estAdmin(moi) }}
        />
      )}
      {fen?.k === "plan" && (
        <Plan
          zone={zoneId}
          lieu={zone.lieu}
          roster={ecole.roster}
          positionsRef={positionsRef}
          noms={noms}
          moiId={moi.id}
          onFermer={fermer}
        />
      )}
      {fen?.k === "tableau" && (
        <Tableau moi={moi} prog={prog} histoire={histoire} solo={solo} onFermer={fermer} />
      )}
      {fen?.k === "messages" && (
        <Messages
          moiId={moi.id}
          roster={ecole.roster}
          conv={ecole.conv}
          initial={fen.id}
          onEnvoyer={ecole.envoyer}
          onOuvrir={onOuvrirMsg}
          onFermer={fermer}
        />
      )}
      {fen?.k === "tuto" && <Tuto onFin={finTuto} />}
      {fen?.k === "enigme" && (
        <EnigmeFenetre
          enigme={fen.enigme}
          onFermer={fermer}
          onRepondu={(bonne) => histFn.current({ k: "enigme", id: fen.enigme.id, bonne })}
        />
      )}
      <PauseMenu
        ouvert={pauseOuverte}
        onOuvrir={setPauseOuverte}
        solo={solo}
        xpSolo={xpSolo.current}
        onProfil={() => {
          setPauseOuverte(false);
          setFen({ k: "profil", id: moi.id });
        }}
        onReglages={() => {
          setPauseOuverte(false);
          setFen({ k: "reglages" });
        }}
        onMenu={retourMenu}
        onDeco={deco}
      />
      {!chargeFini && (
        <div
          className="fixed inset-0 z-[5000] transition-opacity duration-500"
          style={{ opacity: pret ? 0 : 1, pointerEvents: pret ? "none" : "auto" }}
        >
          <Chargement
            plein
            texte={solo ? "Chargement de ta partie…" : "Connexion au monde en réseau…"}
            detail="Initialisation de la carte"
          />
        </div>
      )}
      {dialogue && !terminal && fen === null && (
        <Fenetre titre={dialogue.titre} onFermer={() => setDialogue(null)}>
          <p className="text-xl">{dialogue.texte}</p>
          <button className="pixel-btn mt-3" onClick={() => setDialogue(null)}>
            OK
          </button>
        </Fenetre>
      )}
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

/** Défi du jour : un seul par personne et par jour (enregistré sur cet appareil). */
const cleDefi = (id: string) => `isitech.defi.${id}`;
const aujourdhui = () => new Date().toLocaleDateString("sv-SE");
function lireDefi(id: string) {
  try {
    return window.localStorage.getItem(cleDefi(id)) === aujourdhui();
  } catch {
    return false;
  }
}
function marquerDefi(id: string) {
  try {
    window.localStorage.setItem(cleDefi(id), aujourdhui());
  } catch {
    /* stockage indisponible */
  }
}
