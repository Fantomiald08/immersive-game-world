import { useState } from "react";
import { Fenetre } from "./Fenetre";
import type { Enigme } from "@/game/histoire";
import { jouer } from "@/game/son";

const LETTRES = ["A", "B", "C", "D", "E"];

/** Fenêtre d'énigme (mode histoire) : une question, plusieurs choix, puis le résultat. */
export function EnigmeFenetre({
  enigme,
  onFermer,
  onRepondu,
}: {
  enigme: Enigme;
  onFermer: () => void;
  onRepondu: (bonne: boolean) => void;
}) {
  const [choix, setChoix] = useState<number | null>(null);

  const repondre = (i: number) => {
    if (choix !== null) return;
    setChoix(i);
    const bonne = i === enigme.bonne;
    jouer(bonne ? "xp" : "rate");
    onRepondu(bonne);
  };

  return (
    <Fenetre titre="🧩 Énigme" onFermer={onFermer}>
      <p className="mb-3 text-xl">{enigme.question}</p>
      <div className="grid gap-2">
        {enigme.choix.map((c, i) => {
          const bonne = choix !== null && i === enigme.bonne;
          const mauvais = choix === i && i !== enigme.bonne;
          return (
            <button
              key={i}
              disabled={choix !== null}
              onClick={() => repondre(i)}
              className={`pixel-btn text-left !text-[10px] ${bonne ? "!bg-primary" : ""} ${mauvais ? "!bg-destructive" : ""} ${choix !== null && !bonne && !mauvais ? "opacity-50" : ""}`}
            >
              <span className="font-pixel text-[9px] text-accent">{LETTRES[i]}</span> {c}
            </button>
          );
        })}
      </div>
      {choix !== null && (
        <div className="mt-3 space-y-2">
          <p className={choix === enigme.bonne ? "text-primary" : "text-destructive"}>
            {choix === enigme.bonne ? enigme.succes : enigme.echec}
          </p>
          <button className="pixel-btn" onClick={onFermer}>
            OK
          </button>
        </div>
      )}
    </Fenetre>
  );
}
