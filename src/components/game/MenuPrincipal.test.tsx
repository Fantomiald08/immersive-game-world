import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => nav }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: () => Promise.resolve({}) } },
}));
vi.mock("@/game/profil", async () => {
  const { DEFAUT } = await import("@/game/apparence");
  return {
    useMonProfil: () => ({
      data: {
        id: "u1",
        pseudo: "Test",
        bio: "",
        titre: "",
        xp: 120,
        niveau: 2,
        apparence: DEFAUT,
        personnage_cree: true,
      },
      isLoading: false,
      isError: false,
      refetch: () => Promise.resolve(),
    }),
    useRafraichirProfil: () => () => Promise.resolve(),
  };
});

import { MenuPrincipal } from "./MenuPrincipal";

describe("menu principal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    nav.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("met les deux modes au centre et les boutons secondaires dans la barre du haut", () => {
    render(<MenuPrincipal />);
    const modes = within(screen.getByRole("navigation", { name: "Modes de jeu" }));
    const raccourcis = within(screen.getByRole("navigation", { name: "Raccourcis" }));

    expect(modes.getAllByRole("button")).toHaveLength(2);
    expect(modes.getByText("Mode Multijoueur")).toBeTruthy();
    expect(modes.getByText("Mode Histoire")).toBeTruthy();
    expect(modes.queryByText("Profil")).toBeNull();
    expect(modes.queryByText("Paramètres")).toBeNull();

    expect(
      raccourcis.getAllByRole("button").map((b) => b.textContent?.replace(/^\S+\s/, "")),
    ).toEqual(["Commandes", "Profil", "Paramètres"]);
  });

  it("ouvre la fenêtre Commandes avec les touches du joueur", () => {
    render(<MenuPrincipal />);
    fireEvent.click(screen.getByText(/Commandes/));
    expect(screen.getByText("Courir")).toBeTruthy();
    expect(screen.getByText(/Menu pause/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Fermer"));
    expect(screen.queryByText("Courir")).toBeNull();
  });

  it("ouvre les Paramètres depuis la barre", () => {
    render(<MenuPrincipal />);
    fireEvent.click(screen.getByText(/Paramètres/));
    expect(screen.getByLabelText("Fermer")).toBeTruthy();
  });

  it("lance /jeu en multijoueur et /histoire en solo, après le fondu", () => {
    const { unmount } = render(<MenuPrincipal />);
    fireEvent.click(screen.getByText("Mode Multijoueur"));
    act(() => void vi.advanceTimersByTime(400));
    expect(nav).toHaveBeenLastCalledWith({ to: "/jeu" });
    unmount();

    render(<MenuPrincipal />);
    fireEvent.click(screen.getByText("Mode Histoire"));
    act(() => void vi.advanceTimersByTime(400));
    expect(nav).toHaveBeenLastCalledWith({ to: "/histoire" });
  });
});
