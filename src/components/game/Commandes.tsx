import { Fenetre } from "@/components/game/Fenetre";
import { ACTIONS, NOM_ACTION, nomTouche, useReglages } from "@/game/reglages";

/** Fenêtre « Commandes » : rappel des touches actuelles du joueur (elles se changent dans Paramètres). */
export function Commandes({
  onFermer,
  onReglages,
}: {
  onFermer: () => void;
  onReglages: () => void;
}) {
  const r = useReglages();
  const fixes: Array<[string, string]> = [
    ["Échap", "Menu pause (reprendre, profil, retour à l'accueil)"],
    ["Clic / toucher", "Interagir avec un joueur de la carte"],
    ["Joystick (mobile)", "Se déplacer avec le pouce"],
  ];
  return (
    <Fenetre titre="⌨ Commandes" onFermer={onFermer}>
      <ul className="space-y-2">
        {ACTIONS.map((a) => (
          <li key={a} className="flex items-center justify-between gap-3">
            <span className="text-lg">{NOM_ACTION[a]}</span>
            <span className="flex flex-wrap justify-end gap-1">
              {r.touches[a].map((t) => (
                <kbd key={t} className="border-2 border-border bg-muted px-2 py-0.5 text-base">
                  {nomTouche(t)}
                </kbd>
              ))}
            </span>
          </li>
        ))}
        {fixes.map(([touche, texte]) => (
          <li key={touche} className="flex items-center justify-between gap-3">
            <span className="text-lg">{texte}</span>
            <kbd className="border-2 border-border bg-muted px-2 py-0.5 text-base">{touche}</kbd>
          </li>
        ))}
      </ul>
      <button className="pixel-btn mt-4 w-full" onClick={onReglages}>
        ⚙ Changer les touches
      </button>
    </Fenetre>
  );
}
