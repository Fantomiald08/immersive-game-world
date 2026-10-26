import { Fenetre } from "./Fenetre";
import { BADGES, QUETES, type Prog } from "@/game/progression";

export function Journal({ prog, onFermer }: { prog: Prog; onFermer: () => void }) {
  return (
    <Fenetre titre="📔 Journal du joueur" onFermer={onFermer} large>
      <div className="space-y-4 text-lg">
        <p>
          🔥 Série :{" "}
          <b>
            {prog.serie} jour{prog.serie > 1 ? "s" : ""}
          </b>{" "}
          de suite
        </p>
        <section>
          <h3 className="mb-2 font-pixel text-[10px] text-accent">QUÊTES DU JOUR</h3>
          <ul className="space-y-1">
            {QUETES.map((q) => {
              const ok = prog.faites.includes(q.id);
              return (
                <li key={q.id} className={ok ? "text-primary" : ""}>
                  {ok ? "✔" : "☐"} {q.titre}{" "}
                  <span className="text-sm text-muted-foreground">(+{q.xp} XP)</span>
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 font-pixel text-[10px] text-accent">BADGES</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {BADGES.map((b) => {
              const ok = prog.badges.includes(b.id);
              return (
                <li key={b.id} className={`pixel-box p-2 ${ok ? "" : "opacity-50"}`}>
                  {ok ? b.icone : "🔒"} <b>{b.nom}</b>
                  <div className="text-sm">{b.desc}</div>
                </li>
              );
            })}
          </ul>
        </section>
        <p className="text-sm text-muted-foreground">
          Les quêtes et badges sont enregistrés sur cet appareil.
        </p>
        <button className="pixel-btn" onClick={onFermer}>
          Fermer
        </button>
      </div>
    </Fenetre>
  );
}
