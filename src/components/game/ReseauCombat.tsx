import { useMemo, useState } from "react";
import { Arene } from "./Arene";
import { Monstre } from "./Monstre";
import {
  choisirQuestions,
  graine,
  REGLES,
  type Difficulte,
  type Etat,
  type Question,
} from "@/game/combat";
import type { Profil } from "@/game/profil";
import { BANQUE } from "@/game/quiz";
import { useReseau } from "@/game/reseau";
import { construireVue } from "@/game/reseauVue";

type Mode = "categorie" | "cours" | "melange" | "defi" | "libre";
const MODES: Array<[Mode, string, string]> = [
  ["categorie", "🗂 Par catégorie", "Tous les quiz validés d'une catégorie"],
  ["cours", "📄 Par cours", "Le quiz d'un cours précis"],
  ["melange", "🎲 Mélange", "Des questions de tous les cours"],
  ["defi", "⭐ Défi du jour", "Les mêmes 10 questions pour toute l'école, bonus d'XP"],
  ["libre", "🧪 Entraînement libre", "Questions générales SISR (non liées à un cours)"],
];

/** Les questions générales de l'ancienne banque, au format des quiz. */
const generales = (): Question[] =>
  BANQUE.map((b) => ({
    q: b.enonce,
    choix: b.choix as Question["choix"],
    bonne: b.bonne as Question["bonne"],
    explication: "",
    difficulte: 2,
  }));

