import { useEffect, useRef, useState } from "react";
import { useControles } from "@/components/game/arcade/useControles";
import { VuePartie } from "@/components/game/arcade/VuePartie";
import { JEUX } from "@/game/arcade/jeux";
import { Effets } from "@/game/arcade/fx";
import {
  avancerSolo,
  creerPartieSolo,
  type FormatSolo,
  type PartieSolo as EtatSolo,
} from "@/game/arcade/partieSolo";
import type { Apparence } from "@/game/apparence";
import type { JeuId, Resultat } from "@/game/arcade/types";

const PAS = 1 / 60;

/**
 * Une partie solo contre des IA. Tout est local : aucune connexion réseau n'est ouverte.
 * La boucle d'animation s'arrête d'elle-même en pause et à la fin de la partie, et tout
 * (boucle, clavier, boutons à l'écran) est nettoyé quand le composant disparaît.
 */
export function PartieSolo({
  jeuId,
  format,
  moi,
  graine,
  onRejouer,
  onChanger,
  onFermer,
}: {
  jeuId: JeuId;
  format: FormatSolo;
  moi: { id: string; pseudo: string; apparence?: Apparence | undefined };
  graine: number;
  onRejouer: () => void;
  onChanger: () => void;
  onFermer: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enPause, setEnPause] = useState(false);
  const touches = useRef(0);
  // L'apparence est figée à l'ouverture : un rafraîchissement du profil ne doit jamais relancer la partie.
  const apparence = useRef(moi.apparence);
  const partieRef = useRef<EtatSolo | null>(null);
  const fxRef = useRef<Effets | null>(null);
  const jeu = JEUX[jeuId];

  const { appuyer } = useControles(!enPause && resultat === null, (bits) => {
    touches.current = bits;
  });

  // Initialisation de la partie à chaque nouvelle graine / jeu / format.
  useEffect(() => {
    partieRef.current = creerPartieSolo(
      jeuId,
      { id: moi.id, pseudo: moi.pseudo, apparence: apparence.current },
      format,
      graine,
    );
    fxRef.current = new Effets();
    setResultat(null);
    setEnPause(false);
    return () => {
      partieRef.current = null;
      fxRef.current = null;
    };
  }, [jeuId, format, graine, moi.id, moi.pseudo]);

  // Touche Échap : bascule la pause pendant la partie.
  useEffect(() => {
    if (resultat !== null) return;
    const touche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      e.preventDefault();
      setEnPause((p) => !p);
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [resultat]);

  // Boucle 60 FPS : suspendue proprement en pause et stoppée à la fin de la partie.
  useEffect(() => {
    if (enPause) return;
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    const partie = partieRef.current;
    const fx = fxRef.current;
    if (!c || !ctx || !partie || !fx) return;
    if (partie.etat.phase === "fini") return;

    let raf = 0;
    let vivant = true;
    let fini = false;
    let derniere = performance.now();
    let reste = 0;

    const boucle = (now: number) => {
      if (!vivant) return;
      // Pas de temps plafonné à 50 ms : un onglet en veille ne fait jamais « sauter » la partie.
      const dtImage = Math.min(0.05, (now - derniere) / 1000);
      reste += dtImage;
      derniere = now;
      let n = 0;
      while (reste >= PAS && n++ < 6) {
        avancerSolo(partie, touches.current, PAS);
        reste -= PAS;
      }
      if (n >= 6) reste = 0;
      fx.maj(dtImage);
      ctx.clearRect(0, 0, c.width, c.height);
      jeu.dessiner(ctx, partie.etat, moi.id, fx);
      if (partie.etat.phase === "fini") {
        fini = true;
        setResultat(partie.etat.resultat);
      }
      if (!fini) raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);
    return () => {
      vivant = false;
      cancelAnimationFrame(raf);
    };
  }, [enPause, graine, jeu, moi.id]);

  return (
    <div className="relative space-y-2">
      <div className="flex justify-end">
        {resultat === null && (
          <button
            className="pixel-btn !bg-muted !px-2 !py-1 !text-foreground"
            onClick={() => setEnPause((p) => !p)}
          >
            {enPause ? "▶ Reprendre" : "⏸ Pause"}
          </button>
        )}
      </div>
      <VuePartie
        jeu={jeu}
        canvas={canvas}
        moiId={moi.id}
        resultat={resultat}
        enAttente={false}
        appuyer={appuyer}
        actionsFin={
          <>
            <button className="pixel-btn" onClick={onRejouer}>
              ↻ Rejouer
            </button>
            <button className="pixel-btn !bg-muted !text-foreground" onClick={onChanger}>
              ⚙ Changer de jeu
            </button>
            <button className="pixel-btn !bg-accent" onClick={onFermer}>
              🏠 Retour à la salle Vénus
            </button>
          </>
        }
      />
      {enPause && resultat === null && (
        <div
          role="dialog"
          aria-label="Pause"
          className="fixed inset-0 z-[2600] grid place-items-center bg-black/75 p-4"
        >
          <div className="pixel-box w-full max-w-sm space-y-3 p-5 text-center">
            <h3 className="font-pixel text-sm text-accent">⏸ PAUSE</h3>
            <button className="pixel-btn w-full" onClick={() => setEnPause(false)}>
              ▶ Reprendre
            </button>
            <button className="pixel-btn w-full" onClick={onRejouer}>
              ↻ Recommencer
            </button>
            <button className="pixel-btn w-full !bg-muted !text-foreground" onClick={onChanger}>
              ⚙ Changer de jeu
            </button>
            <button className="pixel-btn w-full !bg-accent" onClick={onFermer}>
              🏠 Retour à la salle Vénus
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
