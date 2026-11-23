import type { EvenementFx } from "./types";

/**
 * Effets visuels : particules (nombre borné), popups, tremblement d'écran, barres de vie à traînée.
 * Ils vivent du côté affichage, jamais dans la simulation ni dans le réseau : chaque joueur les
 * produit lui-même à partir des événements de l'état (voir EvenementFx).
 */
export type Particule = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vie: number;
  vieMax: number;
  taille: number;
  couleur: string;
  /** Gravité (px/s²). */
  grav: number;
  /** Frottement (0 = aucun). */
  frein: number;
  /** Les particules « lumineuses » s'additionnent (feu, étincelles). */
  lueur: boolean;
};
export type Popup = {
  x: number;
  y: number;
  txt: string;
  couleur: string;
  vie: number;
  vieMax: number;
  taille: number;
};

export const MAX_PARTICULES = 240;
const MAX_POPUPS = 10;
const MAX_ONDES = 8;
export type Onde = {
  x: number;
  y: number;
  rayon: number;
  vie: number;
  vieMax: number;
  couleur: string;
};

export class Effets {
  particules: Particule[] = [];
  popups: Popup[] = [];
  ondes: Onde[] = [];
  /** Horloge d'affichage (s) : sert aux animations (foule, néons, marche). */
  horloge = 0;
  /** Durée de la dernière image (s). */
  dt = 0;
  /** Intensité du tremblement d'écran (px). */
  secousse = 0;
  /** Excitation de la foule (0 à 1). */
  excitation = 0;
  /** Flash blanc plein écran (0 à 1). */
  flash = 0;
  /** Léger balancement de la caméra (course), lissé d'une image à l'autre. */
  cam = { x: 0, y: 0 };
  /** Durée moyenne d'une image (s), pour réduire les détails si l'appareil est lent. */
  moyenne = 1 / 60;
  private vu = 0;
  private suivis = new Map<string, number>();

  /** Vrai si l'appareil n'arrive pas à tenir environ 40 images par seconde : le décor se simplifie alors. */
  get lent(): boolean {
    return this.moyenne > 0.026;
  }