const dateDuJour = () => new Date().toLocaleDateString("sv-SE");
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Écran du PC gaming : connexion, puis choix du combat (quiz, nombre de questions, difficulté). */
export function ReseauCombat({
  moi,
  defiFait,
  onFermer,
  onTermine,
}: {
  moi: Profil;
  defiFait: boolean;
  onFermer: () => void;
  onTermine: (e: Etat, xp: number, defi: boolean) => void | Promise<void>;
}) {
  const [connecte, setConnecte] = useState(false);
  const { data, isLoading, isError, refetch } = useReseau();
  const vue = useMemo(() => (data ? construireVue(data) : null), [data]);
  const [mode, setMode] = useState<Mode>("melange");
  const [cleCat, setCleCat] = useState("");
  const [coursId, setCoursId] = useState("");
  const [n, setN] = useState(8);
  const [diff, setDiff] = useState<Difficulte>("normal");
  const [combat, setCombat] = useState<{
    questions: Question[];
    titre: string;
    defi: boolean;
    diff: Difficulte;
  } | null>(null);
  const [relance, setRelance] = useState(0);

  const jouables = useMemo(() => vue?.quizJouables ?? [], [vue]);
  const categoriesAvecQuiz = (vue?.categories ?? []).filter((c) =>
    jouables.some((j) => j.cours.cle === c.cle),
  );
  const coursAvecQuiz = [...new Map(jouables.map((j) => [j.cours.id, j.cours])).values()];

  const pool = useMemo((): Question[] => {
    if (mode === "libre") return generales();
    const sel =
      mode === "categorie"
        ? jouables.filter((j) => j.cours.cle === cleCat)
        : mode === "cours"
          ? jouables.filter((j) => j.cours.id === coursId)
          : jouables;
    return sel.flatMap((j) => j.quiz.questions);
  }, [mode, jouables, cleCat, coursId]);

  const unique = new Set(pool.map((q) => q.q.toLowerCase())).size;
  const nbReel = mode === "defi" ? Math.min(10, unique) : Math.min(n, unique);
  const titre =
    mode === "categorie"
      ? (vue?.categories.find((c) => c.cle === cleCat)?.nom ?? "Catégorie")
      : mode === "cours"
        ? (coursAvecQuiz.find((c) => c.id === coursId)?.titre ?? "Cours")
        : mode === "defi"
          ? "Défi du jour"
          : mode === "libre"
            ? "Entraînement libre"
            : "Mélange";
  const peutLancer =
    unique >= 3 &&
    (mode !== "categorie" || !!cleCat) &&
    (mode !== "cours" || !!coursId) &&
    !(mode === "defi" && defiFait);

  const lancer = () => {
    const d: Difficulte = mode === "defi" ? "normal" : diff;
    const rnd = mode === "defi" ? graine(hash(dateDuJour())) : Math.random;
    setCombat({
      questions: choisirQuestions(pool, nbReel, d, rnd),
      titre,
      defi: mode === "defi",
      diff: d,
    });
    setRelance((r) => r + 1);
  };

  if (combat) {
    return (
      <Arene
        key={relance}
        questions={combat.questions}
        difficulte={combat.diff}
        moi={moi}
        titre={combat.titre}
        onTermine={(e, xp) => onTermine(e, xp, combat.defi)}
        onQuitter={() => setCombat(null)}
        onRejouer={() => {
          const rnd = combat.defi ? graine(hash(dateDuJour())) : Math.random;
          setCombat({ ...combat, questions: choisirQuestions(pool, nbReel, combat.diff, rnd) });
          setRelance((r) => r + 1);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[2500] grid place-items-center bg-black/85 p-2 sm:p-6">
      <div className="flex h-full max-h-[92vh] w-full max-w-4xl flex-col rounded-lg border-[10px] border-[#2b2250] bg-[#120d2b] shadow-[0_0_40px_#7c3aed88]">
        {!connecte ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#2a1566] to-[#0b0720] p-6 text-center text-white">
            <div className="font-pixel text-2xl text-[#c4a3ff]">⚔ RÉSEAU COMBAT</div>
            <div className="text-lg text-[#b9a8ee]">Poste de jeu · Isitech Arena</div>
            <div className="rounded border-2 border-[#7c3aed] bg-black/40 px-6 py-3 text-lg">
              Joueur : <b>{moi.pseudo}</b>
            </div>
            <button
              className="pixel-btn !bg-[#7c3aed] !text-white"
              onClick={() => setConnecte(true)}
            >
              ▶ Entrer sur le réseau combat
            </button>
            <button className="text-sm text-[#b9a8ee] underline" onClick={onFermer}>
              Éteindre l'écran
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col text-white">
            <div className="flex items-center justify-between bg-[#2b2250] px-3 py-2">
              <span className="font-pixel text-xs text-[#c4a3ff]">⚔ RÉSEAU COMBAT</span>
              <button className="rounded bg-[#7c3aed] px-3 py-1 text-sm" onClick={onFermer}>
                ⏻ Quitter
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
              {isLoading && <p>Chargement des quiz…</p>}
              {isError && (
                <p>
                  Réseau injoignable.{" "}
                  <button className="underline" onClick={() => refetch()}>
                    Réessayer
                  </button>
                </p>
              )}

              <section>
                <h3 className="mb-2 font-pixel text-[9px] text-[#c4a3ff]">1 · CHOISIS TON QUIZ</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {MODES.map(([k, nom, desc]) => (
                    <button
                      key={k}
                      className={`rounded border-2 p-2 text-left ${mode === k ? "border-[#c4a3ff] bg-[#3b2a85]" : "border-[#3b2a85] bg-[#1a1240] hover:border-[#7c3aed]"}`}
                      onClick={() => setMode(k)}
                    >
                      <div className="font-bold">
                        {nom}
                        {k === "defi" && defiFait ? " ✔" : ""}
                      </div>
                      <div className="text-sm text-[#b9a8ee]">{desc}</div>
                    </button>
                  ))}
                </div>
                {mode === "categorie" && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categoriesAvecQuiz.length === 0 && (
                      <p className="text-[#ffb3a8]">Aucune catégorie n'a encore de quiz validé.</p>
                    )}
                    {categoriesAvecQuiz.map((c) => (
                      <button
                        key={c.cle}
                        className={`rounded border-2 px-3 py-1 ${cleCat === c.cle ? "border-[#c4a3ff] bg-[#3b2a85]" : "border-[#3b2a85]"}`}
                        onClick={() => setCleCat(c.cle)}
                      >
                        {c.nom}
                      </button>
                    ))}
                  </div>
                )}
                {mode === "cours" && (
                  <div className="mt-2">
                    {coursAvecQuiz.length === 0 && (
                      <p className="text-[#ffb3a8]">Aucun cours n'a encore de quiz validé.</p>
                    )}
                    <select
                      className="w-full rounded border-2 border-[#3b2a85] bg-[#1a1240] p-2"
                      value={coursId}
                      onChange={(e) => setCoursId(e.target.value)}
                    >
                      <option value="">— Choisis un cours —</option>
                      {coursAvecQuiz.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.titre} ({c.categorieNom})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <p className="mt-2 text-sm text-[#b9a8ee]">
                  {mode === "libre"
                    ? `${unique} questions générales disponibles.`
                    : mode === "defi" && defiFait
                      ? "Tu as déjà fait le défi aujourd'hui. Reviens demain !"
                      : `${unique} question${unique > 1 ? "s" : ""} validée${unique > 1 ? "s" : ""} disponible${unique > 1 ? "s" : ""}.`}
                  {unique < 3 &&
                    mode !== "libre" &&
                    " Il en faut au moins 3 : demande à un admin de valider des quiz (ou crée-les depuis le réseau cours)."}
                </p>
              </section>

              {mode !== "defi" && (
                <section>
                  <h3 className="mb-2 font-pixel text-[9px] text-[#c4a3ff]">
                    2 · NOMBRE DE QUESTIONS
                  </h3>
                  <div className="flex gap-2">
                    {[5, 8, 12].map((v) => (
                      <button
                        key={v}
                        className={`rounded border-2 px-4 py-1 ${n === v ? "border-[#c4a3ff] bg-[#3b2a85]" : "border-[#3b2a85]"}`}
                        onClick={() => setN(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {mode !== "defi" && (
                <section>
                  <h3 className="mb-2 font-pixel text-[9px] text-[#c4a3ff]">3 · DIFFICULTÉ</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {(Object.keys(REGLES) as Difficulte[]).map((d) => (
                      <button
                        key={d}
                        className={`flex items-center gap-2 rounded border-2 p-2 text-left ${diff === d ? "border-[#c4a3ff] bg-[#3b2a85]" : "border-[#3b2a85] bg-[#1a1240] hover:border-[#7c3aed]"}`}
                        onClick={() => setDiff(d)}
                      >
                        <Monstre type={REGLES[d].monstre} taille={44} />
                        <span>
                          <b>{REGLES[d].nom}</b>
                          <span className="block text-xs text-[#b9a8ee]">
                            {REGLES[d].temps} s · jusqu'à {REGLES[d].xp} XP
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-[#b9a8ee]">
                    {REGLES[diff].titre}. {diff === "facile" && "Pas de colère, temps large."}
                    {diff === "normal" && "Le virus se réplique si tu te trompes."}
                    {diff === "difficile" &&
                      "L'énoncé est flou au début, et le monstre se met en colère."}
                    {diff === "cauchemar" &&
                      "Il chiffre des réponses (rançon), se met en colère, et le chrono est très court."}
                  </p>
                </section>
              )}

              <button
                className="pixel-btn !bg-[#7c3aed] !text-white disabled:opacity-40"
                disabled={!peutLancer || isLoading}
                onClick={lancer}
              >
                ⚔ Lancer le combat ({nbReel} questions)
              </button>
              <p className="text-sm text-[#b9a8ee]">
                Pendant le combat : touches 1-4 ou A-D, 3 aides par combat (50/50, +10 s,
                antivirus). Les XP dépendent de la difficulté, de ta précision et de tes
                enchaînements.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
