import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PauseMenu } from "./PauseMenu";

const base = {
  onOuvrir: () => {},
  onProfil: () => {},
  onReglages: () => {},
  onMenu: () => {},
  onDeco: () => {},
  xpSolo: 0,
};

describe("menu pause", () => {
  it("n'affiche rien tant qu'il est fermé", () => {
    render(<PauseMenu {...base} ouvert={false} solo={false} />);
    expect(screen.queryByText(/Retour au menu/)).toBeNull();
  });

  it("propose le retour au menu et l'indique en solo", () => {
    const onMenu = vi.fn();
    render(<PauseMenu {...base} ouvert solo xpSolo={30} onMenu={onMenu} />);
    expect(screen.getByText(/ta progression est sauvegardée/)).toBeTruthy();
    expect(screen.getByText(/\+30 XP/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Retour au menu/));
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it("indique en multijoueur que le jeu continue pour les autres", () => {
    render(<PauseMenu {...base} ouvert solo={false} />);
    expect(screen.getByText(/continue pour les autres/)).toBeTruthy();
  });

  it("se ferme avec Reprendre", () => {
    const onOuvrir = vi.fn();
    render(<PauseMenu {...base} ouvert solo={false} onOuvrir={onOuvrir} />);
    fireEvent.click(screen.getByText(/Reprendre/));
    expect(onOuvrir).toHaveBeenCalledWith(false);
  });
});
