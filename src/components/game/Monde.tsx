import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Personnage } from "./Personnage";
import { Monstre } from "./Monstre";
import { Joystick } from "./Joystick";
import { apparenceDepuis, type Direction } from "@/game/apparence";
import { fondSol } from "@/game/carte/sol";
import { Sprite } from "@/game/carte/sprites";
import {
  cibleDevant,
  estBloque,
  estMur,
  libelleCible,
  sortieSous,
  T,
  VEC,
  type Cible,
} from "@/game/carte/moteur";
import type { Arrivee, Objet, PnjDef, Sortie, Zone } from "@/game/carte/types";
import type { Joueur, Pos } from "@/game/multijoueur";
import type { Profil } from "@/game/profil";
import { actionDeTouche, type Reglages } from "@/game/reglages";

type Props = {
  zone: Zone;
  depart: Arrivee;
  pnjs: PnjDef[];
  autres: Joueur[];
  moi: Profil;
  pause: boolean;
  bulles: Record<string, string>;
  reglages: Reglages;
  onAction: (c: Cible) => void;
  onSortie: (s: Sortie) => void;
  onPos: (p: Pos) => void;
  onClicJoueur: (id: string) => void;
};

const DUREE_MARCHE = 260,
  DUREE_COURSE = 160,
  DELAI_TOURNER = 110;

/* ───────────── Couche fixe : sol, murs, objets (ne bouge jamais) ───────────── */
const Couche = memo(function Couche({ zone }: { zone: Zone }) {
  const { theme: t, murs } = zone;
  const tuilesMur = useMemo(() => {
    const r: Array<{ x: number; y: number; style: React.CSSProperties }> = [];
    for (let y = 0; y < zone.h; y++)
      for (let x = 0; x < zone.l; x++) {
        if (!estMur(zone, x, y)) continue;
        let bg: string;
        if (y < murs.haut)
          bg =
            y === 0
              ? `linear-gradient(${t.plinthe} 0 4px, ${t.mur} 4px)`
              : `linear-gradient(${t.trait} 0 4px, ${t.murBas} 4px calc(100% - 7px), ${t.plinthe} calc(100% - 7px))`;
        else if (y >= zone.h - murs.bas)
          bg =
            y === zone.h - murs.bas
              ? `linear-gradient(${t.plinthe} 0 7px, ${t.murBas} 7px)`
              : t.mur;
        else
          bg =
            x < murs.gauche
              ? `linear-gradient(90deg, ${t.murBas} calc(100% - 7px), ${t.plinthe} calc(100% - 7px))`
              : `linear-gradient(90deg, ${t.plinthe} 0 7px, ${t.murBas} 7px)`;
        r.push({ x, y, style: { left: x * T, top: y * T, width: T, height: T, background: bg } });
      }
    return r;
  }, [zone, t, murs]);

  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: fondSol(t.sol),
          backgroundSize: `${T * 2}px ${T * 2}px`,
          imageRendering: "pixelated",
        }}
      />
      {tuilesMur.map((m) => (
        <div key={`${m.x},${m.y}`} className="absolute" style={{ ...m.style, zIndex: 1 }} />
      ))}
      {zone.objets.map((o, i) => (
        <ObjetDecor key={i} o={o} />
      ))}
    </>
  );
});

function ObjetDecor({ o }: { o: Objet }) {
  const z = o.plat ? 2 : o.y + o.h <= 2 && o.hh > 0 ? 3 : 10 + (o.y + o.h) * 10;
  return (
    <div
      className="absolute"
      style={{
        left: o.x * T,
        top: (o.y - o.hh) * T,
        width: o.w * T,
        height: (o.h + o.hh + o.hb) * T,
        zIndex: z,
      }}
    >
      <Sprite o={o} />
      {o.label && o.kind === "porteH" && (
        <div
          className="pointer-events-none absolute left-0 right-0 text-center font-pixel leading-none text-white"
          style={{ top: o.hh === 0 && o.hb === 0 ? 4 : 9, fontSize: o.label.length > 9 ? 6 : 7 }}
        >
          {o.label}
        </div>
      )}
      {o.label && o.kind === "porteV" && (
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center font-pixel text-white"
          style={{ writingMode: "vertical-rl", fontSize: 7, textShadow: "1px 1px 0 #2a1810" }}
        >
          {o.label}
        </div>
      )}
    </div>
  );
}

