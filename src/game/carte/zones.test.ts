import { describe, expect, it } from "vitest";
import { ZONES } from "./zones";
import { atteignable, estBloque, estMur, VEC } from "./moteur";
import type { Arrivee, Zone } from "./types";

const tout = Object.values(ZONES);

/** Toutes les arrivées possibles dans une zone : départ, portes, sorties des autres zones. */
const arriveesVers = (z: Zone): Arrivee[] => {
  const a: Arrivee[] = [z.depart];
  for (const o of tout.flatMap((q) => q.objets))
    if (o.agir?.k === "porte" && o.agir.vers === z.id) a.push(o.agir.arrivee);
  for (const s of tout.flatMap((q) => q.sorties)) if (s.vers === z.id) a.push(s.arrivee);
  return a;
};

describe("carte de l'école", () => {
  it("contient les 4 zones et les 18 salles du plan", () => {
    expect(tout).toHaveLength(22);
    for (const nom of [
      "Serveurs",
      "Labo",
      "Salle Jupiter",
      "Salle Saturne",
      "Salle Mars",
      "Direction",
      "Commerce",
      "Café",
      "Salle Soleil",
      "WC",
      "Pédagogie",
    ]) {
      expect(tout.map((z) => z.nom)).toContain(nom);
    }
  });

  for (const z of tout) {
    describe(z.nom, () => {
      it("a un nombre raisonnable d'objets (ni vide ni surchargé)", () => {
        expect(z.objets.length).toBeGreaterThanOrEqual(8);
        expect(z.objets.length).toBeLessThanOrEqual(36);
      });
      it("tous les points d'arrivée sont libres et ne sont pas des sorties", () => {
        for (const a of arriveesVers(z)) {
          expect(estBloque(z, a.x, a.y, z.pnjs), `arrivée ${a.x},${a.y}`).toBe(false);
          expect(
            z.sorties.some((s) => a.x >= s.x && a.x < s.x + s.w && a.y >= s.y && a.y < s.y + s.h),
            `sortie ${a.x},${a.y}`,
          ).toBe(false);
        }
      });
      it("tout objet et personnage est dans la salle", () => {
        for (const o of z.objets) {
          expect(
            o.x >= 0 && o.y >= 0 && o.x + o.w <= z.l && o.y + o.h <= z.h,
            `${o.kind} ${o.x},${o.y}`,
          ).toBe(true);
        }
        for (const p of z.pnjs) expect(estBloque(z, p.x, p.y), `pnj ${p.id}`).toBe(false);
      });
      it("on peut atteindre toutes les portes, ordinateurs et personnages", () => {
        for (const a of arriveesVers(z)) {
          for (const c of [
            ...z.objets.filter((o) => o.agir),
            ...z.pnjs.map((p) => ({ ...p, w: 1, h: 1, agir: true })),
          ]) {
            const voisines = [];
            for (let i = 0; i < c.w; i++)
              for (let j = 0; j < c.h; j++)
                for (const v of Object.values(VEC))
                  voisines.push({ x: c.x + i + v.x, y: c.y + j + v.y });
            const ok = voisines.some(
              (v) => !estBloque(z, v.x, v.y, z.pnjs) && atteignable(z, a, v, z.pnjs),
            );
            expect(ok, `${"kind" in c ? c.kind : c.id} en ${c.x},${c.y} depuis ${a.x},${a.y}`).toBe(
              true,
            );
          }
        }
      });
      it("les portes mènent quelque part et se referment dans les deux sens", () => {
        for (const o of z.objets) {
          if (o.agir?.k !== "porte") continue;
          const cible = ZONES[o.agir.vers];
          expect(cible, `zone ${o.agir.vers}`).toBeDefined();
          // la salle d'arrivée a une porte de retour vers cette zone
          expect(
            cible.objets.some((q) => q.agir?.k === "porte" && q.agir.vers === z.id) ||
              cible.sorties.some((s) => s.vers === z.id),
          ).toBe(true);
        }
        for (const s of z.sorties) {
          expect(ZONES[s.vers]).toBeDefined();
          expect(ZONES[s.vers].sorties.some((q) => q.vers === z.id)).toBe(true);
        }
      });
      it("les ouvertures et sorties sont bien sur le bord", () => {
        for (const s of z.sorties) expect(estMur(z, s.x, s.y)).toBe(false);
      });
    });
  }
});
