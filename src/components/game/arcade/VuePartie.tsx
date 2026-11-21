import type { ReactNode, RefObject } from "react";
import { Manette } from "@/components/game/arcade/Manette";
import { COULEUR_EQUIPE, type Jeu, type Resultat } from "@/game/arcade/types";

/**
 * Affichage d'une partie : canvas, écran de résultat et manette.
 * Partagé par la partie en réseau et la partie solo, qui ne diffèrent que par leur boucle de jeu
 * et par les boutons proposés à la fin (`actionsFin`).
 */
export function VuePartie({
  jeu,
  canvas,
  moiId,
  resultat,
  enAttente,
  appuyer,
  actionsFin,
}: {
  jeu: Jeu;
  canvas: RefObject<HTMLCanvasElement | null>;
  moiId: string;
  resultat: Resultat | null;
  enAttente: boolean;
  appuyer: (bit: number, bas: boolean) => void;
  actionsFin: ReactNode;
}) {
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
                {resultat.lignes.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="mr-2 font-pixel text-xs text-primary">{l.rang}.</span>
                      <span style={{ color: COULEUR_EQUIPE[l.equipe] }}>{l.pseudo}</span>
                      {l.id === moiId && " (toi)"}
                    </span>
                    <span className="text-muted-foreground">{l.texte}</span>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap justify-center gap-2">{actionsFin}</div>
            </div>
          </div>
        )}
      </div>
      <Manette boutons={jeu.boutons} appuyer={appuyer} />
      <p className="text-center text-sm text-muted-foreground">{jeu.aide.join("  ·  ")}</p>
    </div>
  );
}
