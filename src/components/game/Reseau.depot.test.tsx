import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generer: vi.fn(), extraire: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.generer, createServerFn: () => ({ middleware: () => ({ inputValidator: () => ({ handler: () => mocks.generer }) }) }) }));
vi.mock("@/game/fichiers", () => ({ extraireTexte: mocks.extraire, versDataUrl: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { FormDepot } from "./Reseau";

const texte = "Le protocole DHCP attribue automatiquement une adresse IP. Le serveur DNS résout les noms de domaine. HTTPS chiffre les échanges sur le port 443.";
const id = "00000000-0000-4000-8000-000000000001";
function ouvrir() {
  const deposer = vi.fn().mockResolvedValue(id), terminer = vi.fn().mockResolvedValue(undefined);
  render(<FormDepot categories={[{ cle: "Reseaux", nom: "Réseaux" }]} defaut="Reseaux" onAnnuler={() => {}} onFait={deposer} onTermine={terminer} />);
  fireEvent.change(screen.getByPlaceholderText("Ex : Configurer un serveur DHCP"), { target: { value: "DHCP" } });
  return { deposer, terminer };
}
beforeEach(() => { vi.clearAllMocks(); mocks.generer.mockResolvedValue({ quizId: "quiz" }); });
describe("dépôt automatique", () => {
  it("génère 8 questions dès qu'un cours texte est enregistré", async () => {
    const { deposer, terminer } = ouvrir();
    fireEvent.change(screen.getByRole("textbox", { name: /Texte du cours/ }), { target: { value: texte } });
    fireEvent.click(screen.getByRole("button", { name: /Déposer et générer/ }));
    await waitFor(() => expect(terminer).toHaveBeenCalledTimes(1));
    expect(deposer).toHaveBeenCalledTimes(1);
    expect(mocks.generer).toHaveBeenCalledWith({ data: { coursId: id, nombre: 8 } });
  });
  it("extrait le fichier importé avant de créer le cours et son quiz", async () => {
    mocks.extraire.mockResolvedValue({ texte });
    const { deposer, terminer } = ouvrir();
    const fichier = new File([texte], "dhcp.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText(/Fichier \(/), { target: { files: [fichier] } });
    fireEvent.click(screen.getByRole("button", { name: /Déposer et générer/ }));
    await waitFor(() => expect(terminer).toHaveBeenCalledTimes(1));
    expect(deposer.mock.calls[0]?.[0].contenu).toBe(texte);
    expect(mocks.generer).toHaveBeenCalledWith({ data: { coursId: id, nombre: 8 } });
  });
  it("réessaie seulement le quiz, sans dupliquer le cours après un échec IA", async () => {
    mocks.generer.mockRejectedValueOnce(new Error("IA indisponible"));
    const { deposer, terminer } = ouvrir();
    fireEvent.change(screen.getByRole("textbox", { name: /Texte du cours/ }), { target: { value: texte } });
    fireEvent.click(screen.getByRole("button", { name: /Déposer et générer/ }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer le quiz IA" }));
    await waitFor(() => expect(terminer).toHaveBeenCalledTimes(1));
    expect(deposer).toHaveBeenCalledTimes(1);
    expect(mocks.generer).toHaveBeenCalledTimes(2);
  });
});