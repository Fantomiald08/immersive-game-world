import { useState } from "react";
import type { Apparence } from "@/game/apparence";
import { PartieSolo } from "@/components/game/arcade/PartieSolo";
import { LISTE_JEUX } from "@/game/arcade/jeux";
import { FORMATS_SOLO, type FormatSolo } from "@/game/arcade/partieSolo";
import type { JeuId } from "@/game/arcade/types";

/**
 * Mode solo de l'arcade : choix du mini-jeu et du format, puis partie contre des IA.
 * Ce composant ne touche jamais au réseau.
 */
export function ArcadeSolo({
  moi,
  onRetour,
  onFermer,
}: {
  moi: { id: string; pseudo: string; apparence?: Apparence | undefined };
  onRetour: () => void;
  onFermer: () => void;
}) {
  const [jeu, setJeu] = useState<JeuId>("arene");
  const [format, setFormat] = useState<FormatSolo>("1v1");
  /** Null = on choisit ; sinon une partie est en cours (la graine change à chaque partie). */
  const [graine, setGraine] = useState<number | null>(null);
  const lancer = () => setGraine(Math.floor(Math.random() * 2 ** 31));

  if (graine !== null)
    return (
      <div className="space-y-2">
        <button
          className="pixel-btn !bg-muted !px-2 !py-1 !text-foreground"
          onClick={() => setGraine(null)}
        >
          ← Quitter la partie
        </button>
        <PartieSolo
          key={graine}
          jeuId={jeu}
          format={format}
          moi={moi}
          graine={graine}
          onRejouer={lancer}
          onChanger={() => setGraine(null)}
          onFermer={onFermer}
        />
      </div>
    );

  const f = FORMATS_SOLO.find((x) => x.id === format)!;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">
          Solo <span className="text-accent">contre des IA</span>
        </h2>
        <button className="pixel-btn !bg-muted !px-2 !py-1 !text-foreground" onClick={onRetour}>
          ← Retour
        </button>
      </div>
      <p className="text-lg text-muted-foreground">
        Hors ligne : la partie se joue sur ton appareil, rien n'est envoyé sur le réseau. Chaque
        partie dure 120 secondes.
      </p>

      <section aria-label="Choix du mini-jeu">
        <h3 className="mb-1 font-pixel text-[10px] text-primary">Mini-jeu</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {LISTE_JEUX.map((j) => {
            const actif = jeu === j.id;
            return (
              <button
                key={j.id}
                aria-pressed={actif}
                onClick={() => setJeu(j.id)}
                className={`space-y-1 border-4 p-3 text-left transition-colors ${actif ? "border-accent bg-accent/15" : "border-[#2a1810] bg-muted/40 hover:border-primary"}`}
              >
                <div className="text-3xl">{j.icone}</div>
                <div className="font-pixel text-[10px] text-primary">{j.nom}</div>
                <div className="text-base leading-tight text-muted-foreground">{j.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Format de la partie">
        <h3 className="mb-1 font-pixel text-[10px] text-primary">Format</h3>
        <div className="flex flex-wrap gap-2">
          {FORMATS_SOLO.map((x) => (
            <button
              key={x.id}
              aria-pressed={format === x.id}
              onClick={() => setFormat(x.id)}
              className={`pixel-btn !px-3 !py-1 ${format === x.id ? "" : "!bg-muted !text-foreground"}`}
            >
              {x.nom}
            </button>
          ))}
        </div>
        <p className="mt-1 text-lg text-muted-foreground">
          {f.description} ({f.ia} IA)
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="pixel-btn" onClick={lancer}>
          ▶ Lancer la partie
        </button>
        <span className="text-base text-muted-foreground">
          Touches : {LISTE_JEUX.find((j) => j.id === jeu)!.aide.join(" · ")}
        </span>
      </div>
    </div>
  );
}
