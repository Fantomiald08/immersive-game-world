import { useEffect, useMemo, useRef, useState } from "react";
import { Manette } from "@/components/game/arcade/Manette";
import { useControles } from "@/components/game/arcade/useControles";
import { abandonner, avancer, melange } from "@/game/arcade/moteur";
import type { ArcadeReseau } from "@/game/arcade/reseau";
import { joueursDePartie, type RoomVue } from "@/game/arcade/room";
import type { EtatBase, Jeu, PhasePartie, Resultat } from "@/game/arcade/types";
import { entreeRobot, ID_BOT, joueursSolo } from "@/game/arcade/solo";

const PAS = 1 / 60;
/** L'hôte envoie l'état 8 fois par seconde (2 fois par seconde une fois la partie finie). */
const INTERVALLE_ETAT = 125;
const INTERVALLE_ETAT_FIN = 500;
const RENVOI_TOUCHES = 400;

type Recu = { prev: EtatBase | null; cur: EtatBase | null; quand: number };

/**
 * Une partie en cours. L'hôte (propriétaire de la room) fait tourner la simulation et envoie l'état ;
 * les autres joueurs envoient leurs touches et affichent l'état reçu, lissé entre deux envois.
 */
export function PartieArcade({
  jeu,
  room,
  moiId,
  reseau,
  onPhase,
  onRetourRoom,
  onQuitterRoom,
  onFermer,
  solo = false,
}: {
  jeu: Jeu;
  room: RoomVue;
  moiId: string;
  reseau: ArcadeReseau;
  onPhase: (p: PhasePartie) => void;
  onRetourRoom: () => void;
  onQuitterRoom: () => void;
  onFermer: () => void;
  solo?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hote = room.proprietaire.id === moiId;
  const manche = room.manche;
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enAttente, setEnAttente] = useState(!hote);

  const roomRef = useRef(room);
  roomRef.current = room;
  const sim = useRef<EtatBase | null>(null);
  const entrees = useRef<Record<string, number>>({});
  const recu = useRef<Recu>({ prev: null, cur: null, quand: 0 });
  const mesTouches = useRef(0);
  const onPhaseRef = useRef(onPhase);
  onPhaseRef.current = onPhase;
  const { envoyerEntree, envoyerSnapshot, abonner } = reseau;

  // Touches : clavier + boutons à l'écran. L'hôte les lit directement, les autres les envoient.
  const { appuyer } = useControles(true, (bits) => {
    mesTouches.current = bits;
    if (!hote) envoyerEntree(manche, bits);
  });
  // Les touches maintenues sont renvoyées régulièrement, au cas où un message se perdrait.
  useEffect(() => {
    if (hote) return;
    const t = setInterval(() => {
      if (mesTouches.current !== 0) envoyerEntree(manche, mesTouches.current);
    }, RENVOI_TOUCHES);
    return () => clearInterval(t);
  }, [hote, manche, envoyerEntree]);

  // Boucle principale : un nouveau départ à chaque nouvelle partie (manche) ou changement d'hôte.
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    recu.current = { prev: null, cur: null, quand: 0 };
    entrees.current = {};
    let derniereEnvoi = 0;
    let derniereImage = performance.now();
    let reste = 0;
    let phaseVue: PhasePartie | "" = "";
    let raf = 0;
    let vivant = true;

    const lancer = (arret: () => void) => {
      const boucle = (now: number) => {
        if (!vivant) return;
        const dt = Math.min(0.1, (now - derniereImage) / 1000);
        derniereImage = now;
        let etat: EtatBase | null = null;
        if (hote && sim.current) {
          const s = sim.current;
          // Un joueur parti de la room abandonne la partie.
          const presents = new Set(roomRef.current.joueurs.map((j) => j.id));
          for (const j of s.joueurs) if (!j.absent && !(solo && j.id === ID_BOT) && !presents.has(j.id)) abandonner(jeu, s, j.id);
          entrees.current[moiId] = mesTouches.current;
          reste += dt;
          let n = 0;
          while (reste >= PAS && n++ < 6) {
            if (solo) entrees.current[ID_BOT] = entreeRobot(jeu.id, s);
            avancer(jeu, s, entrees.current, PAS);
            reste -= PAS;
          }
          if (n >= 6) reste = 0;
          const cadence = s.phase === "fini" ? INTERVALLE_ETAT_FIN : INTERVALLE_ETAT;
          if (!solo && now - derniereEnvoi >= cadence) {
            derniereEnvoi = now;
            envoyerSnapshot(manche, s);
          }
          etat = s;
        } else if (recu.current.cur) {
          const r = recu.current;
          const courant = r.cur;
          if (!courant) return;
          const t = Math.min(1, (now - r.quand) / INTERVALLE_ETAT);
          etat = r.prev && r.prev !== courant ? melange(r.prev, courant, t) : courant;
          // Les valeurs « logiques » (phase, résultat) viennent toujours du dernier état reçu.
          etat = { ...etat, phase: courant.phase, resultat: courant.resultat };
        }
        if (etat) {
          ctx.clearRect(0, 0, c.width, c.height);
          jeu.dessiner(ctx, etat, moiId);
          if (etat.phase !== phaseVue) {
            phaseVue = etat.phase;
            onPhaseRef.current(etat.phase);
            setResultat(etat.phase === "fini" ? etat.resultat : null);
          }
        }
        raf = requestAnimationFrame(boucle);
      };
      raf = requestAnimationFrame(boucle);
      return () => {
        vivant = false;
        cancelAnimationFrame(raf);
        arret();
        sim.current = null;
      };
    };

    if (hote) {
      sim.current = jeu.creer(solo ? joueursSolo(roomRef.current.proprietaire) : joueursDePartie(roomRef.current), roomRef.current.graine);
      setEnAttente(false);
      if (solo) return lancer(() => {});
      const arret = abonner({
        entree: (id, bits) => {
          entrees.current[id] = bits;
        },
      });
      return lancer(arret);
    }
    sim.current = null;
    setEnAttente(true);
    const arret = abonner({
      snapshot: (k, etat) => {
        if (k !== manche || !etat || typeof etat !== "object") return;
        const r = recu.current;
        r.prev = r.cur ?? (etat as EtatBase);
        r.cur = etat as EtatBase;
        r.quand = performance.now();
        setEnAttente(false);
      },
    });
    return lancer(arret);
  }, [jeu, hote, manche, moiId, abonner, envoyerSnapshot, solo]);

  const classement = useMemo(() => resultat?.lignes ?? [], [resultat]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative mx-auto w-full max-w-[800px] overflow-hidden rounded-lg border-4 border-[#2a1810] bg-black">
        <canvas
          ref={canvas}
          width={jeu.largeur}
          height={jeu.hauteur}
          className="block h-auto w-full"
          aria-label={`Partie : ${jeu.nom}`}
        />
        {enAttente && (
          <div className="absolute inset-0 grid place-items-center bg-black/70 text-center">
            <p className="anim-blink font-pixel text-xs text-primary">En attente du départ…</p>
          </div>
        )}
        {resultat && (
          <div className="absolute inset-0 grid place-items-center overflow-auto bg-black/80 p-3">
            <div className="pixel-box w-full max-w-md space-y-3 p-4 text-center">
              <h3 className="font-pixel text-sm text-accent">🏁 {resultat.titre}</h3>
              <ol className="space-y-1 text-left text-lg">
                {classement.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="mr-2 font-pixel text-xs text-primary">{l.rang}.</span>
                      <span style={{ color: l.equipe === 0 ? "#4da3ff" : "#ff6b6b" }}>
                        {l.pseudo}
                      </span>
                      {l.id === moiId && " (toi)"}
                    </span>
                    <span className="text-muted-foreground">{l.texte}</span>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap justify-center gap-2">
                {hote ? (
                  <button className="pixel-btn" onClick={onRetourRoom}>
                    {solo ? "↩ Choisir un jeu" : "↩ Retour à la room"}
                  </button>
                ) : (
                  <p className="w-full text-lg text-muted-foreground">
                    En attente du propriétaire…
                  </p>
                )}
                {!solo && <button className="pixel-btn !bg-muted !text-foreground" onClick={onQuitterRoom}>
                  Quitter la room
                </button>}
                <button className="pixel-btn !bg-accent" onClick={onFermer}>
                  🏠 Retour à la salle Vénus
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Manette boutons={jeu.boutons} appuyer={appuyer} />
      <p className="text-center text-sm text-muted-foreground">{jeu.aide.join("  ·  ")}</p>
    </div>
  );
}
