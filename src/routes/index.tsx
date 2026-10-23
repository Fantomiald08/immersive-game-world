import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  BADGES, avatar, checkBadges, level, levelBounds, load, makeQuiz, persist, title,
  type Course, type Question, type Save,
} from "@/lib/game";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Isitech Quest — Révise comme dans un jeu vidéo" },
      { name: "description", content: "Explore le monde d'Isitech : dépose tes cours, affronte des boss-quiz, gagne de l'XP et des succès." },
      { property: "og:title", content: "Isitech Quest" },
      { property: "og:description", content: "Révise tes cours en mode RPG pixel : quêtes, boss et niveaux." },
    ],
  }),
  component: Game,
});

type Screen = "title" | "map" | "library" | "arena" | "tavern";
const W = 13, H = 9;
const BUILDINGS: { x: number; y: number; icon: string; name: string; to: Screen }[] = [
  { x: 2, y: 2, icon: "📚", name: "Bibliothèque", to: "library" },
  { x: 10, y: 2, icon: "⚔️", name: "Arène", to: "arena" },
  { x: 6, y: 6, icon: "🍺", name: "Taverne", to: "tavern" },
];
const WATER = new Set(["0,8", "1,8", "12,0", "12,1", "11,0", "0,0"]);
const isPath = (x: number, y: number) => y === 4 || x === 6 || (y === 3 && (x === 2 || x === 10)) || (x === 6 && y === 5);

let AC: AudioContext | null = null;
function beep(k: "xp" | "up" | "good" | "bad" | "step") {
  try {
    AC = AC || new AudioContext();
    const seq = { xp: [660, 880], up: [523, 659, 784, 1047], good: [784, 1047], bad: [220, 165], step: [300] }[k];
    seq.forEach((f, i) => {
      const o = AC!.createOscillator(), g = AC!.createGain();
      o.type = "square"; o.frequency.value = f; g.gain.value = k === "step" ? 0.01 : 0.04;
      o.connect(g); g.connect(AC!.destination);
      const t = AC!.currentTime + i * 0.09; o.start(t); o.stop(t + 0.07);
    });
  } catch { /* no audio */ }
}

