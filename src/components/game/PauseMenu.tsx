import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";

/** Menu pause (touche Échap ou bouton Menu) : reprendre, profil, paramètres, retour à l'accueil. */
export function PauseMenu({
  ouvert,
  onOuvrir,
  solo,
  xpSolo,
  onProfil,
  onReglages,
  onMenu,
  onDeco,
}: {
  ouvert: boolean;
  onOuvrir: (v: boolean) => void;
  solo: boolean;
  xpSolo: number;
  onProfil: () => void;
  onReglages: () => void;
  onMenu: () => void;
  onDeco: () => void;
}) {
  return (
    <Dialog open={ouvert} onOpenChange={onOuvrir}>
      <DialogPortal>
        <DialogOverlay className="z-[5200] bg-black/70" />
        <DialogPrimitive.Content
          className="pixel-box fixed left-1/2 top-1/2 z-[5201] w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 space-y-3 p-5 outline-none"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogTitle className="text-center font-pixel text-sm font-normal text-accent">
            ⏸ PAUSE
          </DialogTitle>
          <DialogDescription className="text-center text-lg text-muted-foreground">
            {solo
              ? `Mode histoire (solo) · ta progression est sauvegardée${xpSolo > 0 ? ` · +${xpSolo} XP gagnés en solo` : ""}.`
              : "Mode multijoueur · le jeu continue pour les autres joueurs."}
          </DialogDescription>
          <button className="pixel-btn w-full" onClick={() => onOuvrir(false)} autoFocus>
            ▶ Reprendre
          </button>
          <button className="pixel-btn w-full" onClick={onProfil}>
            👤 Profil
          </button>
          <button className="pixel-btn w-full" onClick={onReglages}>
            ⚙ Paramètres
          </button>
          <button className="pixel-btn w-full !bg-accent" onClick={onMenu}>
            🏠 Retour au menu
          </button>
          <button className="pixel-btn w-full !bg-destructive" onClick={onDeco}>
            ⏻ Déconnexion
          </button>
          <p className="text-center text-sm text-muted-foreground">Échap pour reprendre</p>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
