import { useEffect, useState } from "react";
import { Fenetre } from "./Fenetre";
import {
  ACTIONS,
  majReglages,
  NOM_ACTION,
  nomTouche,
  PRESETS,
  reinitialiserReglages,
  useReglages,
  type Action,
  type NomPreset,
} from "@/game/reglages";
import { jouer } from "@/game/son";

/** Menu Paramètres : touches, son, affichage, mobile. */
export function Reglages({ onFermer, onTuto }: { onFermer: () => void; onTuto: () => void }) {
  const r = useReglages();
  const [attente, setAttente] = useState<Action | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!attente) return;
    const down = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const k = e.key.toLowerCase();
      if (k === "escape") {
        setAttente(null);
        return;
      }
      const autre = ACTIONS.find((a) => a !== attente && r.touches[a].includes(k));
      if (autre) {
        setMsg(`« ${nomTouche(k)} » est déjà utilisée pour : ${NOM_ACTION[autre]}.`);
        return;
      }
      const reste = r.touches[attente].slice(1);
      majReglages({ touches: { ...r.touches, [attente]: [k, ...reste.filter((x) => x !== k)] } });
      setMsg("");
      setAttente(null);
      jouer("ok");
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  }, [attente, r.touches]);

  const preset = (n: NomPreset) => {
    majReglages({ touches: PRESETS[n] });
    setMsg("");
    jouer("ok");
  };
  const coche = "h-5 w-5 accent-[var(--primary)]";

  return (
    <Fenetre titre="⚙ Paramètres" onFermer={onFermer} large>
      <div className="space-y-5 text-lg">
        <section>
          <h3 className="mb-2 font-pixel text-[10px] text-accent">TOUCHES</h3>
          <div className="mb-2 flex flex-wrap gap-2">
            <button className="pixel-btn !px-2 !py-1" onClick={() => preset("azerty")}>
              AZERTY (ZQSD)
            </button>
            <button className="pixel-btn !px-2 !py-1" onClick={() => preset("qwerty")}>
              QWERTY (WASD)
            </button>
            <button className="pixel-btn !px-2 !py-1" onClick={() => preset("fleches")}>
              Flèches seulement
            </button>
          </div>
          <ul className="space-y-1">
            {ACTIONS.map((a) => (
              <li
                key={a}
                className="flex items-center justify-between gap-2 border-b border-border/40 py-1"
              >
                <span>{NOM_ACTION[a]}</span>
                <span className="flex items-center gap-2">
                  <span className="pixel-box min-w-24 px-2 py-1 text-center text-sm">
                    {attente === a
                      ? "Appuie sur une touche…"
                      : r.touches[a].map(nomTouche).join(" / ")}
                  </span>
                  <button
                    className="pixel-btn !px-2 !py-1 !text-[9px]"
                    onClick={() => {
                      setAttente(a);
                      setMsg("");
                    }}
                  >
                    Changer
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {msg && <p className="mt-1 text-destructive">{msg}</p>}
          <p className="mt-1 text-sm text-muted-foreground">
            Échap pour annuler un changement. Les flèches restent actives avec les presets AZERTY et
            QWERTY.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-pixel text-[10px] text-accent">SON</h3>
          <label className="flex items-center gap-3">
            Volume
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(r.volume * 100)}
              onChange={(e) => majReglages({ volume: Number(e.target.value) / 100 })}
              onPointerUp={() => jouer("xp")}
            />
          </label>
          <label className="flex items-center gap-3">
            <input
              className={coche}
              type="checkbox"
              checked={r.muet}
              onChange={(e) => majReglages({ muet: e.target.checked })}
            />{" "}
            Couper le son
          </label>
        </section>

        <section className="space-y-2">
          <h3 className="font-pixel text-[10px] text-accent">AFFICHAGE</h3>
          <label className="flex items-center gap-3">
            <input
              className={coche}
              type="checkbox"
              checked={r.noms}
              onChange={(e) => majReglages({ noms: e.target.checked })}
            />{" "}
            Afficher les pseudos au-dessus des personnages
          </label>
          <label className="flex items-center gap-3">
            <input
              className={coche}
              type="checkbox"
              checked={r.bulles}
              onChange={(e) => majReglages({ bulles: e.target.checked })}
            />{" "}
            Afficher les bulles de discussion
          </label>
          <label className="flex items-center gap-3">
            <input
              className={coche}
              type="checkbox"
              checked={r.grandeUi}
              onChange={(e) => majReglages({ grandeUi: e.target.checked })}
            />{" "}
            Interface et textes plus grands
          </label>
          <label className="flex items-center gap-3">
            <input
              className={coche}
              type="checkbox"
              checked={r.contraste}
              onChange={(e) => majReglages({ contraste: e.target.checked })}
            />{" "}
            Contraste élevé
          </label>
        </section>

        <section className="space-y-2">
          <h3 className="font-pixel text-[10px] text-accent">MOBILE</h3>
          <div className="flex flex-wrap items-center gap-2">
            Taille du joystick
            {(["petit", "normal", "grand"] as const).map((t) => (
              <button
                key={t}
                className={`pixel-btn !px-2 !py-1 ${r.joystick === t ? "!bg-accent" : ""}`}
                onClick={() => majReglages({ joystick: t })}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button className="pixel-btn" onClick={onTuto}>
            Revoir le tutoriel
          </button>
          <button
            className="pixel-btn"
            onClick={() => {
              reinitialiserReglages();
              setMsg("");
            }}
          >
            Réinitialiser
          </button>
          <button className="pixel-btn" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </div>
    </Fenetre>
  );
}
