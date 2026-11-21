import { useCallback, useEffect, useRef } from "react";
import { BTN } from "@/game/arcade/types";

/**
 * Touches du clavier → boutons de la manette.
 * Déplacement : ZQSD (ou WASD, mêmes touches physiques) et flèches.
 * Actions : Espace / J (A), K / Maj (B), L / E (C).
 */
function boutonClavier(e: KeyboardEvent): number {
  switch (e.code) {
    case "ArrowUp":
    case "KeyW":
      return BTN.haut;
    case "ArrowDown":
    case "KeyS":
      return BTN.bas;
    case "ArrowLeft":
    case "KeyA":
      return BTN.gauche;
    case "ArrowRight":
    case "KeyD":
      return BTN.droite;
    case "Space":
    case "KeyJ":
      return BTN.a;
    case "KeyK":
    case "ShiftLeft":
    case "ShiftRight":
      return BTN.b;
    case "KeyL":
    case "KeyE":
      return BTN.c;
  }
  // Claviers non AZERTY : Z / Q tapés directement.
  switch (e.key.toLowerCase()) {
    case "z":
      return BTN.haut;
    case "q":
      return BTN.gauche;
  }
  return 0;
}

/**
 * Regroupe clavier et boutons à l'écran dans un seul nombre de boutons pressés.
 * `surChangement` est appelé à chaque changement ; tout est remis à zéro au démontage et quand la fenêtre perd le focus.
 */
export function useControles(actif: boolean, surChangement: (bits: number) => void) {
  const clavier = useRef(0);
  const tactile = useRef(0);
  const dernier = useRef(0);
  const cb = useRef(surChangement);
  cb.current = surChangement;

  const maj = useCallback(() => {
    const b = clavier.current | tactile.current;
    if (b === dernier.current) return;
    dernier.current = b;
    cb.current(b);
  }, []);

  useEffect(() => {
    if (!actif) return;
    const cible = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
    };
    const bas = (e: KeyboardEvent) => {
      if (cible(e)) return;
      const b = boutonClavier(e);
      if (!b) return;
      e.preventDefault();
      clavier.current |= b;
      maj();
    };
    const haut = (e: KeyboardEvent) => {
      const b = boutonClavier(e);
      if (!b) return;
      clavier.current &= ~b;
      maj();
    };
    const raz = () => {
      clavier.current = 0;
      tactile.current = 0;
      maj();
    };
    window.addEventListener("keydown", bas);
    window.addEventListener("keyup", haut);
    window.addEventListener("blur", raz);
    return () => {
      window.removeEventListener("keydown", bas);
      window.removeEventListener("keyup", haut);
      window.removeEventListener("blur", raz);
      raz();
    };
  }, [actif, maj]);

  const appuyer = useCallback(
    (bit: number, bas: boolean) => {
      tactile.current = bas ? tactile.current | bit : tactile.current & ~bit;
      maj();
    },
    [maj],
  );
  return { appuyer };
}
