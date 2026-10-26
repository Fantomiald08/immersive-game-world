import { lireReglages } from "./reglages";

/** Petits effets sonores synthétisés (aucun fichier audio). Respecte le volume et le mode muet des réglages. */
export type Son = "ok" | "porte" | "xp" | "niveau" | "coup" | "rate" | "pas";
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const NOTES: Record<Son, Array<[number, number, OscillatorType?]>> = {
  ok: [
    [660, 0.06],
    [880, 0.08],
  ],
  porte: [
    [220, 0.08, "square"],
    [330, 0.1, "square"],
  ],
  xp: [
    [784, 0.07],
    [988, 0.07],
    [1175, 0.1],
  ],
  niveau: [
    [523, 0.1],
    [659, 0.1],
    [784, 0.1],
    [1047, 0.25],
  ],
  coup: [
    [180, 0.1, "sawtooth"],
    [120, 0.12, "sawtooth"],
  ],
  rate: [
    [300, 0.12, "square"],
    [200, 0.2, "square"],
  ],
  pas: [[90, 0.03, "triangle"]],
};

export function jouer(nom: Son) {
  const r = lireReglages();
  if (r.muet || r.volume <= 0) return;
  const c = ac();
  if (!c) return;
  let t = c.currentTime;
  for (const [f, d, type] of NOTES[nom]) {
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = type ?? "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.15 * r.volume), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + d + 0.02);
    t += d * 0.9;
  }
}
