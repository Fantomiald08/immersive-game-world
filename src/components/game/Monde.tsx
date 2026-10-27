import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Personnage } from "./Personnage";
import { Monstre } from "./Monstre";
import { Joystick } from "./Joystick";
import { apparenceDepuis } from "@/game/apparence";
import { fondSol } from "@/game/carte/sol";
import { Sprite } from "@/game/carte/sprites";
import {
  avancer,
  caseDe,
  cibleDevant,
  creerMob,
  estMur,
  libelleCible,
  sortieSous,
  T,
  V_COURSE,
  V_MARCHE,
  type Cible,
  type Mob,
} from "@/game/carte/moteur";
import type { Arrivee, Objet, PnjDef, Pt, Sortie, Zone } from "@/game/carte/types";
import type { Distant, Etat } from "@/game/salle";
import type { Profil } from "@/game/profil";
import { actionDeTouche, type Reglages } from "@/game/reglages";

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

/* ───────────── Un personnage posé dans le monde (sa position est mise à jour image par image) ───────────── */
const Place = ({
  x,
  y,
  refEl,
  children,
  onClick,
}: {
  x: number;
  y: number;
  refEl?: (el: HTMLDivElement | null) => void;
  children: React.ReactNode;
  onClick?: () => void;
}) => (
  <div
    ref={refEl}
    className="absolute left-0 top-0"
    onClick={onClick}
    style={{
      width: T,
      height: T,
      transform: `translate(${x * T}px, ${y * T}px)`,
      zIndex: 10 + Math.round((y + 1) * 10) - 1,
      cursor: onClick ? "pointer" : undefined,
    }}
  >
    <div className="absolute bottom-0 left-0 flex w-full flex-col items-center justify-end">
      {children}
    </div>
  </div>
);

/** Statut (5 min) et bulle de discussion (4 s) au-dessus de la tête. */
const Etiquettes = ({
  bulle,
  statut,
}: {
  bulle?: string | undefined;
  statut?: string | undefined;
}) =>
  bulle || statut ? (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 flex -translate-x-1/2 flex-col-reverse items-center gap-1">
      {statut && (
        <span className="w-max max-w-[210px] rounded border-2 border-accent bg-background/95 px-2 py-0.5 text-center text-xs leading-tight text-foreground">
          📌 {statut}
        </span>
      )}
      {bulle && (
        <span className="pixel-box w-max max-w-[180px] px-2 py-1 text-center text-sm leading-tight text-foreground">
          {bulle}
        </span>
      )}
    </div>
  ) : null;

type Props = {
  zone: Zone;
  depart: Arrivee;
  pnjs: PnjDef[];
  autres: Distant[];
  lireAutres: () => Map<string, Distant>;
  moi: Profil;
  pause: boolean;
  bulles: Record<string, string>;
  statuts: Record<string, string>;
  reglages: Reglages;
  onAction: (c: Cible) => void;
  onSortie: (s: Sortie) => void;
  onEtat: (e: Etat) => void;
  onClicJoueur: (id: string) => void;
  /** Donne à la page l'état actuel du joueur (pour les battements) et les positions en direct (pour la carte). */
  etatRef: MutableRefObject<() => Etat>;
  positionsRef: MutableRefObject<() => { moi: Pt; autres: Array<Pt & { id: string }> }>;
};
type Sim = {
  m: Mob;
  want: Mob["dir"] | null;
  run: boolean;
  vis: Pt;
  ver: number;
  el: HTMLDivElement | null;
  aff: { dir: Mob["dir"]; marche: boolean };
};

