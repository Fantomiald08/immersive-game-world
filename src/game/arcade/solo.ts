import { BTN, type EtatBase, type JeuId, type JoueurPartie } from "./types";
import { ARENES, type EtatArene } from "./jeux/arene";
import { courbure, VMAX, type EtatCourse } from "./jeux/course";
import type { EtatCombat } from "./jeux/combat";

export const ID_BOT = "arcade-adversaire-local";
export function joueursSolo(moi: { id: string; pseudo: string }): JoueurPartie[] {
  return [
    { ...moi, equipe: 0, couleur: "#4da3ff" },
    { id: ID_BOT, pseudo: "Robot", equipe: 1, couleur: "#ff6b6b" },
  ];
}

/** Local opponent inputs; no presence, database writes, or network messages. */
export function entreeRobot(jeu: JeuId, base: EtatBase): number {
  if (base.phase !== "jeu") return 0;
  if (jeu === "course") {
    const bot = (base as EtatCourse).v.find((v) => v.id === ID_BOT);
    if (!bot || bot.fin >= 0) return 0;
    const compensation = courbure(bot.z) * Math.max(0, bot.v / VMAX) * 1.1 / 1.9;
    const cible = -compensation * 0.15;
    const direction = bot.x > cible + 0.04 ? BTN.gauche : bot.x < cible - 0.04 ? BTN.droite : 0;
    return BTN.haut | direction;
  }
  if (jeu === "combat") {
    const s = base as EtatCombat;
    const bot = s.f.find((f) => f.id === ID_BOT);
    const adversaire = s.f.find((f) => f.id !== ID_BOT && !f.ko);
    if (!bot || !adversaire || bot.ko) return 0;
    const distance = Math.abs(adversaire.x - bot.x);
    const avancer = distance > 60 ? (adversaire.x < bot.x ? BTN.gauche : BTN.droite) : 0;
    const attaque = distance < 85 ? (Math.floor(s.t * 2) % 2 ? BTN.b : BTN.a) : BTN.c;
    return avancer | attaque;
  }
  const s = base as EtatArene;
  const bot = s.p.find((p) => p.id === ID_BOT);
  const adversaire = s.p.find((p) => p.id !== ID_BOT && p.respawn <= 0);
  const arene = ARENES[s.manche];
  if (!bot || !adversaire || !arene || bot.respawn > 0) return 0;
  // Choose a route around obstacles on a small navigation grid.
  const pas = 24;
  const sx = Math.round(bot.x / pas), sy = Math.round(bot.y / pas);
  const tx = Math.round(adversaire.x / pas), ty = Math.round(adversaire.y / pas);
  const queue = [{ x: sx, y: sy, premier: 0 }];
  const vus = new Set([`${sx},${sy}`]);
  const dirs = [{ x: -1, y: 0, bit: BTN.gauche }, { x: 1, y: 0, bit: BTN.droite }, { x: 0, y: -1, bit: BTN.haut }, { x: 0, y: 1, bit: BTN.bas }];
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    if (!n) continue;
    if (Math.abs(n.x - tx) + Math.abs(n.y - ty) <= 1) return n.premier | BTN.a;
    for (const d of dirs) {
      const x = n.x + d.x, y = n.y + d.y, px = x * pas, py = y * pas;
      const key = `${x},${y}`;
      if (vus.has(key) || px < 24 || py < 24 || px > 776 || py > 456 || arene.murs.some((m) => px > m.x - 19 && px < m.x + m.w + 19 && py > m.y - 19 && py < m.y + m.h + 19)) continue;
      vus.add(key);
      queue.push({ x, y, premier: n.premier || d.bit });
    }
  }
  return BTN.a;
}