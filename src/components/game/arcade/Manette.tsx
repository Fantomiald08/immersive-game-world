import { useState, type PointerEvent } from "react";
import { BTN, type BoutonsEcran } from "@/game/arcade/types";

function Bouton({
  bit,
  texte,
  etiquette,
  appuyer,
  classe = "",
}: {
  bit: number;
  texte: string;
  etiquette?: string | undefined;
  appuyer: (bit: number, bas: boolean) => void;
  classe?: string;
}) {
  const [enfonce, setEnfonce] = useState(false);
  const bas = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setEnfonce(true);
    appuyer(bit, true);
  };
  const haut = () => {
    setEnfonce(false);
    appuyer(bit, false);
  };
  return (
    <button
      type="button"
      aria-label={etiquette ?? texte}
      onPointerDown={bas}
      onPointerUp={haut}
      onPointerCancel={haut}
      onLostPointerCapture={haut}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex touch-none select-none flex-col items-center justify-center rounded-lg border-4 border-[#2a1810] font-pixel leading-none text-white shadow-[0_4px_0_#2a1810] ${enfonce ? "translate-y-1 brightness-125 shadow-none" : ""} ${classe}`}
    >
      <span className="text-xl">{texte}</span>
      {etiquette && <span className="mt-1 text-[8px]">{etiquette}</span>}
    </button>
  );
}

/** Manette à l'écran : croix directionnelle à gauche, boutons d'action à droite. */
export function Manette({
  boutons,
  appuyer,
}: {
  boutons: BoutonsEcran;
  appuyer: (bit: number, bas: boolean) => void;
}) {
  const dir = "h-14 w-14 bg-[#3b4a6b] sm:h-12 sm:w-12";
  return (
    <div className="flex items-end justify-between gap-4 p-2" aria-label="Manette à l'écran">
      <div className="grid grid-cols-3 grid-rows-3 gap-1">
        <span />
        <Bouton bit={BTN.haut} texte="▲" etiquette={boutons.haut} appuyer={appuyer} classe={dir} />
        <span />
        <Bouton bit={BTN.gauche} texte="◀" appuyer={appuyer} classe={dir} />
        <span />
        <Bouton bit={BTN.droite} texte="▶" appuyer={appuyer} classe={dir} />
        <span />
        <Bouton bit={BTN.bas} texte="▼" etiquette={boutons.bas} appuyer={appuyer} classe={dir} />
        <span />
      </div>
      <div className="flex items-end gap-2">
        {boutons.c && (
          <Bouton
            bit={BTN.c}
            texte="C"
            etiquette={boutons.c}
            appuyer={appuyer}
            classe="h-14 w-14 bg-[#2f9e5a] sm:h-12 sm:w-12"
          />
        )}
        {boutons.b && (
          <Bouton
            bit={BTN.b}
            texte="B"
            etiquette={boutons.b}
            appuyer={appuyer}
            classe="mb-4 h-16 w-16 bg-[#d98a1c] sm:h-14 sm:w-14"
          />
        )}
        <Bouton
          bit={BTN.a}
          texte="A"
          etiquette={boutons.a}
          appuyer={appuyer}
          classe="mb-8 h-[4.5rem] w-[4.5rem] bg-[#d1384f] sm:h-16 sm:w-16"
        />
      </div>
    </div>
  );
}
