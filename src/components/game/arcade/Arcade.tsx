import { Fenetre } from "@/components/game/Fenetre";
import { Button } from "@/components/ui/button";

/** Keep the school playable while the incomplete arcade upload is unavailable. */
export function Arcade({ onFermer }: {
  moi: { id: string; pseudo: string; niveau: number };
  onFermer: () => void;
}) {
  return (
    <Fenetre titre="🕹️ ARCADE — Salle Vénus" onFermer={onFermer}>
      <div className="space-y-4">
        <p role="status" className="text-xl text-muted-foreground">
          La borne d'arcade est temporairement indisponible.
        </p>
        <Button onClick={onFermer}>Retour à la salle Vénus</Button>
      </div>
    </Fenetre>
  );
}
