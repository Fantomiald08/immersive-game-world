import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hub } from "@/test/fauxRealtime";

vi.mock(
  "@/integrations/supabase/client",
  async () => (await import("@/test/fauxRealtime")).moduleSupabase,
);

import { useArcade } from "./reseau";

const joueur = (id: string, pseudo: string) => ({ id, pseudo, niveau: 1 });
const ouvrir = (id: string, pseudo: string) => renderHook(() => useArcade(joueur(id, pseudo)));
const vivants: Array<{ unmount: () => void }> = [];
const client = (id: string, pseudo: string) => {
  const r = ouvrir(id, pseudo);
  vivants.push(r);
  return r;
};

afterEach(() => {
  vivants.splice(0).forEach((r) => r.unmount());
  hub.vider();
});

describe("réseau de l'arcade (faux Supabase)", () => {
  it("une room créée apparaît dans la liste des autres, avec son créateur et son nombre de joueurs", () => {
    const leo = client("leo", "Léo");
    const mia = client("mia", "Mia");
    expect(leo.result.current.etat).toBe("pret");
    act(() => leo.result.current.creer());
    expect(leo.result.current.room?.proprietaire.pseudo).toBe("Léo");
    expect(leo.result.current.proprio).toBe(true);
    expect(mia.result.current.salles).toHaveLength(1);
    expect(mia.result.current.salles[0]).toMatchObject({
      createur: "Léo",
      nb: 1,
      max: 2,
      jeu: "arene",
      mode: "1v1",
      phase: "salle",
    });
  });

  it("rejoindre : les deux voient les joueurs, et seul le propriétaire règle le jeu et lance", () => {
    const leo = client("leo", "Léo");
    const mia = client("mia", "Mia");
    act(() => leo.result.current.creer());
    act(() => mia.result.current.rejoindre("leo"));
    expect(leo.result.current.room?.joueurs.map((j) => j.pseudo)).toEqual(["Léo", "Mia"]);
    expect(mia.result.current.room?.joueurs.map((j) => j.pseudo)).toEqual(["Léo", "Mia"]);
    expect(mia.result.current.proprio).toBe(false);

    // Mia n'a aucun pouvoir sur la room.
    act(() => mia.result.current.choisirJeu("combat"));
    expect(leo.result.current.room?.jeu).toBe("arene");
    expect(mia.result.current.lancer()).toBe(false);
    expect(leo.result.current.room?.phase).toBe("salle");

    // Léo choisit : Mia le voit.
    act(() => leo.result.current.choisirJeu("combat"));
    expect(mia.result.current.room?.jeu).toBe("combat");
    act(() => void leo.result.current.lancer());
    expect(mia.result.current.room?.phase).toBe("jeu");
    expect(mia.result.current.room?.manche).toBe(leo.result.current.room?.manche);
    // La room en cours n'est plus rejoignable.
    const zoe = client("zoe", "Zoé");
    act(() => zoe.result.current.rejoindre("leo"));
    expect(zoe.result.current.room).toBeNull();
    expect(zoe.result.current.message).toMatch(/en cours|pleine/);
  });

  it("le lancement est refusé tant qu'il manque un adversaire", () => {
    const leo = client("leo", "Léo");
    act(() => leo.result.current.creer());
    expect(act(() => leo.result.current.lancer())).not.toBe(true);
    expect(leo.result.current.room?.phase).toBe("salle");
  });

  it("une room 1v1 pleine refuse un troisième joueur", () => {
    const leo = client("leo", "Léo");
    const mia = client("mia", "Mia");
    const zoe = client("zoe", "Zoé");
    act(() => leo.result.current.creer());
    act(() => mia.result.current.rejoindre("leo"));
    act(() => zoe.result.current.rejoindre("leo"));
    expect(zoe.result.current.room).toBeNull();
    expect(zoe.result.current.message).toBe("Cette room est pleine.");
  });

  it("en équipes, la room accueille 4 joueurs réparties en 2 équipes", () => {
    const ids = ["leo", "mia", "zoe", "tom"];
    const cl = ids.map((i) => client(i, i.toUpperCase()));
    act(() => cl[0]!.result.current.creer());
    act(() => void cl[0]!.result.current.choisirMode("equipes"));
    for (const c of cl.slice(1)) act(() => c.result.current.rejoindre("leo"));
    expect(cl[3]!.result.current.room?.joueurs).toHaveLength(4);
    expect(cl[3]!.result.current.room?.mode).toBe("equipes");
    // Impossible de repasser en 1v1 à 4 joueurs.
    let ok = true;
    act(() => {
      ok = cl[0]!.result.current.choisirMode("1v1");
    });
    expect(ok).toBe(false);
    expect(cl[0]!.result.current.room?.mode).toBe("equipes");
    expect(cl[0]!.result.current.message).toMatch(/Trop de joueurs/);
  });

  it("quand le propriétaire part, le plus ancien devient propriétaire et la room reste listée", () => {
    const leo = client("leo", "Léo");
    const mia = client("mia", "Mia");
    const zoe = client("zoe", "Zoé");
    act(() => leo.result.current.creer());
    act(() => void leo.result.current.choisirMode("equipes"));
    act(() => mia.result.current.rejoindre("leo"));
    act(() => zoe.result.current.rejoindre("leo"));
    act(() => leo.result.current.quitter());

    expect(mia.result.current.room?.proprietaire.id).toBe("mia");
    expect(mia.result.current.proprio).toBe(true);
    expect(mia.result.current.message).toMatch(/tu deviens propriétaire/);
    expect(zoe.result.current.room?.proprietaire.pseudo).toBe("Mia");
    expect(zoe.result.current.message).toMatch(/Mia est le nouveau propriétaire/);
    // La nouvelle propriétaire republie la room dans le salon (par défaut : arène, 1v1).
    expect(leo.result.current.salles.map((s) => s.createur)).toEqual(["Mia"]);
    // L'ancien propriétaire est bien sorti.
    expect(leo.result.current.room).toBeNull();
  });

  it("quand le dernier joueur part, la room disparaît de la liste", () => {
    const leo = client("leo", "Léo");
    const mia = client("mia", "Mia");
    act(() => leo.result.current.creer());
    expect(mia.result.current.salles).toHaveLength(1);
    act(() => leo.result.current.quitter());
    expect(mia.result.current.salles).toHaveLength(0);
  });

  it("les touches vont à tous les autres, l'état de la partie aussi", () => {
    const leo = client("leo", "Léo");
    const mia = client("mia", "Mia");
    act(() => leo.result.current.creer());
    act(() => mia.result.current.rejoindre("leo"));
    const touches = vi.fn();
    const etats = vi.fn();
    const arret1 = leo.result.current.abonner({ entree: touches });
    const arret2 = mia.result.current.abonner({ snapshot: etats });
    mia.result.current.envoyerEntree(7, 5);
    leo.result.current.envoyerSnapshot(7, { phase: "jeu" });
    expect(touches).toHaveBeenCalledWith("mia", 5);
    expect(etats).toHaveBeenCalledWith(7, { phase: "jeu" });
    arret1();
    arret2();
    mia.result.current.envoyerEntree(7, 6);
    expect(touches).toHaveBeenCalledTimes(1);
  });

  it("fermer l'arcade nettoie tous les canaux", () => {
    const leo = client("leo", "Léo");
    act(() => leo.result.current.creer());
    expect(hub.canaux.length).toBeGreaterThan(0);
    leo.unmount();
    vivants.splice(0);
    expect(hub.canaux).toHaveLength(0);
  });
});
