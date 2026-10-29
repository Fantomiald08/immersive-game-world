import { useCallback, useEffect, useRef, useState } from "react";
import { Monstre } from "./Monstre";
import { Personnage } from "./Personnage";
import {
  aideCinquante,
  aideSoin,
  aideTemps,
  brouiller,
  calculerXp,
  creerCombat,
  dureeQuestion,
  PV_JOUEUR,
  payerRancon,
  precision,
  repondre,
  reveler,
  suivante,
  type Difficulte,
  type Etat,
  type Question,
} from "@/game/combat";
import type { Profil } from "@/game/profil";
import { jouer } from "@/game/son";

/** L'arène : le combat au tour par tour. Les règles sont dans src/game/combat.ts, ici on ne fait que l'affichage et les animations. */
const FOND: Record<string, string> = {
  bug: "linear-gradient(#14301f, #1f5a3a 62%, #0e2a1a 62%)",
  virus: "linear-gradient(#10283a, #1f4e75 62%, #0a1e2e 62%)",
  malware: "linear-gradient(#25123a, #4a2a78 62%, #170a28 62%)",
  ransomware: "linear-gradient(#3a1212, #782a2a 62%, #280a0a 62%)",
};
const LETTRES = ["A", "B", "C", "D"];
type Flottant = { id: number; texte: string; cote: "monstre" | "joueur"; critique: boolean };

const Barre = ({
  valeur,
  max,
  couleur,
  etiquette,
}: {
  valeur: number;
  max: number;
  couleur: string;
  etiquette: string;
}) => (
  <div className="w-full">
    <div className="mb-0.5 flex justify-between font-pixel text-[8px] text-white">
      <span>{etiquette}</span>
      <span>
        {Math.max(0, Math.round(valeur))}/{max}
      </span>
    </div>
    <div className="h-3 border-2 border-black bg-black/60">
      <div
        className="h-full"
        style={{
          width: `${Math.max(0, (valeur / max) * 100)}%`,
          background: couleur,
          transition: "width 600ms ease-out",
        }}
      />
    </div>
  </div>
);

