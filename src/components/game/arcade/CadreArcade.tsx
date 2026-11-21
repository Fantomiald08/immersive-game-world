import type { ReactNode } from "react";

/** Cadre commun de la borne : fond sombre, barre de titre, bouton de fermeture. */
export function CadreArcade({
  onFermer,
  actions,
  children,
}: {
  onFermer: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[2500] grid place-items-center bg-black/85 p-2 sm:p-4">
      <div className="pixel-box flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b-4 border-[#2a1810] px-3 py-2">
          <span className="font-pixel text-xs text-accent">🕹️ ARCADE — Salle Vénus</span>
          <div className="flex gap-2">
            {actions}
            <button
              className="pixel-btn !px-2 !py-1"
              onClick={onFermer}
              aria-label="Fermer l'arcade"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="space-y-3 overflow-auto p-3">{children}</div>
      </div>
    </div>
  );
}
