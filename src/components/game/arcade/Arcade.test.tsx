import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hub } from "@/test/fauxRealtime";

vi.mock(
  "@/integrations/supabase/client",
  async () => (await import("@/test/fauxRealtime")).moduleSupabase,
);

import { Arcade } from "./Arcade";
import { Manette } from "./Manette";
import { useControles } from "./useControles";
import { BTN } from "@/game/arcade/types";

const joueur = (id: string, pseudo: string) => ({ id, pseudo, niveau: 1 });
const ouvrir = (id: string, pseudo: string) => {
  const r = render(<Arcade moi={joueur(id, pseudo)} onFermer={() => {}} />);
  return { ...r, ecran: within(r.container) };
};

beforeEach(() => {
  // jsdom n'a pas de canvas : les parties s'affichent sans dessin, ce qui suffit pour ces tests.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  hub.vider();
  vi.restoreAllMocks();
});

describe("interface de l'arcade", () => {
  for (const nom of ["Arène multi-rounds", "Course de véhicules", "Combat 2D"]) {
    it(`lance ${nom} en solo sans créer de room`, () => {
      const leo = ouvrir("leo", "Léo");
      fireEvent.click(leo.ecran.getByText(/Jouer en solo/));
      fireEvent.click(leo.ecran.getByRole("button", { name: new RegExp(nom) }));
      fireEvent.click(leo.ecran.getByRole("button", { name: /Lancer la partie/ }));
      expect(leo.ecran.getByLabelText(`Partie : ${nom}`)).toBeTruthy();
      expect(leo.ecran.queryByText(/En attente d'un joueur/)).toBeNull();
      fireEvent.click(leo.ecran.getByRole("button", { name: /Quitter la partie/ }));
      expect(leo.ecran.getByRole("button", { name: new RegExp(nom) })).toBeTruthy();
    });
  }
  it("propose d'abord « Créer une room » et « Rejoindre une room »", () => {
    const { ecran } = ouvrir("leo", "Léo");
    expect(ecran.getByText("Créer une room")).toBeTruthy();
    expect(ecran.getByText("Rejoindre une room")).toBeTruthy();
  });

  it("la liste est vide au début, puis montre créateur, joueurs et mini-jeu", () => {
    const leo = ouvrir("leo", "Léo");
    const mia = ouvrir("mia", "Mia");
    fireEvent.click(mia.ecran.getByText("Rejoindre une room"));
    expect(mia.ecran.getByText(/Aucune room ouverte/)).toBeTruthy();
    fireEvent.click(leo.ecran.getByText("Créer une room"));
    expect(mia.ecran.getByText("Léo")).toBeTruthy();
    expect(mia.ecran.getByText(/Arène multi-rounds · 1v1 · 👥 1\/2/)).toBeTruthy();
    expect(mia.ecran.getByRole("button", { name: "Rejoindre" })).toBeTruthy();
  });

  it("seul le propriétaire règle le jeu et lance ; l'invité attend", () => {
    const leo = ouvrir("leo", "Léo");
    const mia = ouvrir("mia", "Mia");
    fireEvent.click(leo.ecran.getByText("Créer une room"));
    expect(leo.ecran.getByText(/PROPRIÉTAIRE/)).toBeTruthy();
    // Seul dans la room : le lancement est impossible et on explique pourquoi.
    expect(
      (leo.ecran.getByRole("button", { name: /Lancer la partie/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(leo.ecran.getByText(/Il faut un adversaire/)).toBeTruthy();

    fireEvent.click(mia.ecran.getByText("Rejoindre une room"));
    fireEvent.click(mia.ecran.getByRole("button", { name: "Rejoindre" }));

    // Côté invité : boutons de jeu et de mode désactivés, pas de bouton Lancer.
    for (const nom of [/Arène multi-rounds/, /Course de véhicules/, /Combat 2D/])
      expect((mia.ecran.getByRole("button", { name: nom }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    expect(
      (mia.ecran.getByRole("button", { name: "Équipes 2v2" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(mia.ecran.queryByRole("button", { name: /Lancer la partie/ })).toBeNull();
    expect(mia.ecran.getAllByText(/En attente du propriétaire/).length).toBeGreaterThan(0);

    // Côté propriétaire : deux joueurs, tout est actif.
    expect(leo.ecran.getAllByText(/JOUEUR [12]/)).toHaveLength(2);
    const lancer = leo.ecran.getByRole("button", { name: /Lancer la partie/ }) as HTMLButtonElement;
    expect(lancer.disabled).toBe(false);

    fireEvent.click(leo.ecran.getByRole("button", { name: /Combat 2D/ }));
    expect(mia.ecran.getByRole("button", { name: /Combat 2D/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("le lancement ouvre la partie chez les deux joueurs", () => {
    const leo = ouvrir("leo", "Léo");
    const mia = ouvrir("mia", "Mia");
    fireEvent.click(leo.ecran.getByText("Créer une room"));
    fireEvent.click(leo.ecran.getByRole("button", { name: /Course de véhicules/ }));
    fireEvent.click(mia.ecran.getByText("Rejoindre une room"));
    fireEvent.click(mia.ecran.getByRole("button", { name: "Rejoindre" }));
    fireEvent.click(leo.ecran.getByRole("button", { name: /Lancer la partie/ }));
    expect(leo.ecran.getByLabelText("Partie : Course de véhicules")).toBeTruthy();
    expect(mia.ecran.getByLabelText("Partie : Course de véhicules")).toBeTruthy();
    // Boutons à l'écran présents pour la course
    expect(mia.ecran.getByRole("button", { name: "Turbo" })).toBeTruthy();
    expect(mia.ecran.getByRole("button", { name: "Gaz" })).toBeTruthy();
  });

  it("quand le propriétaire quitte, l'invité devient propriétaire et peut régler la room", () => {
    const leo = ouvrir("leo", "Léo");
    const mia = ouvrir("mia", "Mia");
    fireEvent.click(leo.ecran.getByText("Créer une room"));
    fireEvent.click(mia.ecran.getByText("Rejoindre une room"));
    fireEvent.click(mia.ecran.getByRole("button", { name: "Rejoindre" }));
    fireEvent.click(leo.ecran.getByRole("button", { name: /Quitter la room/ }));
    expect(mia.ecran.getByText(/PROPRIÉTAIRE/)).toBeTruthy();
    expect(mia.ecran.getByText(/tu deviens propriétaire/)).toBeTruthy();
    expect(
      (mia.ecran.getByRole("button", { name: /Combat 2D/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
    // Léo est revenu à l'accueil de l'arcade.
    expect(leo.ecran.getByText("Créer une room")).toBeTruthy();
  });

  it("fermer la borne libère le réseau", () => {
    const leo = ouvrir("leo", "Léo");
    fireEvent.click(leo.ecran.getByText("Créer une room"));
    expect(hub.canaux.length).toBeGreaterThan(0);
    leo.unmount();
    expect(hub.canaux).toHaveLength(0);
  });
});

describe("contrôles hybrides", () => {
  function Banc({ surChangement }: { surChangement: (b: number) => void }) {
    const { appuyer } = useControles(true, surChangement);
    return <Manette boutons={{ a: "Tirer", b: "Esquive" }} appuyer={appuyer} />;
  }

  it("clavier : ZQSD / flèches et touches d'action", () => {
    const cb = vi.fn();
    render(<Banc surChangement={cb} />);
    fireEvent.keyDown(window, { code: "KeyW", key: "z" });
    expect(cb).toHaveBeenLastCalledWith(BTN.haut);
    fireEvent.keyDown(window, { code: "ArrowRight", key: "ArrowRight" });
    expect(cb).toHaveBeenLastCalledWith(BTN.haut | BTN.droite);
    fireEvent.keyDown(window, { code: "Space", key: " " });
    expect(cb).toHaveBeenLastCalledWith(BTN.haut | BTN.droite | BTN.a);
    fireEvent.keyUp(window, { code: "KeyW", key: "z" });
    fireEvent.keyUp(window, { code: "ArrowRight", key: "ArrowRight" });
    fireEvent.keyUp(window, { code: "Space", key: " " });
    expect(cb).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(window, { code: "KeyK", key: "k" });
    expect(cb).toHaveBeenLastCalledWith(BTN.b);
  });

  it("boutons à l'écran : appui, relâchement, et cumul avec le clavier", () => {
    const cb = vi.fn();
    render(<Banc surChangement={cb} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Tirer" }));
    expect(cb).toHaveBeenLastCalledWith(BTN.a);
    fireEvent.keyDown(window, { code: "ArrowLeft", key: "ArrowLeft" });
    expect(cb).toHaveBeenLastCalledWith(BTN.a | BTN.gauche);
    fireEvent.pointerUp(screen.getByRole("button", { name: "Tirer" }));
    expect(cb).toHaveBeenLastCalledWith(BTN.gauche);
    fireEvent.pointerDown(screen.getByRole("button", { name: "◀" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "▲" }));
    expect(cb).toHaveBeenLastCalledWith(BTN.gauche | BTN.haut);
  });

  it("perdre le focus ou fermer la manette relâche toutes les touches", () => {
    const cb = vi.fn();
    const { unmount } = render(<Banc surChangement={cb} />);
    fireEvent.keyDown(window, { code: "KeyD", key: "d" });
    expect(cb).toHaveBeenLastCalledWith(BTN.droite);
    act(() => void window.dispatchEvent(new Event("blur")));
    expect(cb).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(window, { code: "KeyD", key: "d" });
    unmount();
    expect(cb).toHaveBeenLastCalledWith(0);
  });

  it("ne vole pas les touches pendant la saisie dans un champ de texte", () => {
    const cb = vi.fn();
    render(
      <>
        <input aria-label="chat" />
        <Banc surChangement={cb} />
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText("chat"), { code: "Space", key: " " });
    expect(cb).not.toHaveBeenCalled();
  });
});