export function Arene({
  questions,
  difficulte,
  moi,
  titre,
  onTermine,
  onQuitter,
  onRejouer,
}: {
  questions: Question[];
  difficulte: Difficulte;
  moi: Profil;
  titre: string;
  onTermine: (e: Etat, xp: number) => void | Promise<void>;
  onQuitter: () => void;
  onRejouer: () => void;
}) {
  const [e, setE] = useState<Etat>(() => creerCombat(questions, difficulte));
  const [reste, setReste] = useState(() => dureeQuestion(e) * 1000);
  const [flottants, setFlottants] = useState<Flottant[]>([]);
  const [frappe, setFrappe] = useState<"monstre" | "joueur" | null>(null);
  const [message, setMessage] = useState("");
  const echeance = useRef(Date.now() + reste);
  const dejaTermine = useRef(false);
  const idF = useRef(0);
  const eRef = useRef(e);
  eRef.current = e;
  const resteRef = useRef(reste);
  resteRef.current = reste;

  const info = (t: string) => {
    setMessage(t);
    setTimeout(() => setMessage((m) => (m === t ? "" : m)), 2500);
  };

  const valider = useCallback((affichee: number | null) => {
    const cur = eRef.current;
    if (cur.phase !== "question") return;
    const n = repondre(cur, affichee, Math.max(0, echeance.current - Date.now()));
    if (n === cur) return;
    const r = n.resultat!;
    const nouveaux: Flottant[] = [];
    if (r.correct) {
      nouveaux.push({
        id: ++idF.current,
        texte: `-${r.degatsJoueur}${r.critique ? " CRITIQUE !" : ""}`,
        cote: "monstre",
        critique: r.critique,
      });
      setFrappe("monstre");
      jouer("coup");
    } else {
      nouveaux.push({
        id: ++idF.current,
        texte: `-${r.degatsRecus}`,
        cote: "joueur",
        critique: false,
      });
      setFrappe("joueur");
      jouer("rate");
    }
    setFlottants((f) => [...f, ...nouveaux]);
    setTimeout(() => setFrappe(null), 500);
    setTimeout(
      () => setFlottants((f) => f.filter((x) => !nouveaux.some((y) => y.id === x.id))),
      1200,
    );
    if (r.enrage)
      info("💢 Le monstre entre en colère : il frappe plus fort et tu as moins de temps !");
    if (r.replique) info("🦠 Le virus se réplique : cette question reviendra !");
    setE(n);
  }, []);

  // Chronomètre de la question
  useEffect(() => {
    if (e.phase !== "question") return;
    echeance.current = Date.now() + dureeQuestion(e) * 1000;
    setReste(dureeQuestion(e) * 1000);
    const t = setInterval(() => {
      const r = echeance.current - Date.now();
      setReste(Math.max(0, r));
      const cur = eRef.current;
      if (r <= 0) valider(null);
      else if (
        cur.regles.monstre === "bug" &&
        !cur.brouillee &&
        r <= (dureeQuestion(cur) * 1000) / 2
      ) {
        setE(brouiller(cur));
        info("🐛 Le Bug brouille l'ordre des réponses !");
      }
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.numero, e.phase === "question"]);

  // Malware : l'énoncé reste flou 3 secondes
  useEffect(() => {
    if (e.phase !== "question" || !e.obscurci) return;
    const n = e.numero;
    const t = setTimeout(() => setE((c) => (c.numero === n ? reveler(c) : c)), 3000);
    return () => clearTimeout(t);
  }, [e.numero, e.phase, e.obscurci]);

  // Fin du combat : on prévient la page une seule fois
  useEffect(() => {
    if (e.phase === "fini" && !dejaTermine.current) {
      dejaTermine.current = true;
      void onTermine(e, calculerXp(e));
      jouer(e.fin === "victoire" ? "niveau" : "rate");
    }
  }, [e, onTermine]);

  const suite = () => setE((c) => suivante(c));
  const aide = (f: (c: Etat) => Etat, texte?: string) => {
    const cur = eRef.current,
      n = f(cur);
    if (n === cur) return;
    if (n.bonusTemps > cur.bonusTemps) echeance.current += 10000;
    if (texte) info(texte);
    jouer("ok");
    setE(n);
  };

  // Clavier : 1-4 ou A-D pour répondre, Entrée / Espace pour continuer
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      const cible = (ev.target as HTMLElement | null)?.tagName;
      if (cible === "INPUT" || cible === "TEXTAREA" || cible === "SELECT") return;
      const k = ev.key.toLowerCase();
      const cur = eRef.current;
      const i =
        ["1", "2", "3", "4"].indexOf(k) >= 0
          ? ["1", "2", "3", "4"].indexOf(k)
          : ["a", "b", "c", "d"].indexOf(k);
      if (cur.phase === "question" && i >= 0) {
        ev.preventDefault();
        valider(i);
      } else if ((k === "enter" || k === " ") && cur.phase === "resultat") {
        ev.preventDefault();
        setE((c) => suivante(c));
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [valider]);

  const q = e.courante;
  const duree = dureeQuestion(e) * 1000;
  const part = Math.max(0, Math.min(1, reste / duree));
  const res = e.resultat;

  return (
    <div className="fixed inset-0 z-[2500] overflow-auto bg-black/85 p-2 sm:p-4">
      <style>{`
        @keyframes ar-respire{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-4px) scale(1.04)}}
        @keyframes ar-secousse{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
        @keyframes ar-eclair{0%,100%{filter:none}30%{filter:brightness(3) saturate(0)}}
        @keyframes ar-flotte{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-60px);opacity:0}}
        @keyframes ar-charge{0%,100%{transform:translateX(0)}40%{transform:translateX(70px)}}
        @keyframes ar-attaque{0%,100%{transform:translateX(0)}40%{transform:translateX(-80px)}}
      `}</style>
      <div className="mx-auto max-w-3xl space-y-2">
        <div className="flex items-center justify-between gap-2 text-white">
          <span className="font-pixel text-[10px]">
            ⚔ {titre} · {e.regles.nom}
          </span>
          <button className="pixel-btn !px-2 !py-1" onClick={onQuitter}>
            ✕ Abandonner
          </button>
        </div>

        {/* Arène */}
        <div
          className="relative h-64 overflow-hidden border-4 border-border"
          style={{
            background: FOND[e.regles.monstre],
            animation: frappe === "joueur" ? "ar-secousse 400ms" : undefined,
          }}
        >
          <div className="absolute left-3 right-3 top-2 grid grid-cols-2 gap-6">
            <Barre
              valeur={e.pvJoueur}
              max={PV_JOUEUR}
              couleur="#4ade80"
              etiquette={moi.pseudo.toUpperCase()}
            />
            <Barre
              valeur={e.pvMonstre}
              max={e.pvMonstreMax}
              couleur={e.enrage ? "#ff4d4d" : "#f2c14e"}
              etiquette={`${e.regles.monstre.toUpperCase()}${e.enrage ? " 💢" : ""}`}
            />
          </div>
          <div
            className="absolute bottom-6 left-8"
            style={{ animation: frappe === "monstre" ? "ar-charge 450ms" : undefined }}
          >
            <Personnage a={moi.apparence} dir="droite" marche={false} taille={120} />
          </div>
          <div
            className="absolute bottom-8 right-8"
            style={{
              animation:
                frappe === "joueur"
                  ? "ar-attaque 450ms"
                  : frappe === "monstre"
                    ? "ar-eclair 450ms"
                    : "ar-respire 2.4s ease-in-out infinite",
              opacity: e.pvMonstre <= 0 ? 0.25 : 1,
              transition: "opacity 600ms",
            }}
          >
            <Monstre type={e.regles.monstre} taille={150} />
          </div>
          {flottants.map((f) => (
            <span
              key={f.id}
              className="pointer-events-none absolute font-pixel"
              style={{
                [f.cote === "monstre" ? "right" : "left"]: f.cote === "monstre" ? 70 : 60,
                bottom: 150,
                color: f.critique ? "#ffd166" : f.cote === "monstre" ? "#fff" : "#ff6b6b",
                fontSize: f.critique ? 16 : 13,
                textShadow: "2px 2px 0 #000",
                animation: "ar-flotte 1.1s ease-out forwards",
              }}
            >
              {f.texte}
            </span>
          ))}
          {e.combo >= 2 && (
            <div
              className="absolute bottom-2 left-3 font-pixel text-[10px] text-[#ffd166]"
              style={{ textShadow: "1px 1px 0 #000" }}
            >
              🔥 ENCHAÎNEMENT ×{e.combo}
            </div>
          )}
          {message && (
            <div className="absolute inset-x-6 top-10 border-2 border-white/70 bg-black/75 px-2 py-1 text-center text-sm text-white">
              {message}
            </div>
          )}
        </div>

        {e.phase !== "fini" && q && (
          <div className="pixel-box space-y-2 p-3">
            <div className="flex items-center justify-between font-pixel text-[8px] text-muted-foreground">
              <span>
                QUESTION {Math.min(e.numero, e.total + e.repliques)} · {e.file.length} à venir
              </span>
              <span>{e.phase === "question" ? `${Math.ceil(reste / 1000)} s` : ""}</span>
            </div>
            <div className="h-2 border border-border bg-muted">
              <div
                className="h-full"
                style={{
                  width: `${part * 100}%`,
                  background: part > 0.5 ? "#4ade80" : part > 0.25 ? "#f2c14e" : "#ff4d4d",
                  transition: "width 100ms linear",
                }}
              />
            </div>

            <p
              className="text-xl leading-snug"
              style={{ filter: e.obscurci ? "blur(7px)" : undefined, transition: "filter 400ms" }}
            >
              {q.q}
            </p>
            {e.obscurci && (
              <p className="text-sm text-accent">
                👾 Le Malware brouille ta vue… patiente un instant.
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {q.ordre.map((orig, i) => {
                const retiree = e.retirees.includes(orig),
                  verrouillee = e.verrou === orig;
                const apres = e.phase === "resultat" && res;
                const bonne = apres && i === res.bonneAffichee,
                  mauvais = apres && res.affichee === i && !res.correct;
                return (
                  <button
                    key={i}
                    disabled={e.phase !== "question" || retiree || verrouillee}
                    className={`pixel-btn flex items-center gap-2 text-left !text-[11px] ${bonne ? "!bg-primary" : ""} ${mauvais ? "!bg-destructive" : ""} ${retiree || (apres && !bonne && !mauvais) ? "opacity-40" : ""}`}
                    onClick={() => valider(i)}
                  >
                    <span className="font-pixel text-[9px] text-accent">{LETTRES[i]}</span>
                    <span className="flex-1">
                      {bonne ? "✔ " : mauvais ? "✘ " : ""}
                      {retiree ? "—" : verrouillee ? "🔒 Réponse chiffrée" : q.choix[orig]}
                    </span>
                  </button>
                );
              })}
            </div>

            {e.phase === "question" && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  className="pixel-btn !px-2 !py-1 !text-[9px]"
                  disabled={e.aides.cinquante < 1 || e.retirees.length > 0}
                  onClick={() => aide((c) => aideCinquante(c))}
                >
                  🪄 50/50 ({e.aides.cinquante})
                </button>
                <button
                  className="pixel-btn !px-2 !py-1 !text-[9px]"
                  disabled={e.aides.temps < 1}
                  onClick={() => aide(aideTemps, "⏱ +10 secondes")}
                >
                  ⏱ +10 s ({e.aides.temps})
                </button>
                <button
                  className="pixel-btn !px-2 !py-1 !text-[9px]"
                  disabled={e.aides.soin < 1 || e.pvJoueur >= PV_JOUEUR}
                  onClick={() => aide(aideSoin, "💊 +25 PV")}
                >
                  💊 Antivirus ({e.aides.soin})
                </button>
                {e.verrou !== null && (
                  <button
                    className="pixel-btn !px-2 !py-1 !text-[9px] !bg-destructive"
                    onClick={() => aide(payerRancon, "💸 Rançon payée : −8 PV")}
                  >
                    💸 Payer la rançon (−8 PV)
                  </button>
                )}
                <span className="ml-auto text-xs text-muted-foreground">Touches 1-4 ou A-D</span>
              </div>
            )}

            {e.phase === "resultat" && res && (
              <div className="space-y-2">
                <p className={`text-lg ${res.correct ? "text-primary" : "text-destructive"}`}>
                  {res.correct
                    ? `✔ Bonne réponse ! −${res.degatsJoueur} PV pour le monstre${res.critique ? " (coup critique, tu as répondu vite !)" : ""}.`
                    : `${res.delai ? "⏰ Temps écoulé" : "✘ Raté"} ! Tu perds ${res.degatsRecus} PV. Bonne réponse : « ${q.choix[q.bonne]} ».`}
                </p>
                {q.explication && (
                  <p className="text-base text-muted-foreground">💡 {q.explication}</p>
                )}
                <button className="pixel-btn" onClick={suite}>
                  {e.fin ? "Voir le résultat ▶" : "Question suivante ▶"}
                </button>
              </div>
            )}
          </div>
        )}

        {e.phase === "fini" && (
          <Fin e={e} titre={titre} onRejouer={onRejouer} onQuitter={onQuitter} />
        )}
      </div>
    </div>
  );
}

function Fin({
  e,
  titre,
  onRejouer,
  onQuitter,
}: {
  e: Etat;
  titre: string;
  onRejouer: () => void;
  onQuitter: () => void;
}) {
  const gagne = e.fin === "victoire";
  const xp = calculerXp(e);
  const moyenne =
    e.bonnes + e.mauvaises ? Math.round(e.tempsMs / (e.bonnes + e.mauvaises) / 100) / 10 : 0;
  return (
    <div className="pixel-box space-y-3 p-4">
      <h2 className={`font-pixel text-lg ${gagne ? "text-primary" : "text-destructive"}`}>
        {gagne ? "🏆 VICTOIRE !" : e.fin === "epuise" ? "⌛ Le monstre s'enfuit…" : "💀 DÉFAITE"}
      </h2>
      <p className="text-lg">
        {gagne
          ? `Tu as vaincu ${e.regles.titre.toLowerCase()} sur « ${titre} ».`
          : e.fin === "epuise"
            ? "Tu n'as plus de questions et le monstre est encore debout. Révise et reviens !"
            : "Tu n'as plus de points de vie. Relis le cours et retente ta chance."}
      </p>
      <ul className="grid grid-cols-2 gap-2 text-lg sm:grid-cols-4">
        <li className="pixel-box p-2">
          ✅ {e.bonnes}/{e.bonnes + e.mauvaises}
          <div className="text-sm text-muted-foreground">
            {Math.round(precision(e) * 100)} % de réussite
          </div>
        </li>
        <li className="pixel-box p-2">
          🔥 ×{e.meilleurCombo}
          <div className="text-sm text-muted-foreground">meilleur enchaînement</div>
        </li>
        <li className="pixel-box p-2">
          ⚡ {e.critiques}
          <div className="text-sm text-muted-foreground">coups critiques</div>
        </li>
        <li className="pixel-box p-2">
          ⏱ {moyenne} s<div className="text-sm text-muted-foreground">par question</div>
        </li>
      </ul>
      <p className="font-pixel text-[11px] text-accent">+{xp} XP</p>
      {e.erreurs.length > 0 && (
        <div>
          <h3 className="mb-1 font-pixel text-[9px] text-accent">À RÉVISER ({e.erreurs.length})</h3>
          <ul className="space-y-2">
            {e.erreurs.map((er, i) => (
              <li key={i} className="border-l-4 border-destructive pl-2">
                <div className="font-bold">{er.q}</div>
                <div className="text-sm text-destructive">
                  Ta réponse : {er.choisie ?? "temps écoulé"}
                </div>
                <div className="text-sm text-primary">Bonne réponse : {er.bonne}</div>
                {er.explication && (
                  <div className="text-sm text-muted-foreground">💡 {er.explication}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="pixel-btn" onClick={onRejouer}>
          ↻ Rejouer
        </button>
        <button className="pixel-btn" onClick={onQuitter}>
          Retour au réseau combat
        </button>
      </div>
    </div>
  );
}
