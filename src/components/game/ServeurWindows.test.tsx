import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServeurWindows } from "./ServeurWindows";

vi.mock("@/game/serveur-data", () => ({
  useDonneesServeur: () => ({ isLoading: false, isError: false, data: undefined, dataUpdatedAt: 0, error: null }),
}));

const avec = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
);

describe("Gestionnaire de serveur : accès", () => {
  it("refuse l'accès à un élève", () => {
    render(avec(<ServeurWindows moi={{ id: "u1", pseudo: "Élève" }} connectes={3} onFermer={() => {}} />));
    expect(screen.getByRole("alert").textContent).toContain("Accès refusé");
    expect(screen.queryByRole("navigation", { name: "Menu" })).toBeNull();
  });

  it("ouvre le gestionnaire à un administrateur", () => {
    render(avec(<ServeurWindows moi={{ id: "u2", pseudo: "Leo Dupire" }} connectes={3} onFermer={() => {}} />));
    expect(screen.getByRole("dialog", { name: "Gestionnaire de serveur" })).toBeTruthy();
    const nav = within(screen.getByRole("complementary", { name: "Navigation du serveur" }));
    expect(nav.getByRole("button", { name: /Tableau de bord/ })).toBeTruthy();
    expect(nav.getByRole("button", { name: /Services/ })).toBeTruthy();
    expect(nav.getByRole("button", { name: /Outils/ })).toBeTruthy();
  });
});
