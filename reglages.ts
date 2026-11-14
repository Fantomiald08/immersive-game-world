import { useSyncExternalStore } from "react";

/** Réglages du joueur (touches, son, affichage). Sauvegardés dans le navigateur. */
export type Action = "haut" | "bas" | "gauche" | "droite" | "agir" | "courir";
export const ACTIONS: Action[] = ["haut", "bas", "gauche", "droite", "agir", "courir"];
export const NOM_ACTION: Record<Action, string> = {
  haut: "Monter",
  bas: "Descendre",
  gauche: "Aller à gauche",
  droite: "Aller à droite",
  agir: "Interagir (portes, ordinateurs, personnages)",
  courir: "Courir",
};

export type Reglages = {
  touches: Record<Action, string[]>;
  volume: number;
  muet: boolean;
  noms: boolean;
  bulles: boolean;
  grandeUi: boolean;
  contraste: boolean;
  joystick: "petit" | "normal" | "grand";
  tutoVu: boolean;
};

const FL = { haut: "arrowup", bas: "arrowdown", gauche: "arrowleft", droite: "arrowright" };
export const PRESETS = {
  azerty: {
    haut: ["z", FL.haut],
    bas: ["s", FL.bas],
    gauche: ["q", FL.gauche],
    droite: ["d", FL.droite],
    agir: [" ", "e"],
    courir: ["shift"],
  },
  qwerty: {
    haut: ["w", FL.haut],
    bas: ["s", FL.bas],
    gauche: ["a", FL.gauche],
    droite: ["d", FL.droite],
    agir: [" ", "e"],
    courir: ["shift"],
  },
  fleches: {
    haut: [FL.haut],
    bas: [FL.bas],
    gauche: [FL.gauche],
    droite: [FL.droite],
    agir: [" "],
    courir: ["shift"],
  },
} satisfies Record<string, Reglages["touches"]>;
export type NomPreset = keyof typeof PRESETS;

export const DEFAUT_REGLAGES: Reglages = {
  touches: PRESETS.azerty,
  volume: 0.5,
  muet: false,
  noms: true,
  bulles: true,
  grandeUi: false,
  contraste: false,
  joystick: "normal",
  tutoVu: false,
};

const CLE = "isitech.reglages.v3";
function charger(): Reglages {
  try {
    const brut = typeof window !== "undefined" ? window.localStorage.getItem(CLE) : null;
    if (!brut) return DEFAUT_REGLAGES;
    const v = JSON.parse(brut) as Partial<Reglages>;
    return {
      ...DEFAUT_REGLAGES,
      ...v,
      touches: { ...DEFAUT_REGLAGES.touches, ...(v.touches ?? {}) },
    };
  } catch {
    return DEFAUT_REGLAGES;
  }
}

let etat: Reglages = DEFAUT_REGLAGES;
let initialise = false;
const abonnes = new Set<() => void>();
const init = () => {
  if (!initialise && typeof window !== "undefined") {
    etat = charger();
    initialise = true;
  }
};

export function majReglages(p: Partial<Reglages>) {
  init();
  etat = { ...etat, ...p };
  try {
    window.localStorage.setItem(CLE, JSON.stringify(etat));
  } catch {
    /* stockage indisponible : on garde en mémoire */
  }
  abonnes.forEach((f) => f());
}
export const reinitialiserReglages = () => majReglages({ ...DEFAUT_REGLAGES, tutoVu: true });
export const lireReglages = (): Reglages => {
  init();
  return etat;
};

export function useReglages(): Reglages {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => lireReglages(),
    () => DEFAUT_REGLAGES,
  );
}

/** Quelle action correspond à cette touche (ou undefined) ? */
export function actionDeTouche(r: Reglages, touche: string): Action | undefined {
  return ACTIONS.find((a) => r.touches[a].includes(touche));
}

/** Nom lisible d'une touche. */
export function nomTouche(t: string): string {
  const m: Record<string, string> = {
    " ": "Espace",
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    shift: "Maj",
    enter: "Entrée",
    control: "Ctrl",
    tab: "Tab",
  };
  return m[t] ?? t.toUpperCase();
}
