import { useEffect, useRef, useState } from "react";
import { Fenetre } from "./Fenetre";
import type { Conversation, Present } from "@/game/multijoueur";

/** Messages privés entre élèves connectés (non conservés une fois la page fermée). */
export function Messages({
  moiId,
  roster,
  conv,
  initial,
  onEnvoyer,
  onOuvrir,
  onFermer,
}: {
  moiId: string;
  roster: Present[];
  conv: Record<string, Conversation>;
  initial: string | null;
  onEnvoyer: (id: string, pseudo: string, t: string) => "ok" | "hors-ligne" | "trop-vite" | "vide";
  onOuvrir: (id: string | null) => void;
  onFermer: () => void;
}) {
  const [id, setId] = useState<string | null>(initial);
  const [texte, setTexte] = useState("");
  const [info, setInfo] = useState("");
  const fin = useRef<HTMLDivElement>(null);

  const contacts = new Map<string, { pseudo: string; enLigne: boolean; nonLus: number }>();
  for (const p of roster)
    if (p.id !== moiId)
      contacts.set(p.id, { pseudo: p.pseudo, enLigne: true, nonLus: conv[p.id]?.nonLus ?? 0 });
  for (const [k, c] of Object.entries(conv))
    if (!contacts.has(k)) contacts.set(k, { pseudo: c.pseudo, enLigne: false, nonLus: c.nonLus });
  const liste = [...contacts.entries()].sort(
    (a, b) => Number(b[1].enLigne) - Number(a[1].enLigne) || a[1].pseudo.localeCompare(b[1].pseudo),
  );
  const courant = id ? contacts.get(id) : undefined;
  const msgs = id ? (conv[id]?.msgs ?? []) : [];

  useEffect(() => {
    onOuvrir(id);
    return () => onOuvrir(null);
  }, [id, onOuvrir]);
  useEffect(() => {
    fin.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, id]);

  const envoyer = () => {
    if (!id || !courant) return;
    const r = onEnvoyer(id, courant.pseudo, texte);
    if (r === "ok") {
      setTexte("");
      setInfo("");
    } else if (r === "hors-ligne")
      setInfo("Cette personne n'est pas connectée : le message ne serait pas reçu.");
    else if (r === "trop-vite") setInfo("Doucement : un message par seconde.");
  };

  return (
    <Fenetre titre="✉ Messages privés" onFermer={onFermer} large>
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
        <ul className="max-h-72 space-y-1 overflow-auto">
          {liste.length === 0 && (
            <li className="text-muted-foreground">Personne d'autre n'est connecté.</li>
          )}
          {liste.map(([k, c]) => (
            <li key={k}>
              <button
                className={`pixel-btn flex w-full items-center justify-between !px-2 !py-1 text-left ${id === k ? "!bg-accent" : ""}`}
                onClick={() => {
                  setId(k);
                  setInfo("");
                }}
              >
                <span className="truncate">
                  {c.enLigne ? "🟢" : "⚪"} {c.pseudo}
                </span>
                {c.nonLus > 0 && (
                  <span className="rounded-full bg-destructive px-2 text-xs text-white">
                    {c.nonLus}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex min-h-[16rem] flex-col">
          {!id || !courant ? (
            <p className="m-auto text-muted-foreground">Choisis quelqu'un dans la liste.</p>
          ) : (
            <>
              <div className="mb-1 font-pixel text-[9px] text-accent">
                {courant.pseudo}
                {courant.enLigne ? "" : " · hors ligne"}
              </div>
              <div
                className="pixel-box mb-2 flex-1 space-y-1 overflow-auto p-2"
                style={{ maxHeight: "16rem" }}
              >
                {msgs.length === 0 && (
                  <p className="text-muted-foreground">Aucun message. Dis bonjour !</p>
                )}
                {msgs.map((m, i) => (
                  <div key={i} className={m.moi ? "text-right" : ""}>
                    <span
                      className={`inline-block max-w-[80%] rounded px-2 py-1 text-left ${m.moi ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                    >
                      {m.t}
                    </span>
                  </div>
                ))}
                <div ref={fin} />
              </div>
              <div className="flex gap-2">
                <input
                  className="pixel-input !w-auto min-w-0 flex-1"
                  maxLength={200}
                  placeholder="Ton message…"
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") envoyer();
                  }}
                />
                <button className="pixel-btn !px-3" onClick={envoyer}>
                  Envoyer
                </button>
              </div>
              {info && <p className="mt-1 text-sm text-destructive">{info}</p>}
            </>
          )}
        </div>
      </div>
      <button className="pixel-btn mt-3" onClick={onFermer}>
        Fermer
      </button>
    </Fenetre>
  );
}
