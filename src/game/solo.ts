import { estBloque } from "./carte/moteur";
import { ZONE_DEPART, ZONES } from "./carte/zones";
import type { Arrivee, ZoneId } from "./carte/types";

/**
 * Sauvegarde du MODE SOLO (histoire / événement), sur l'appareil et par joueur.
 * Le multijoueur n'utilise rien de tout ça : il n'a pas de sauvegarde locale.
 * L'avancement de l'histoire a sa propre clé (histoire.ts) ; ici on garde la position,
 * la zone et l'XP gagnée en solo.
 */
export type SauvegardeSolo = {
  v: 1;
  zone: ZoneId;
  x: number;
  y: number;
  dir: Arrivee["dir"];
  /** XP gagnée pendant les parties solo (cumul). */
  xpSolo: number;
  /** Date de la dernière sauvegarde (ms). */
  date: number;
};

const DIRS: Arrivee["dir"][] = ["haut", "bas", "gauche", "droite"];
export const cleSolo = (uid: string) => `isitech.solo.v1.${uid}`;

/** Vérifie une donnée lue sur l'appareil : zone connue, case libre, valeurs saines. Sinon : null. */
export function valider(brut: unknown): SauvegardeSolo | null {
  if (!brut || typeof brut !== "object") return null;
  const b = brut as Partial<Record<"zone" | "x" | "y" | "dir" | "xpSolo" | "date", unknown>>;
  const zone = b.zone as ZoneId;
  if (typeof b.zone !== "string" || !(zone in ZONES)) return null;
  const x = Number(b.x),
    y = Number(b.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const dir = DIRS.includes(b.dir as Arrivee["dir"]) ? (b.dir as Arrivee["dir"]) : "bas";
  const xpSolo = Math.max(0, Math.floor(Number(b.xpSolo) || 0));
  const date = Number.isFinite(Number(b.date)) ? Number(b.date) : 0;
  const z = ZONES[zone];
  const cx = Math.round(x),
    cy = Math.round(y);
  // Position bloquée (carte modifiée depuis) : on repart du point d'arrivée de la zone.
  const ok = !estBloque(z, cx, cy);
  const p = ok ? { x: cx, y: cy, dir } : z.depart;
  return { v: 1, zone, x: p.x, y: p.y, dir: p.dir, xpSolo, date };
}

export function lireSolo(uid: string): SauvegardeSolo | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const b = localStorage.getItem(cleSolo(uid));
    return b ? valider(JSON.parse(b)) : null;
  } catch {
    return null;
  }
}

export function ecrireSolo(uid: string, s: Omit<SauvegardeSolo, "v" | "date">): void {
  try {
    if (typeof localStorage === "undefined") return;
    const propre = valider({ ...s, date: Date.now() });
    if (propre) localStorage.setItem(cleSolo(uid), JSON.stringify(propre));
  } catch {
    /* stockage indisponible : la partie ne sera simplement pas gardée */
  }
}

export function effacerSolo(uid: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(cleSolo(uid));
  } catch {
    /* rien à faire */
  }
}

/** Point de départ d'une partie solo : la dernière sauvegarde, ou l'entrée de l'école. */
export function departSolo(uid: string): { zone: ZoneId; arrivee: Arrivee; xpSolo: number } {
  const s = lireSolo(uid);
  if (!s) return { zone: ZONE_DEPART, arrivee: ZONES[ZONE_DEPART].depart, xpSolo: 0 };
  return { zone: s.zone, arrivee: { x: s.x, y: s.y, dir: s.dir }, xpSolo: s.xpSolo };
}