function Game() {
  const [save, setSave] = useState<Save>(load);
  const [screen, setScreen] = useState<Screen>("title");
  const [pos, setPos] = useState({ x: 6, y: 4 });
  const [toasts, setToasts] = useState<string[]>([]);
  const [lvUp, setLvUp] = useState<number | null>(null);

  const toast = (t: string) => { setToasts((a) => [...a, t]); setTimeout(() => setToasts((a) => a.slice(1)), 2800); };

  const award = useCallback((xp: number, stat: string | null, label: string, mut?: (s: Save) => void) => {
    setSave((prev) => {
      const s: Save = structuredClone(prev);
      mut?.(s);
      const old = level(s.profile.xp);
      if (stat) s.profile.stats[stat] = (s.profile.stats[stat] || 0) + 1;
      s.profile.xp += xp;
      checkBadges(s.profile).forEach((bd) => toast(`${BADGES[bd]?.[0]} Succès : ${BADGES[bd]?.[1]}`));
      if (xp) { toast(`+${xp} XP · ${label}`); beep("xp"); }
      const nl = level(s.profile.xp);
      if (nl > old) { setLvUp(nl); beep("up"); setTimeout(() => setLvUp(null), 3000); }
      persist(s);
      return s;
    });
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (save.profile.last !== today) {
      const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      award(10, null, "Connexion du jour 🔥", (s) => {
        s.profile.streak = s.profile.last === y ? s.profile.streak + 1 : 1;
        s.profile.last = today;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const here = BUILDINGS.find((b) => b.x === pos.x && b.y === pos.y);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen === "title" && (e.key === "Enter" || e.key === " ")) { setScreen("map"); beep("up"); return; }
      if (e.key === "Escape" && screen !== "map" && screen !== "title") { setScreen("map"); return; }
      if (screen !== "map") return;
      const d: Record<string, [number, number]> = { ArrowUp: [0, -1], z: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], q: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
      const m = d[e.key];
      if (m) {
        e.preventDefault();
        setPos((p) => {
          const x = Math.max(0, Math.min(W - 1, p.x + m[0])), y = Math.max(0, Math.min(H - 1, p.y + m[1]));
          if (WATER.has(`${x},${y}`)) return p;
          beep("step"); return { x, y };
        });
      }
      if ((e.key === "Enter" || e.key === " ") && here) { e.preventDefault(); setScreen(here.to); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [screen, here]);

  const p = save.profile, l = level(p.xp), [a, b] = levelBounds(l);

  return (
    <div className="min-h-screen p-3 md:p-6">
      {screen === "title" ? (
        <TitleScreen onStart={() => { setScreen("map"); beep("up"); }} />
      ) : (
        <div className="mx-auto max-w-4xl space-y-4">
          {/* HUD */}
          <div className="pixel-box flex items-center gap-3 p-3">
            <div className="grid h-12 w-12 place-items-center bg-muted text-3xl">{avatar(l)}</div>
            <div className="min-w-0 flex-1">
              <div className="font-pixel text-[10px] text-primary">LV {l} · {title(l)}</div>
              <div className="mt-2 h-4 border-4 border-border bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${((p.xp - a) / (b - a)) * 100}%` }} />
              </div>
              <div className="text-sm text-muted-foreground">{p.xp} / {b} XP</div>
            </div>
            <div className="font-pixel text-[10px] text-accent">🔥{p.streak}</div>
            {screen !== "map" && <button className="pixel-btn" onClick={() => setScreen("map")}>🗺 Carte</button>}
          </div>

          {screen === "map" && <WorldMap pos={pos} here={here} onEnter={(s) => setScreen(s)} onTap={(x, y) => setPos({ x, y })} />}
          {screen === "library" && (
            <Library courses={save.courses} onAdd={(c) => award(c.text.length > 50 ? 30 : 20, "dep", "Parchemin déposé", (s) => { s.courses.unshift(c); })}
              onDel={(id) => setSave((s) => { const n = { ...s, courses: s.courses.filter((c) => c.id !== id) }; persist(n); return n; })} />
          )}
          {screen === "arena" && <Arena courses={save.courses} award={award} />}
          {screen === "tavern" && <Tavern save={save} />}
        </div>
      )}

      <div className="fixed right-4 top-4 z-30 flex flex-col items-end gap-2">
        {toasts.map((t, i) => <div key={i} className="pixel-box px-3 py-2 font-pixel text-[10px] text-primary">{t}</div>)}
      </div>
      {lvUp && (
        <div onClick={() => setLvUp(null)} className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-background/95 text-center">
          <div className="font-pixel anim-bob text-2xl text-primary">LEVEL UP !</div>
          <div className="font-pixel text-7xl text-accent">{lvUp}</div>
          <div className="text-3xl">{avatar(lvUp)} {title(lvUp)}</div>
        </div>
      )}
    </div>
  );
}

function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[90vh] flex-col items-center justify-center gap-8 text-center">
      <div className="text-6xl anim-bob">🧑‍💻</div>
      <h1 className="font-pixel text-3xl leading-snug text-primary md:text-5xl">ISITECH<br /><span className="text-accent">QUEST</span></h1>
      <p className="max-w-md text-2xl text-muted-foreground">Explore le campus, dépose tes parchemins de cours et terrasse les boss-quiz pour monter de niveau.</p>
      <button className="pixel-btn anim-blink" onClick={onStart}>▶ PRESS START</button>
      <p className="text-lg text-muted-foreground">Flèches / ZQSD pour bouger · Entrée pour entrer</p>
    </div>
  );
}

function WorldMap({ pos, here, onEnter, onTap }: { pos: { x: number; y: number }; here?: (typeof BUILDINGS)[number]; onEnter: (s: Screen) => void; onTap: (x: number, y: number) => void }) {
  return (
    <div className="space-y-3">
      <div className="pixel-box grid p-0" style={{ gridTemplateColumns: `repeat(${W}, 1fr)` }}>
        {Array.from({ length: W * H }, (_, i) => {
          const x = i % W, y = Math.floor(i / W);
          const bld = BUILDINGS.find((bb) => bb.x === x && bb.y === y);
          const cls = WATER.has(`${x},${y}`) ? "tile-water" : isPath(x, y) || bld ? "tile-path" : "tile-grass";
          const tree = !bld && cls === "tile-grass" && (x * 7 + y * 3) % 9 === 0;
          return (
            <button key={i} onClick={() => (bld && pos.x === x && pos.y === y ? onEnter(bld.to) : !WATER.has(`${x},${y}`) && onTap(x, y))}
              className={`${cls} relative grid aspect-square place-items-center text-xl md:text-3xl`}>
              {tree && "🌲"}
              {bld && <span className="text-2xl md:text-4xl">{bld.icon}</span>}
              {pos.x === x && pos.y === y && <span className="anim-bob absolute text-2xl md:text-4xl">🧑‍💻</span>}
            </button>
          );
        })}
      </div>
      <div className="pixel-box min-h-16 p-3 text-xl">
        {here ? (
          <div className="flex items-center justify-between gap-3">
            <span>Tu es devant : <b className="text-accent">{here.icon} {here.name}</b></span>
            <button className="pixel-btn" onClick={() => onEnter(here.to)}>Entrer ⏎</button>
          </div>
        ) : (
          <span className="text-muted-foreground">Rejoins un bâtiment : 📚 Bibliothèque (cours), ⚔️ Arène (boss-quiz), 🍺 Taverne (profil). Clique sur une case pour t'y téléporter.</span>
        )}
      </div>
    </div>
  );
}

function Library({ courses, onAdd, onDel }: { courses: Course[]; onAdd: (c: Course) => void; onDel: (id: string) => void }) {
  const [t, setT] = useState(""), [type, setType] = useState("Cours"), [text, setText] = useState("");
  return (
    <div className="space-y-4">
      <div className="pixel-box space-y-3 p-4">
        <h2 className="font-pixel text-sm text-accent">📚 Bibliothèque — déposer un parchemin</h2>
        <input className="pixel-input" placeholder="Titre (ex : Modèle OSI)" value={t} onChange={(e) => setT(e.target.value)} />
        <select className="pixel-input" value={type} onChange={(e) => setType(e.target.value)}>
          {["Cours", "Projet", "TP", "Document"].map((o) => <option key={o}>{o}</option>)}
        </select>
        <textarea className="pixel-input" rows={5} placeholder="Colle le contenu du cours : il servira à invoquer un boss-quiz" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="pixel-btn" disabled={!t.trim()} onClick={() => { onAdd({ id: crypto.randomUUID(), title: t.trim(), type, text, created: Date.now() }); setT(""); setText(""); }}>+ Déposer (+20 XP)</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {courses.length === 0 && <div className="pixel-box p-4 text-muted-foreground">Les étagères sont vides…</div>}
        {courses.map((c) => (
          <div key={c.id} className="pixel-box p-3">
            <div className="font-pixel text-[10px] text-primary">{c.type}</div>
            <div className="text-2xl">📜 {c.title}</div>
            <div className="text-muted-foreground">{c.text.length > 50 ? "⚔️ Boss invocable" : "Pas assez de texte pour un boss"}</div>
            <button className="mt-2 text-destructive" onClick={() => onDel(c.id)}>🗑 Brûler</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const BOSSES = ["👾", "🐲", "👹", "🤖", "🧟"];
function Arena({ courses, award }: { courses: Course[]; award: (xp: number, stat: string | null, label: string) => void }) {
  const ok = courses.filter((c) => c.text.length > 50);
  const [fight, setFight] = useState<{ name: string; boss: string; qs: Question[]; i: number; hp: number; bossHp: number; pick: number | null; hit: "boss" | "me" | null } | null>(null);
  const [err, setErr] = useState("");

  const start = (c: Course) => {
    const qs = makeQuiz(c.text, 6);
    if (qs.length < 2) { setErr("Ce cours est trop court pour invoquer un boss. Ajoute plus de texte !"); return; }
    setErr(""); beep("up");
    setFight({ name: c.title, boss: BOSSES[Math.floor(Math.random() * BOSSES.length)], qs, i: 0, hp: 3, bossHp: qs.length, pick: null, hit: null });
  };

  if (!fight) return (
    <div className="pixel-box space-y-3 p-4">
      <h2 className="font-pixel text-sm text-accent">⚔️ Arène — choisis ton adversaire</h2>
      {err && <p className="text-destructive">{err}</p>}
      {ok.length === 0 && <p className="text-muted-foreground">Aucun boss disponible. Dépose un cours avec du texte à la Bibliothèque.</p>}
      {ok.map((c) => <button key={c.id} className="pixel-btn mr-2 mb-2" onClick={() => start(c)}>Affronter : {c.title}</button>)}
    </div>
  );

  const f = fight, q = f.qs[f.i] ?? f.qs[0]!;
  const over = f.hp <= 0 || f.bossHp <= 0 || f.i >= f.qs.length;
  const won = f.bossHp <= 0;

  const answer = (k: number) => {
    const good = k === q.answer;
    beep(good ? "good" : "bad");
    if (good) award(10, "good", "Coup critique");
    setFight({ ...f, pick: k, hp: good ? f.hp : f.hp - 1, bossHp: good ? f.bossHp - 1 : f.bossHp, hit: good ? "boss" : "me" });
  };
  const next = () => {
    const n = { ...f, i: f.i + 1, pick: null, hit: null };
    const end = n.hp <= 0 || n.bossHp <= 0 || n.i >= n.qs.length;
    if (end) {
      award(0, "fight", "");
      if (n.bossHp <= 0) { award(n.hp === 3 ? 100 : 50, "win", n.hp === 3 ? "Victoire sans dégât !" : "Boss vaincu"); if (n.hp === 3) award(0, "perfect", ""); }
    }
    setFight(n);
  };

  return (
    <div className="pixel-box space-y-4 p-4">
      <div className="flex items-end justify-between">
        <div className={`text-center ${f.hit === "me" ? "anim-shake" : ""}`}>
          <div className="text-5xl">🧑‍💻</div>
          <div className="text-2xl">{"❤️".repeat(Math.max(0, f.hp))}{"🖤".repeat(3 - Math.max(0, f.hp))}</div>
        </div>
        <div className="font-pixel text-xs text-muted-foreground">VS</div>
        <div className={`text-center ${f.hit === "boss" ? "anim-shake" : ""}`}>
          <div className={`text-6xl ${won ? "opacity-20" : "anim-bob"}`}>{f.boss}</div>
          <div className="mt-1 h-4 w-40 border-4 border-border bg-muted">
            <div className="h-full bg-destructive transition-all" style={{ width: `${(f.bossHp / f.qs.length) * 100}%` }} />
          </div>
          <div className="text-sm text-muted-foreground">Boss : {f.name}</div>
        </div>
      </div>

      {over ? (
        <div className="space-y-3 text-center">
          <div className={`font-pixel text-xl ${won ? "text-primary" : "text-destructive"}`}>{won ? "VICTOIRE !" : "GAME OVER"}</div>
          <p>{won ? "Le boss s'effondre. Le savoir est à toi." : "Relis le parchemin et retente ta chance."}</p>
          <button className="pixel-btn" onClick={() => setFight(null)}>Retour à l'arène</button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="font-pixel text-[10px] text-accent">Le boss attaque ! Question {f.i + 1}</div>
          <p className="text-2xl">{q.q}</p>
          {q.options.map((o, k) => (
            <button key={k} disabled={f.pick !== null} onClick={() => answer(k)}
              className={`block w-full border-4 p-2 text-left text-xl ${f.pick !== null && k === q.answer ? "border-primary bg-secondary" : f.pick === k ? "border-destructive" : "border-border bg-muted"}`}>
              ▸ {o}
            </button>
          ))}
          {f.pick !== null && <button className="pixel-btn" onClick={next}>{f.pick === q.answer ? "💥 Touché ! Suivant" : "😵 Aïe ! Suivant"}</button>}
        </div>
      )}
    </div>
  );
}

function Tavern({ save }: { save: Save }) {
  const s = save.profile.stats;
  return (
    <div className="space-y-4">
      <div className="pixel-box p-4">
        <h2 className="mb-3 font-pixel text-sm text-accent">🍺 Taverne — ta fiche de héros</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[["Parchemins", s["dep"]], ["Combats", s["fight"]], ["Boss vaincus", s["win"]], ["Coups critiques", s["good"]]].map(([k, v]) => (
            <div key={k as string} className="bg-muted p-3"><div className="font-pixel text-lg text-primary">{v || 0}</div><div>{k}</div></div>
          ))}
        </div>
      </div>
      <div className="pixel-box p-4">
        <h2 className="mb-3 font-pixel text-sm text-accent">🏆 Succès</h2>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-7">
          {Object.entries(BADGES).map(([k, [ic, n]]) => (
            <div key={k} className={`bg-muted p-2 text-center ${save.profile.badges.includes(k) ? "" : "opacity-30 grayscale"}`}>
              <div className="text-3xl">{ic}</div><div className="text-base">{n}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
