import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hub, moduleSupabase } from "@/test/fauxRealtime";

vi.mock(
  "@/integrations/supabase/client",
  async () => (await import("@/test/fauxRealtime")).moduleSupabase,
);

import { Arcade } from "./Arcade";

const moi = { id: "leo", pseudo: "Léo", niveau: 1 };

/** Faux contexte 2D : accepte tous les ordres de dessin, ce qui suffit à faire tourner les jeux. */
const faussContexte = () => {
  const degrade = { addColorStop: () => {} };
  return new Proxy(
    {},
    {
      get: (_t, k) =>
        k === "createLinearGradient" || k === "createRadialGradient"
          ? () => degrade
          : k === "measureText"
            ? () => ({ width: 10 })
            : () => {},
      set: () => true,
    },
  );
};

const avancer = (secondes: number) => {
  for (let i = 0; i < secondes; i++) act(() => void vi.advanceTimersByTime(1000));
};

let canal: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
      "Date",
    ],
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    faussContexte() as unknown as CanvasRenderingContext2D,
  );
  canal = vi.spyOn(moduleSupabase.supabase, "channel");
});
afterEach(() => {
  hub.vider();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const ouvrirSolo = (jeu?: RegExp, format?: string) => {
  const r = render(<Arcade moi={moi} onFermer={() => {}} />);
  fireEvent.click(screen.getByText(/Jouer en solo/));
  if (jeu) fireEvent.click(screen.getByRole("button", { name: jeu }));
  if (format) fireEvent.click(screen.getByRole("button", { name: format }));
  return r;
};

describe("arcade en solo", () => {
  it("l'entrée propose Créer, Rejoindre et Jouer en solo, sans ouvrir de connexion", () => {
    render(<Arcade moi={moi} onFermer={() => {}} />);
    expect(screen.getByText("Créer une room")).toBeTruthy();
    expect(screen.getByText("Rejoindre une room")).toBeTruthy();
    expect(screen.getByText(/Jouer en solo \(contre des IA\)/)).toBeTruthy();
    expect(canal).not.toHaveBeenCalled();
  });

  it("propose les 3 jeux et les 3 formats avec leur description", () => {
    ouvrirSolo();
    for (const nom of [/Arène multi-rounds/, /Course de véhicules/, /Combat 2D/])
      expect(screen.getByRole("button", { name: nom })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1v1" }));
    expect(screen.getByText(/Toi contre 1 IA/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "2v2" }));
    expect(screen.getByText(/1 allié IA contre 2 IA/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1v1v1v1" }));
    expect(screen.getByText(/Chacun pour soi contre 3 IA/)).toBeTruthy();
  });

  it("lance chaque jeu dans chaque format, sans aucun canal réseau", () => {
    for (const jeu of [/Arène multi-rounds/, /Course de véhicules/, /Combat 2D/])
      for (const format of ["1v1", "2v2", "1v1v1v1"]) {
        const { unmount } = ouvrirSolo(jeu, format);
        fireEvent.click(screen.getByRole("button", { name: /Lancer la partie/ }));
        expect(screen.getByLabelText(/^Partie : /)).toBeTruthy();
        avancer(5);
        unmount();
      }
    expect(canal).not.toHaveBeenCalled();
    expect(hub.canaux).toHaveLength(0);
  });

  it("une partie complète va jusqu'au résultat, puis propose Rejouer / Changer de jeu / Retour", () => {
    ouvrirSolo(/Combat 2D/, "1v1");
    fireEvent.click(screen.getByRole("button", { name: /Lancer la partie/ }));
    avancer(130);
    expect(screen.getByText(/Victoire de|Égalité/)).toBeTruthy();
    expect(screen.getAllByText(/IA Rex/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\(toi\)/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Rejouer/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Changer de jeu/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Retour à la salle Vénus/ })).toBeTruthy();
    // La boucle d'animation s'est arrêtée toute seule à la fin de la partie.
    expect(vi.getTimerCount()).toBe(0);
    expect(canal).not.toHaveBeenCalled();
  });

  it("Rejouer relance une nouvelle partie, Changer de jeu revient au choix", () => {
    ouvrirSolo(/Arène multi-rounds/, "1v1");
    fireEvent.click(screen.getByRole("button", { name: /Lancer la partie/ }));
    avancer(130);
    fireEvent.click(screen.getByRole("button", { name: /Rejouer/ }));
    expect(screen.queryByText(/Victoire de|Égalité/)).toBeNull();
    expect(screen.getByLabelText("Partie : Arène multi-rounds")).toBeTruthy();
    avancer(130);
    fireEvent.click(screen.getByRole("button", { name: /Changer de jeu/ }));
    expect(screen.getByRole("button", { name: /Lancer la partie/ })).toBeTruthy();
  });

  it("quitter une partie en cours revient au choix", () => {
    ouvrirSolo(/Course de véhicules/, "1v1");
    fireEvent.click(screen.getByRole("button", { name: /Lancer la partie/ }));
    avancer(3);
    fireEvent.click(screen.getByRole("button", { name: /Quitter la partie/ }));
    expect(screen.getByRole("button", { name: /Lancer la partie/ })).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("le clavier pilote le joueur sans erreur, et tout est nettoyé en fermant la borne", () => {
    const ajout = vi.spyOn(window, "addEventListener");
    const retrait = vi.spyOn(window, "removeEventListener");

    const { unmount } = ouvrirSolo(/Arène multi-rounds/, "2v2");
    fireEvent.click(screen.getByRole("button", { name: /Lancer la partie/ }));
    avancer(4);
    fireEvent.keyDown(window, { code: "KeyD", key: "d" });
    fireEvent.keyDown(window, { code: "Space", key: " " });
    avancer(2);
    fireEvent.keyUp(window, { code: "KeyD", key: "d" });
    unmount();

    // Boucle d'animation arrêtée, aucun minuteur en attente, écouteurs clavier retirés.
    expect(vi.getTimerCount()).toBe(0);
    const ajouts = ajout.mock.calls.map((c) => c[0]);
    const retraits = retrait.mock.calls.map((c) => c[0]);
    for (const t of ["keydown", "keyup", "blur"]) {
      expect(ajouts.filter((x) => x === t).length).toBeGreaterThan(0);
      expect(retraits.filter((x) => x === t).length).toBeGreaterThanOrEqual(
        ajouts.filter((x) => x === t).length,
      );
    }
    expect(canal).not.toHaveBeenCalled();
  });

  it("dans le mode histoire, seul le solo est proposé (aucune room, aucun réseau)", () => {
    render(<Arcade moi={moi} onFermer={() => {}} reseauAutorise={false} />);
    expect(screen.queryByText("Créer une room")).toBeNull();
    expect(screen.queryByText("Rejoindre une room")).toBeNull();
    expect(screen.getByText(/disponibles depuis le mode multijoueur/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Jouer en solo/));
    fireEvent.click(screen.getByRole("button", { name: /Lancer la partie/ }));
    avancer(5);
    expect(screen.getByLabelText(/^Partie : /)).toBeTruthy();
    expect(canal).not.toHaveBeenCalled();
  });
});