export function Monde({
  zone,
  depart,
  pnjs,
  autres,
  lireAutres,
  moi,
  pause,
  bulles,
  statuts,
  reglages,
  onAction,
  onSortie,
  onEtat,
  onClicJoueur,
  etatRef,
  positionsRef,
}: Props) {
  const mob = useRef<Mob>(creerMob(depart.x, depart.y, depart.dir));
  const courir = useRef(false);
  const sorti = useRef(false);
  const tenues = useRef<string[]>([]); // directions enfoncées, la plus récente à la fin
  const joy = useRef<Mob["dir"] | null>(null);
  const p = useRef({ zone, pnjs, pause, reglages, onAction, onSortie, onEtat, lireAutres });
  p.current = { zone, pnjs, pause, reglages, onAction, onSortie, onEtat, lireAutres };
  const vue = useRef<HTMLDivElement>(null),
    monde = useRef<HTMLDivElement>(null),
    elMoi = useRef<HTMLDivElement>(null);
  const taille = useRef({ w: 800, h: 520 });
  const sims = useRef(new Map<string, Sim>());
  const cleCible = useRef("");

  const [ui, setUi] = useState({ dir: depart.dir, marche: false });
  const [aff, setAff] = useState<Record<string, { dir: Mob["dir"]; marche: boolean }>>({});
  const [cible, setCible] = useState<Cible | null>(null);

  etatRef.current = () => ({
    x: mob.current.x,
    y: mob.current.y,
    dir: mob.current.dir,
    marche: mob.current.marche,
    run: courir.current,
  });
  positionsRef.current = () => ({
    moi: { x: mob.current.x, y: mob.current.y },
    autres: Array.from(sims.current, ([id, s]) => ({ id, x: s.vis.x, y: s.vis.y })),
  });

  useEffect(() => {
    const el = vue.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      taille.current = { w: el.clientWidth, h: el.clientHeight };
    });
    ro.observe(el);
    taille.current = { w: el.clientWidth, h: el.clientHeight };
    return () => ro.disconnect();
  }, []);

  const agir = useCallback(() => {
    const c = p.current;
    if (c.pause || sorti.current) return;
    const k = caseDe(mob.current);
    const cib = cibleDevant(c.zone, k.x, k.y, mob.current.dir, c.pnjs);
    if (cib) c.onAction(cib);
  }, []);

  /* Clavier : aucune temporisation, la direction demandée est prise en compte à l'image suivante */
  useEffect(() => {
    const saisie = (t: EventTarget | null) => {
      const n = (t as HTMLElement | null)?.tagName;
      return n === "INPUT" || n === "TEXTAREA" || n === "SELECT";
    };
    const down = (e: KeyboardEvent) => {
      if (saisie(e.target) || p.current.pause) return;
      const a = actionDeTouche(p.current.reglages, e.key.toLowerCase());
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

  useEffect(() => {
    cleCible.current = "";
  }, [pnjs]);

  /* Boucle de jeu : une mise à jour par image */
  useEffect(() => {
    let raf = 0,
      last = performance.now(),
      sig = "",
      dernierEnvoi = 0,
      enAttente = false;
    const cam = { x: 0, y: 0, ok: false };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (dt <= 0) return;
      const c = p.current,
        m = mob.current;
      const voulu =
        c.pause || sorti.current
          ? null
          : (joy.current ??
            (tenues.current[tenues.current.length - 1] as Mob["dir"] | undefined) ??
            null);
      avancer(c.zone, m, voulu, courir.current ? V_COURSE : V_MARCHE, dt, c.pnjs);

      setUi((u) =>
        u.dir === m.dir && u.marche === m.marche ? u : { dir: m.dir, marche: m.marche },
      );

      // Réseau : un message seulement quand l'état de marche change (limité à 1 toutes les 80 ms)
      const s2 = `${m.dir}${m.marche ? 1 : 0}${courir.current ? 1 : 0}`;
      if (s2 !== sig) {
        sig = s2;
        enAttente = true;
      }
      if (enAttente && now - dernierEnvoi >= 80) {
        enAttente = false;
        dernierEnvoi = now;
        c.onEtat({ x: m.x, y: m.y, dir: m.dir, marche: m.marche, run: courir.current });
      }

      // Sortie de zone : seulement quand on est bien arrivé sur la case
      const k = caseDe(m);
      if (!sorti.current && Math.abs(m.x - k.x) < 0.02 && Math.abs(m.y - k.y) < 0.02) {
        const so = sortieSous(c.zone, k.x, k.y);
        if (so) {
          sorti.current = true;
          c.onSortie(so);
        }
      }

      // Case visée (pour l'indication « Espace »)
      const ck = `${k.x},${k.y},${m.dir}`;
      if (ck !== cleCible.current) {
        cleCible.current = ck;
        setCible(cibleDevant(c.zone, k.x, k.y, m.dir, c.pnjs));
      }

      // Mon personnage + caméra (très légèrement adoucie)
      if (elMoi.current) {
        elMoi.current.style.transform = `translate(${m.x * T}px, ${m.y * T}px)`;
        elMoi.current.style.zIndex = String(10 + Math.round((m.y + 1) * 10) - 1);
      }
      const W = c.zone.l * T,
        H = c.zone.h * T,
        { w, h } = taille.current;
      const cadre = (centre: number, monde2: number, ecran: number) =>
        monde2 <= ecran
          ? (monde2 - ecran) / 2
          : Math.max(0, Math.min(monde2 - ecran, centre - ecran / 2));
      const tx = cadre(m.x * T + T / 2, W, w),
        ty = cadre(m.y * T + T / 2, H, h);
      if (!cam.ok) {
        cam.x = tx;
        cam.y = ty;
        cam.ok = true;
      } else {
        const f = Math.min(1, dt * 14);
        cam.x += (tx - cam.x) * f;
        cam.y += (ty - cam.y) * f;
      }
      if (monde.current) monde.current.style.transform = `translate(${-cam.x}px, ${-cam.y}px)`;

      // Autres joueurs : on prolonge leur trajectoire entre deux messages
      const src = c.lireAutres();
      const pts = c.pnjs;
      for (const [id, d] of src) {
        let s = sims.current.get(id);
        if (!s) {
          s = {
            m: creerMob(d.e.x, d.e.y, d.e.dir),
            want: null,
            run: d.e.run,
            vis: { x: d.e.x, y: d.e.y },
            ver: -1,
            el: null,
            aff: { dir: d.e.dir, marche: d.e.marche },
          };
          sims.current.set(id, s);
        }
        if (s.ver !== d.ver) {
          s.ver = d.ver;
          s.m.x = d.e.x;
          s.m.y = d.e.y;
          s.m.dir = d.e.dir;
          s.want = d.e.marche ? d.e.dir : null;
          s.run = d.e.run;
        }
        avancer(c.zone, s.m, s.want, s.run ? V_COURSE : V_MARCHE, dt, pts);
        const f = Math.min(1, dt * 14);
        if (Math.hypot(s.m.x - s.vis.x, s.m.y - s.vis.y) > 3) {
          s.vis.x = s.m.x;
          s.vis.y = s.m.y;
        } else {
          s.vis.x += (s.m.x - s.vis.x) * f;
          s.vis.y += (s.m.y - s.vis.y) * f;
        }
        if (s.el) {
          s.el.style.transform = `translate(${s.vis.x * T}px, ${s.vis.y * T}px)`;
          s.el.style.zIndex = String(10 + Math.round((s.vis.y + 1) * 10) - 1);
        }
        const marche = s.m.marche || Math.hypot(s.m.x - s.vis.x, s.m.y - s.vis.y) > 0.15;
        if (s.aff.dir !== s.m.dir || s.aff.marche !== marche) {
          s.aff = { dir: s.m.dir, marche };
          const a = s.aff;
          setAff((o) => ({ ...o, [id]: a }));
        }
      }
      for (const id of [...sims.current.keys()]) if (!src.has(id)) sims.current.delete(id);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const W = zone.l * T,
    H = zone.h * T;
  const echelle = reglages.joystick === "petit" ? 0.75 : reglages.joystick === "grand" ? 1.3 : 1;
  const refDistant = (id: string) => (el: HTMLDivElement | null) => {
    const s = sims.current.get(id);
    if (s) s.el = el;
    else if (el) {
      /* sera rattaché à la prochaine image */ pendants.current.set(id, el);
    }
  };
  const pendants = useRef(new Map<string, HTMLDivElement>());
  const debuts = useRef(new Map<string, Pt>()); // position de départ figée : React ne doit jamais réécrire la position animée
  useEffect(() => {
    for (const [id, el] of pendants.current) {
      const s = sims.current.get(id);
      if (s) {
        s.el = el;
        pendants.current.delete(id);
      }
    }
  });

  return (
    <div
      ref={vue}
      className="relative h-[68vh] w-full touch-none select-none overflow-hidden border-4 border-border"
      style={{ background: "#1a1208" }}
    >
      <div ref={monde} className="absolute left-0 top-0" style={{ width: W, height: H }}>
        <Couche zone={zone} />

        {pnjs.map((n) => (
          <Place key={n.id} x={n.x} y={n.y}>
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
          </Place>
        ))}

        {autres.map((j) => {
          const a = aff[j.id] ?? { dir: j.e.dir, marche: j.e.marche };
          if (!debuts.current.has(j.id)) debuts.current.set(j.id, { x: j.e.x, y: j.e.y });
          const d0 = debuts.current.get(j.id)!;
          return (
            <Place
              key={j.id}
              x={d0.x}
              y={d0.y}
              onClick={() => onClicJoueur(j.id)}
              refEl={(el) => {
                const s = sims.current.get(j.id);
                if (s) s.el = el;
                else if (el) pendants.current.set(j.id, el);
              }}
            >
              <Etiquettes
                bulle={reglages.bulles ? bulles[j.id] : undefined}
                statut={reglages.bulles ? statuts[j.id] : undefined}
              />
              <Personnage
                a={j.apparence}
                dir={a.dir}
                marche={a.marche}
                taille={T * 1.5}
                {...(reglages.noms ? { pseudo: j.pseudo, niveau: j.niveau } : {})}
              />
            </Place>
          );
        })}

        <Place
          x={depart.x}
          y={depart.y}
          refEl={(el) => {
            (elMoi as MutableRefObject<HTMLDivElement | null>).current = el;
          }}
          onClick={() => onClicJoueur(moi.id)}
        >
          <Etiquettes
            bulle={reglages.bulles ? bulles[moi.id] : undefined}
            statut={reglages.bulles ? statuts[moi.id] : undefined}
          />
          <Personnage
            a={moi.apparence}
            dir={ui.dir}
            marche={ui.marche}
            taille={T * 1.5}
            {...(reglages.noms ? { pseudo: moi.pseudo, niveau: moi.niveau } : {})}
          />
        </Place>
      </div>

      {cible && !pause && (
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
