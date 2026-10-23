export type Course = { id: string; title: string; type: string; text: string; created: number };
export type Question = { q: string; options: string[]; answer: number };
export type Profile = { xp: number; stats: { [k: string]: number } & Partial<Record<"dep"|"fight"|"win"|"good"|"perfect", number>>; badges: string[]; streak: number; last: string };

const KEY = "isitech-save-v1";
export type Save = { courses: Course[]; profile: Profile };
const empty: Save = { courses: [], profile: { xp: 0, stats: {}, badges: [], streak: 0, last: "" } };

export function load(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "");
    return { ...empty, ...s, profile: { ...empty.profile, ...s.profile } };
  } catch {
    return structuredClone(empty);
  }
}
export function persist(s: Save) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export const level = (xp: number) => Math.floor(Math.sqrt(xp / 50)) + 1;
export const levelBounds = (l: number) => [50 * (l - 1) ** 2, 50 * l * l];
const TITLES = ["Recrue", "Technicien", "Admin réseau", "Ingénieur", "Architecte", "Légende SISR"];
export const title = (l: number) => TITLES[Math.min(5, Math.floor((l - 1) / 2))];
export const avatar = (l: number) => ["🧑‍💻", "🦊", "🐙", "🤖", "🐉", "👑"][Math.min(5, Math.floor((l - 1) / 2))];

export const BADGES: Record<string, [string, string]> = {
  first: ["🚀", "Premier dépôt"],
  hoard: ["📦", "10 dépôts"],
  slayer: ["⚔️", "1er boss vaincu"],
  perfect: ["💯", "Sans dégât"],
  gamer: ["🎮", "10 combats"],
  streak3: ["🔥", "Série de 3 jours"],
  lvl5: ["👑", "Niveau 5"],
};

export function checkBadges(p: Profile): string[] {
  const s = p.stats, got: string[] = [];
  const add = (b: string, ok: boolean) => ok && !p.badges.includes(b) && (p.badges.push(b), got.push(b));
  add("first", (s["dep"] || 0) >= 1);
  add("hoard", (s["dep"] || 0) >= 10);
  add("slayer", (s["win"] || 0) >= 1);
  add("perfect", (s["perfect"] || 0) >= 1);
  add("gamer", (s["fight"] || 0) >= 10);
  add("streak3", p.streak >= 3);
  add("lvl5", level(p.xp) >= 5);
  return got;
}

/** Local quiz generator: blanks a key word in sentences from the course text. */
export function makeQuiz(text: string, n: number): Question[] {
  const sentences = text.split(/(?<=[.!?\n])\s+/).map((s) => s.trim()).filter((s) => s.length > 25);
  const words = [...new Set(text.match(/[A-Za-zÀ-ÿ0-9-]{6,}/g) || [])];
  if (words.length < 4) return [];
  const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const out: Question[] = [];
  for (const s of shuffle(sentences)) {
    const cands = (s.match(/[A-Za-zÀ-ÿ0-9-]{6,}/g) || []);
    if (!cands.length) continue;
    const w = cands.sort((a, b) => b.length - a.length)[0]!;
    const wrong = shuffle(words.filter((x) => x.toLowerCase() !== w.toLowerCase())).slice(0, 3);
    if (wrong.length < 3) continue;
    const options = shuffle([w, ...wrong]);
    out.push({ q: s.replace(w, "_____"), options, answer: options.indexOf(w) });
    if (out.length >= n) break;
  }
  return out;
}