  /** À appeler une fois par image. */
  maj(dt: number): void {
    this.dt = dt;
    this.moyenne = this.moyenne * 0.97 + dt * 0.03;
    this.horloge += dt;
    this.secousse = Math.max(0, this.secousse - dt * 28);
    this.excitation = Math.max(0, this.excitation - dt * 0.5);
    this.flash = Math.max(0, this.flash - dt * 5);
    for (let i = this.particules.length - 1; i >= 0; i--) {
      const p = this.particules[i]!;
      p.vie -= dt;
      if (p.vie <= 0) {
        this.particules.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      if (p.frein > 0) {
        const f = Math.max(0, 1 - p.frein * dt);
        p.vx *= f;
        p.vy *= f;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.ondes.length - 1; i >= 0; i--) {
      this.ondes[i]!.vie -= dt;
      if (this.ondes[i]!.vie <= 0) this.ondes.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i]!;
      p.vie -= dt;
      p.y -= 26 * dt;
      if (p.vie <= 0) this.popups.splice(i, 1);
    }
  }

  /** Les événements pas encore traités (et ils sont marqués comme vus). */
  nouveaux(evs: readonly EvenementFx[]): EvenementFx[] {
    const r = evs.filter((e) => e.n > this.vu);
    if (r.length) this.vu = Math.max(this.vu, ...r.map((e) => e.n));
    return r;
  }

  particule(p: Partial<Particule> & { x: number; y: number }): void {
    if (this.particules.length >= MAX_PARTICULES) this.particules.shift();
    const vie = p.vie ?? 0.5;
    this.particules.push({
      vx: 0,
      vy: 0,
      taille: 3,
      couleur: "#fff",
      grav: 0,
      frein: 0,
      lueur: false,
      ...p,
      vie,
      vieMax: vie,
    });
  }

  /** Gerbe de particules qui partent dans toutes les directions (ou dans un cône). */
  gerbe(
    x: number,
    y: number,
    n: number,
    o: {
      couleur: string | string[];
      vitesse?: number;
      vie?: number;
      taille?: number;
      grav?: number;
      frein?: number;
      lueur?: boolean;
      angle?: number;
      ouverture?: number;
    },
  ): void {
    const cs = Array.isArray(o.couleur) ? o.couleur : [o.couleur];
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? 0) + (Math.random() - 0.5) * (o.ouverture ?? Math.PI * 2);
      const v = (o.vitesse ?? 120) * (0.35 + Math.random() * 0.65);
      this.particule({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        vie: (o.vie ?? 0.5) * (0.6 + Math.random() * 0.6),
        taille: (o.taille ?? 3) * (0.7 + Math.random() * 0.6),
        couleur: cs[i % cs.length]!,
        grav: o.grav ?? 0,
        frein: o.frein ?? 0,
        lueur: o.lueur ?? false,
      });
    }
  }

  popup(x: number, y: number, txt: string, couleur = "#ffd166", taille = 16): void {
    if (this.popups.length >= MAX_POPUPS) this.popups.shift();
    this.popups.push({ x, y, txt, couleur, vie: 1.1, vieMax: 1.1, taille });
  }

  /** Onde de choc circulaire (explosion, atterrissage, KO). */
  onde(x: number, y: number, rayon: number, couleur = "#fff", vie = 0.35): void {
    if (this.ondes.length >= MAX_ONDES) this.ondes.shift();
    this.ondes.push({ x, y, rayon, vie, vieMax: vie, couleur });
  }

  secouer(force: number): void {
    this.secousse = Math.min(14, Math.max(this.secousse, force));
  }

  /** Barre de vie « à traînée » : renvoie la valeur qui rattrape lentement la vraie. */
  suivi(id: string, valeur: number): number {
    const a = this.suivis.get(id);
    const v = a === undefined || valeur > a ? valeur : Math.max(valeur, a - 45 * this.dt);
    this.suivis.set(id, v);
    return v;
  }

  /** Début de la scène : applique le tremblement d'écran. */
  debut(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (this.secousse > 0.3)
      ctx.translate(
        Math.round((Math.random() - 0.5) * 2 * this.secousse),
        Math.round((Math.random() - 0.5) * 2 * this.secousse),
      );
  }
  fin(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }

  dessinerParticules(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particules) {
      const k = p.vie / p.vieMax;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = p.couleur;
      const t = Math.max(1, Math.round(p.taille * (p.lueur ? 0.6 + k * 0.6 : 0.5 + k * 0.5)));
      ctx.fillRect(Math.round(p.x - t / 2), Math.round(p.y - t / 2), t, t);
    }
    ctx.globalAlpha = 1;
  }

  dessinerOndes(ctx: CanvasRenderingContext2D): void {
    for (const o of this.ondes) {
      const k = 1 - o.vie / o.vieMax;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = o.couleur;
      ctx.lineWidth = Math.max(1, Math.round(5 * (1 - k)));
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.rayon * (0.2 + k * 0.8), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  dessinerPopups(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const p of this.popups) {
      const k = p.vie / p.vieMax;
      ctx.globalAlpha = Math.min(1, k * 2);
      const grand = p.taille * (1 + Math.max(0, k - 0.8) * 2);
      ctx.font = `bold ${Math.round(grand)}px monospace`;
      ctx.fillStyle = "#2a1810";
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const)
        ctx.fillText(p.txt, Math.round(p.x + dx * 2), Math.round(p.y + dy * 2));
      ctx.fillStyle = p.couleur;
      ctx.fillText(p.txt, Math.round(p.x), Math.round(p.y));
    }
    ctx.globalAlpha = 1;
  }

  /** Flash d'écran (KO, grosse explosion). */
  dessinerFlash(ctx: CanvasRenderingContext2D, l: number, h: number): void {
    if (this.flash <= 0.02) return;
    ctx.globalAlpha = Math.min(0.5, this.flash * 0.5);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, l, h);
    ctx.globalAlpha = 1;
  }
}
