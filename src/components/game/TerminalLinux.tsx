import { useEffect, useRef, useState } from "react";
import {
  espaceLibre,
  etatInitial,
  executer,
  invite,
  QUOTA_MOYEN,
  tailleTotale,
  type Etat,
} from "@/game/terminal";

type Ligne = { texte: string; erreur?: boolean; invite?: string };
const CLE = "isitech.terminal.v1";

function charger(): Etat {
  try {
    const b = localStorage.getItem(CLE);
    if (b) return JSON.parse(b) as Etat;
  } catch {
    /* on repart d'un système neuf */
  }
  return etatInitial();
}
const sauver = (e: Etat) => {
  try {
    localStorage.setItem(CLE, JSON.stringify(e));
  } catch {
    /* stockage indisponible : la session ne sera pas gardée */
  }
};

/** Un vrai petit terminal Linux (simulé) : le système de fichiers est limité à un espace moyen de stockage. */
export function TerminalLinux({ onFermer }: { onFermer: () => void }) {
  const [etat, setEtat] = useState<Etat>(() => charger());
  const [lignes, setLignes] = useState<Ligne[]>([
    { texte: "Bienvenue sur le PC Linux d'Isitech." },
    {
      texte: `Espace disque : ${(QUOTA_MOYEN / 1024).toFixed(0)} Ko (un espace moyen, à gérer comme un vrai disque).`,
    },
    { texte: 'Tape "help" pour la liste des commandes.' },
  ]);
  const [saisie, setSaisie] = useState("");
  const [historique, setHistorique] = useState<string[]>([]);
  const [pos, setPos] = useState(-1);
  const bas = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bas.current?.scrollIntoView({ block: "end" });
  }, [lignes]);
  useEffect(() => {
    champ.current?.focus();
  }, []);

  const lancer = () => {
    const ligne = saisie;
    if (!ligne.trim()) return;
    const r = executer(etat, ligne);
    const nouvelles: Ligne[] = [{ texte: ligne, invite: invite(etat) }];
    if (r.sortie === "\x1bclear") {
      setLignes([]);
    } else {
      if (r.sortie) nouvelles.push({ texte: r.sortie, erreur: r.erreur });
      setLignes((l) => [...l, ...nouvelles]);
    }
    setEtat(r.etat);
    sauver(r.etat);
    setHistorique((h) => [...h, ligne]);
    setPos(-1);
    setSaisie("");
  };

  const touche = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") lancer();
    else if (e.key === "ArrowUp") {
      if (historique.length === 0) return;
      const n = pos < 0 ? historique.length - 1 : Math.max(0, pos - 1);
      setPos(n);
      setSaisie(historique[n] ?? "");
    } else if (e.key === "ArrowDown") {
      if (pos < 0) return;
      const n = pos + 1;
      if (n >= historique.length) {
        setPos(-1);
        setSaisie("");
      } else {
        setPos(n);
        setSaisie(historique[n] ?? "");
      }
    }
  };

  const utilise = tailleTotale(etat.racine),
    libre = espaceLibre(etat);
  const pourcent = Math.min(100, Math.round((utilise / etat.quotaOctets) * 100));

  return (
    <div className="fixed inset-0 z-[2500] grid place-items-center bg-black/85 p-2 sm:p-6">
      <div className="flex h-full max-h-[88vh] w-full max-w-3xl flex-col rounded-lg border-4 border-[#2f9e5a] bg-[#0b150d] shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-[#2f9e5a] px-3 py-2 text-[#8fe3d0]">
          <span className="font-pixel text-xs">🐧 TERMINAL LINUX — Isitech</span>
          <button className="rounded bg-[#2f9e5a] px-3 py-1 text-sm text-black" onClick={onFermer}>
            ⏻ Fermer
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-[#1c3f23] px-3 py-1 text-xs text-[#6fae8a]">
          <span>
            Disque : {(utilise / 1024).toFixed(1)} Ko / {(etat.quotaOctets / 1024).toFixed(0)} Ko
          </span>
          <div className="h-2 flex-1 bg-[#132a17]">
            <div className="h-full bg-[#2f9e5a]" style={{ width: `${pourcent}%` }} />
          </div>
          <span>{(libre / 1024).toFixed(1)} Ko libres</span>
        </div>

        <div
          className="min-h-0 flex-1 overflow-auto p-3 font-mono text-sm text-[#b7f3c8]"
          onClick={() => champ.current?.focus()}
        >
          {lignes.map((l, i) =>
            l.invite ? (
              <div key={i}>
                <span className="text-[#4fd1c5]">{l.invite}</span> {l.texte}
              </div>
            ) : (
              <div key={i} className={`whitespace-pre-wrap ${l.erreur ? "text-[#ff8a7a]" : ""}`}>
                {l.texte}
              </div>
            ),
          )}
          <div className="flex items-center gap-1">
            <span className="text-[#4fd1c5]">{invite(etat)}</span>
            <input
              ref={champ}
              className="flex-1 bg-transparent outline-none"
              value={saisie}
              autoFocus
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={touche}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div ref={bas} />
        </div>
      </div>
    </div>
  );
}
