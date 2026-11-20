import { beforeEach, describe, expect, it } from "vitest";
import { departSolo, ecrireSolo, effacerSolo, lireSolo, valider } from "./solo";
import { ZONE_DEPART, ZONES } from "./carte/zones";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as Storage;
});

const d = ZONES[ZONE_DEPART].depart;

describe("sauvegarde du mode solo", () => {
  it("repart de l'entrée de l'école quand il n'y a rien de sauvegardé", () => {
    const s = departSolo("u1");
    expect(s.zone).toBe(ZONE_DEPART);
    expect(s.arrivee).toEqual(d);
    expect(s.xpSolo).toBe(0);
  });

  it("garde zone, position, direction et XP, séparément pour chaque joueur", () => {
    ecrireSolo("u1", { zone: ZONE_DEPART, x: d.x, y: d.y, dir: "haut", xpSolo: 40 });
    expect(lireSolo("u1")).toMatchObject({
      zone: ZONE_DEPART,
      x: d.x,
      y: d.y,
      dir: "haut",
      xpSolo: 40,
    });
    expect(lireSolo("u2")).toBeNull();
  });

  it("arrondit une position en plein déplacement", () => {
    const s = valider({ zone: ZONE_DEPART, x: d.x + 0.2, y: d.y - 0.3, dir: "bas", xpSolo: 0 });
    expect(s?.x).toBe(d.x);
    expect(s?.y).toBe(d.y);
  });

  it("refuse une zone inconnue ou des données abîmées", () => {
    expect(valider({ zone: "inconnue", x: 1, y: 1 })).toBeNull();
    expect(valider({ zone: ZONE_DEPART, x: "a", y: 1 })).toBeNull();
    expect(valider(null)).toBeNull();
    expect(valider("texte")).toBeNull();
  });

  it("revient au point d'arrivée si la case sauvegardée est bloquée", () => {
    const s = valider({ zone: ZONE_DEPART, x: -5, y: -5, dir: "gauche", xpSolo: 3 });
    expect(s?.x).toBe(d.x);
    expect(s?.y).toBe(d.y);
    expect(s?.xpSolo).toBe(3);
  });

  it("corrige une direction invalide et une XP négative", () => {
    const s = valider({ zone: ZONE_DEPART, x: d.x, y: d.y, dir: "diagonale", xpSolo: -10 });
    expect(s?.dir).toBe("bas");
    expect(s?.xpSolo).toBe(0);
  });

  it("ignore un JSON illisible et peut effacer la sauvegarde", () => {
    store.set("isitech.solo.v1.u1", "{pas du json");
    expect(lireSolo("u1")).toBeNull();
    ecrireSolo("u1", { zone: ZONE_DEPART, x: d.x, y: d.y, dir: "bas", xpSolo: 1 });
    effacerSolo("u1");
    expect(lireSolo("u1")).toBeNull();
  });
});
