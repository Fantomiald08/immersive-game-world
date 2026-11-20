import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const canaux: string[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const canal = () => {
    const c = {
      on: () => c,
      subscribe: () => c,
      send: () => Promise.resolve("ok"),
      track: () => Promise.resolve("ok"),
      presenceState: () => ({}),
    };
    return c;
  };
  return {
    supabase: {
      channel: (nom: string) => {
        canaux.push(nom);
        return canal();
      },
      removeChannel: () => Promise.resolve("ok"),
    },
  };
});

import { useEcole, useSalle } from "./multijoueur";
import type { Profil } from "./profil";
import { DEFAUT } from "./apparence";

const moi: Profil = {
  id: "u1",
  pseudo: "Test",
  bio: "",
  titre: "",
  xp: 0,
  niveau: 1,
  apparence: DEFAUT,
  personnage_cree: true,
};
const etat = () => ({ x: 1, y: 1, dir: "bas" as const, marche: false, run: false });

describe("isolation du mode solo", () => {
  beforeEach(() => {
    canaux.length = 0;
  });

  it("ne crée aucun canal temps réel quand le mode solo est actif", () => {
    const salle = renderHook(() => useSalle("accueil", moi, etat, false));
    const ecole = renderHook(() => useEcole(moi, "accueil", undefined, false));
    expect(canaux).toEqual([]);
    expect(salle.result.current.autres).toEqual([]);
    expect(ecole.result.current.roster).toEqual([]);
    salle.unmount();
    ecole.unmount();
  });

  it("crée bien les canaux en multijoueur", () => {
    const salle = renderHook(() => useSalle("accueil", moi, etat));
    const ecole = renderHook(() => useEcole(moi, "accueil"));
    expect(canaux).toContain("salle:accueil");
    expect(canaux).toContain("ecole");
    salle.unmount();
    ecole.unmount();
  });
});
