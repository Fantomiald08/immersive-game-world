import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Arcade } from "./Arcade";

describe("incomplete arcade isolation", () => {
  it("lets a player return to the school without loading missing arcade modules", () => {
    const onFermer = vi.fn();
    render(<Arcade moi={{ id: "test", pseudo: "Élève", niveau: 1 }} onFermer={onFermer} />);
    fireEvent.click(screen.getByRole("button", { name: /Retour/ }));
    expect(onFermer).toHaveBeenCalledTimes(1);
  });
});
