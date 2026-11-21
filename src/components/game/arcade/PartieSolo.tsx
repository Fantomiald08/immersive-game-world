import { useEffect, useRef, useState } from "react";
import { useControles } from "@/components/game/arcade/useControles";
import { VuePartie } from "@/components/game/arcade/VuePartie";
import { JEUX } from "@/game/arcade/jeux";
import { avancerSolo, creerPartieSolo, type FormatSolo } from "@/game/arcade/partieSolo";
import type { JeuId, Resultat } from "@/game/arcade/types";

const PAS = 1 / 60;

/**
 * Une partie solo contre des IA. Tout est local : aucune connexion réseau n'est ouverte.
 * La boucle d'animation s'arrête d'elle-même à la fin de la partie, et tout (boucle, clavier,
 * boutons à l'écran) est nettoyé quand le composant disparaît.
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
  moi: { id: string; pseudo: string };
  graine: number;
  onRejouer: () => void;
  onChanger: () => void;
  onFermer: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const touches = useRef(0);
  const { appuyer } = useControles(true, (bits) => {
    touches.current = bits;
  });
  const jeu = JEUX[jeuId];

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const partie = creerPartieSolo(jeuId, { id: moi.id, pseudo: moi.pseudo }, format, graine);
    let raf = 0;
    let vivant = true;
    let fini = false;
    let derniere = performance.now();
    let reste = 0;
    const boucle = (now: number) => {
      if (!vivant) return;
      reste += Math.min(0.1, (now - derniere) / 1000);
      derniere = now;
      let n = 0;
      while (reste >= PAS && n++ < 6) {
        avancerSolo(partie, touches.current, PAS);
        reste -= PAS;
      }
      if (n >= 6) reste = 0;
      ctx.clearRect(0, 0, c.width, c.height);
      jeu.dessiner(ctx, partie.etat, moi.id);
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
  }, [jeuId, format, graine, jeu, moi.id, moi.pseudo]);

  return (
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
  );
}