/* ───────────── Un personnage posé sur la grille ───────────── */
const SurGrille = ({
  x,
  y,
  dur,
  children,
  z,
  onClick,
}: {
  x: number;
  y: number;
  dur: number;
  children: React.ReactNode;
  z?: number;
  onClick?: () => void;
}) => (
  <div
    className="absolute left-0 top-0"
    onClick={onClick}
    style={{
      width: T,
      height: T,
      transform: `translate(${x * T}px, ${y * T}px)`,
      transition: `transform ${dur}ms linear`,
      zIndex: z ?? 10 + (y + 1) * 10 - 1,
      cursor: onClick ? "pointer" : undefined,
    }}
  >
    <div className="absolute bottom-0 left-0 flex w-full flex-col items-center justify-end">
      {children}
    </div>
  </div>
);

const Bulle = ({ t }: { t: string }) => (
  <span className="pixel-box pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 w-max max-w-[180px] -translate-x-1/2 px-2 py-1 text-center text-sm leading-tight text-foreground">
    {t}
  </span>
);

export function Monde({
  zone,
  depart,
  pnjs,
  autres,
  moi,
  pause,
  bulles,
  reglages,
  onAction,
  onSortie,
  onPos,
  onClicJoueur,
}: Props) {
  const [et, setEt] = useState<Pos>({
    x: depart.x,
    y: depart.y,
    dir: depart.dir,
    marche: false,
    dur: DUREE_MARCHE,
  });
  const etRef = useRef(et);
  const libre = useRef(0);
  const sorti = useRef(false);
  const tenues = useRef<string[]>([]); // touches de direction enfoncées (la plus récente à la fin)
  const courir = useRef(false);
  const joy = useRef<Direction | null>(null);
  const p = useRef({ zone, pnjs, pause, reglages, onAction, onSortie, onPos });
  p.current = { zone, pnjs, pause, reglages, onAction, onSortie, onPos };
  const vue = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState({ w: 800, h: 520 });

  useEffect(() => {
    const el = vue.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTaille({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setTaille({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const publier = useCallback(() => {
    const e = { ...etRef.current };
    setEt(e);
    p.current.onPos(e);
  }, []);

  const agir = useCallback(() => {
    const c = p.current;
    if (c.pause || sorti.current || performance.now() < libre.current - 20) return;
    const e = etRef.current;
    const cible = cibleDevant(c.zone, e.x, e.y, e.dir, c.pnjs);
    if (cible) c.onAction(cible);
  }, []);

  /* Clavier */
  useEffect(() => {
    const cibleSaisie = (t: EventTarget | null) => {
      const n = (t as HTMLElement | null)?.tagName;
      return n === "INPUT" || n === "TEXTAREA" || n === "SELECT";
    };
    const down = (e: KeyboardEvent) => {
      if (cibleSaisie(e.target) || p.current.pause) return;
      const k = e.key.toLowerCase();
      const a = actionDeTouche(p.current.reglages, k);
      if (!a) return;
      e.preventDefault();
      if (a === "agir") {
        if (!e.repeat) agir();
        return;
      }
      if (a === "courir") {
        courir.current = true;
        return;
      }
      tenues.current = [...tenues.current.filter((x) => x !== a), a];
    };
    const up = (e: KeyboardEvent) => {
      const a = actionDeTouche(p.current.reglages, e.key.toLowerCase());
      if (a === "courir") courir.current = false;
      else if (a) tenues.current = tenues.current.filter((x) => x !== a);
    };
    const vider = () => {
      tenues.current = [];
      courir.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", vider);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", vider);
    };
  }, [agir]);

  /* Boucle de déplacement : une case à la fois, uniquement dans les 4 directions */
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const c = p.current,
        E = etRef.current;
      if (c.pause || sorti.current) {
        if (E.marche) {
          E.marche = false;
          publier();
        }
        return;
      }
      if (now < libre.current) return;
      const voulue =
        joy.current ?? (tenues.current[tenues.current.length - 1] as Direction | undefined) ?? null;
      if (!voulue) {
        if (E.marche) {
          E.marche = false;
          publier();
        }
        return;
      }
      if (voulue !== E.dir) {
        E.dir = voulue;
        E.marche = false;
        publier();
        libre.current = now + DELAI_TOURNER;
        return;
      }
      const v = VEC[voulue],
        nx = E.x + v.x,
        ny = E.y + v.y;
      if (estBloque(c.zone, nx, ny, c.pnjs)) {
        if (E.marche) {
          E.marche = false;
          publier();
        }
        libre.current = now + 80;
        return;
      }
      const dur = courir.current ? DUREE_COURSE : DUREE_MARCHE;
      E.x = nx;
      E.y = ny;
      E.marche = true;
      E.dur = dur;
      publier();
      libre.current = now + dur;
      const s = sortieSous(c.zone, nx, ny);
      if (s) {
        sorti.current = true;
        setTimeout(() => p.current.onSortie(s), dur * 0.9);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [publier]);

  const W = zone.l * T,
    H = zone.h * T;
  const cam = (centre: number, monde: number, ecran: number) =>
    monde <= ecran ? (monde - ecran) / 2 : Math.max(0, Math.min(monde - ecran, centre - ecran / 2));
  const cx = cam(et.x * T + T / 2, W, taille.w),
    cy = cam(et.y * T + T / 2, H, taille.h);

  const cible = useMemo(
    () => (pause ? null : cibleDevant(zone, et.x, et.y, et.dir, pnjs)),
    [zone, et.x, et.y, et.dir, pnjs, pause],
  );
  const echelle = reglages.joystick === "petit" ? 0.75 : reglages.joystick === "grand" ? 1.3 : 1;

  return (
    <div
      ref={vue}
      className="relative h-[68vh] w-full touch-none select-none overflow-hidden border-4 border-border"
      style={{ background: "#1a1208" }}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: W,
          height: H,
          transform: `translate(${-cx}px, ${-cy}px)`,
          transition: `transform ${et.dur ?? DUREE_MARCHE}ms linear`,
        }}
      >
        <Couche zone={zone} />

        {pnjs.map((n) => (
          <SurGrille key={n.id} x={n.x} y={n.y} dur={0}>
            {n.monstre ? (
              <>
                <span className="mb-0.5 whitespace-nowrap bg-background/85 px-1 font-pixel text-[7px] text-destructive">
                  {n.nom}
                </span>
                <Monstre type={n.monstre} taille={T * 1.2} />
              </>
            ) : (
              <Personnage
                a={apparenceDepuis(n.seed)}
                dir={n.dir}
                taille={T * 1.5}
                {...(reglages.noms ? { pseudo: n.nom } : {})}
              />
            )}
          </SurGrille>
        ))}

        {autres.map((j) => (
          <SurGrille
            key={j.id}
            x={j.x}
            y={j.y}
            dur={j.dur ?? DUREE_MARCHE}
            onClick={() => onClicJoueur(j.id)}
          >
            {reglages.bulles && bulles[j.id] && <Bulle t={bulles[j.id]!} />}
            <Personnage
              a={j.apparence}
              dir={j.dir}
              marche={j.marche}
              taille={T * 1.5}
              {...(reglages.noms ? { pseudo: j.pseudo, niveau: j.niveau } : {})}
            />
          </SurGrille>
        ))}

        <SurGrille
          x={et.x}
          y={et.y}
          dur={et.dur ?? DUREE_MARCHE}
          onClick={() => onClicJoueur(moi.id)}
        >
          {reglages.bulles && bulles[moi.id] && <Bulle t={bulles[moi.id]!} />}
          <Personnage
            a={moi.apparence}
            dir={et.dir}
            marche={et.marche}
            taille={T * 1.5}
            {...(reglages.noms ? { pseudo: moi.pseudo, niveau: moi.niveau } : {})}
          />
        </SurGrille>
      </div>

      {cible && (
        <button
          className="pixel-box absolute bottom-3 left-1/2 z-[2000] -translate-x-1/2 px-3 py-2 font-pixel text-[10px] text-accent"
          onClick={agir}
        >
          [{reglages.touches.agir[0] === " " ? "Espace" : reglages.touches.agir[0]!.toUpperCase()}]{" "}
          {libelleCible(cible)}
        </button>
      )}

      <div
        className="md:hidden"
        style={{
          transform: `scale(${echelle})`,
          transformOrigin: "bottom left",
          position: "absolute",
          left: 0,
          bottom: 0,
          width: 140,
          height: 140,
        }}
      >
        <Joystick
          onChange={(v) => {
            joy.current =
              Math.hypot(v.x, v.y) < 0.4
                ? null
                : Math.abs(v.x) > Math.abs(v.y)
                  ? v.x < 0
                    ? "gauche"
                    : "droite"
                  : v.y < 0
                    ? "haut"
                    : "bas";
          }}
        />
      </div>
      <button
        className="pixel-btn absolute bottom-6 right-4 z-[2000] !h-16 !w-16 !rounded-full !p-0 md:hidden"
        onPointerDown={agir}
      >
        A
      </button>
    </div>
  );
}
