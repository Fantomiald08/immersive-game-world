import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  nettoyerQuestions,
  type QuestionQuiz,
} from "../../../supabase/functions/generer-quiz/handler";
import { creerQuiz, supprimerQuiz, type QuizReseau } from "@/game/reseau";
import type { CoursVue } from "@/game/reseauVue";
import { genererQuizIA } from "@/game/quizIA";
import type { Profil } from "@/game/profil";

const vide = (): QuestionQuiz => ({
  q: "",
  choix: ["", "", "", ""],
  bonne: 0,
  explication: "",
  difficulte: 2,
});

/** Écrire un quiz à la main, ou le faire générer par l'IA puis le relire et le corriger avant de l'enregistrer. */
export function EditeurQuiz({
  cours,
  moi,
  existant,
  onFermer,
}: {
  cours: CoursVue;
  moi: Profil;
  existant?: QuizReseau;
  onFermer: () => void;
}) {
  const qc = useQueryClient();
  const [questions, setQuestions] = useState<QuestionQuiz[]>(
    existant ? existant.questions : [vide()],
  );
  const [source, setSource] = useState<"ia" | "manuel">(existant?.source ?? "manuel");
  const [nombre, setNombre] = useState(8);
  const [niveau, setNiveau] = useState<"facile" | "normal" | "difficile" | "mixte">("mixte");
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState(""),
    [info, setInfo] = useState(""),
    [envoi, setEnvoi] = useState(false);

  const maj = (i: number, f: (q: QuestionQuiz) => QuestionQuiz) =>
    setQuestions((qs) => qs.map((q, k) => (k === i ? f(q) : q)));
  const texte = cours.contenu || cours.description;

  const generer = async () => {
    setErreur("");
    setInfo("");
    setAttente(true);
    const r = await genererQuizIA({
      coursId: cours.id,
      titre: cours.titre,
      categorie: cours.categorieNom,
      contenu: texte,
      nombre,
      difficulte: niveau,
    });
    setAttente(false);
    if (!r.ok) {
      setErreur(r.message);
      return;
    }
    const garde = questions.filter((q) => q.q.trim());
    setQuestions([...garde, ...r.questions]);
    setSource(garde.length ? source : "ia");
    setInfo(
      `${r.questions.length} questions générées. Relis-les : l'IA peut se tromper ! Corrige ou supprime ce qui est faux, puis enregistre.`,
    );
  };

  const probleme = (q: QuestionQuiz, i: number): string => {
    if (q.q.trim().length < 8) return `Question ${i + 1} : l'énoncé est trop court.`;
    if (q.choix.some((c) => !c.trim())) return `Question ${i + 1} : remplis les 4 réponses.`;
    if (new Set(q.choix.map((c) => c.trim().toLowerCase())).size !== 4)
      return `Question ${i + 1} : les 4 réponses doivent être différentes.`;
    return "";
  };

  const enregistrer = async () => {
    const p = questions.map(probleme).find(Boolean);
    if (p) {
      setErreur(p);
      return;
    }
    const propres = nettoyerQuestions(questions, 30);
    if (propres.length < 3) {
      setErreur("Il faut au moins 3 questions valides.");
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      await creerQuiz(moi.id, cours.id, propres, source);
      if (existant && existant.auteurId === moi.id) await supprimerQuiz(existant.id);
      await qc.invalidateQueries({ queryKey: ["reseau"] });
      onFermer();
    } catch {
      setErreur("Enregistrement impossible. Réessaie.");
      setEnvoi(false);
    }
  };

  const champ = "w-full rounded border-2 border-[#9fc2e8] bg-white px-2 py-1 text-[#10243f]";
  return (
    <div className="fixed inset-0 z-[2600] overflow-auto bg-black/80 p-2 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-3 rounded-lg border-4 border-[#2b4b9a] bg-[#eef4fb] p-4 text-[#10243f]">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {existant ? "Modifier le quiz" : "Nouveau quiz"} · {cours.titre}
          </h2>
          <button className="rounded border-2 border-[#2b4b9a] px-3 py-1" onClick={onFermer}>
            ✕ Fermer
          </button>
        </div>

        <div className="space-y-2 rounded border-2 border-dashed border-[#e07a2b] bg-white p-3">
          <div className="font-bold">✨ Générer avec l'IA</div>
          <p className="text-sm">
            L'IA écrit des questions à partir du texte du cours.{" "}
            {texte.length < 80 && (
              <b className="text-red-700">
                Ce cours n'a pas assez de texte : ouvre-le et colle son contenu d'abord.
              </b>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label>
              Questions{" "}
              <select
                className={`${champ} !w-auto`}
                value={nombre}
                onChange={(e) => setNombre(Number(e.target.value))}
              >
                {[5, 8, 10, 12, 15].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Niveau{" "}
              <select
                className={`${champ} !w-auto`}
                value={niveau}
                onChange={(e) => setNiveau(e.target.value as typeof niveau)}
              >
                <option value="mixte">Varié</option>
                <option value="facile">Facile</option>
                <option value="normal">Moyen</option>
                <option value="difficile">Difficile</option>
              </select>
            </label>
            <button
              className="rounded bg-[#e07a2b] px-3 py-2 text-white disabled:opacity-50"
              disabled={attente || texte.length < 80}
              onClick={generer}
            >
              {attente ? "L'IA écrit… (10-20 s)" : "✨ Générer"}
            </button>
          </div>
        </div>
        {info && <p className="rounded bg-[#fff3d6] p-2">{info}</p>}

        <ol className="space-y-3">
          {questions.map((q, i) => (
            <li key={i} className="space-y-2 rounded border-2 border-[#9fc2e8] bg-white p-3">
              <div className="flex items-start gap-2">
                <span className="font-bold">{i + 1}.</span>
                <textarea
                  className={champ}
                  rows={2}
                  placeholder="Énoncé de la question"
                  value={q.q}
                  onChange={(e) => maj(i, (x) => ({ ...x, q: e.target.value }))}
                />
                <button
                  className="text-red-700"
                  title="Supprimer la question"
                  onClick={() => setQuestions((qs) => qs.filter((_, k) => k !== i))}
                >
                  🗑
                </button>
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                {q.choix.map((c, k) => (
                  <label key={k} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`bonne-${i}`}
                      checked={q.bonne === k}
                      onChange={() => maj(i, (x) => ({ ...x, bonne: k as QuestionQuiz["bonne"] }))}
                      title="Bonne réponse"
                    />
                    <input
                      className={`${champ} ${q.bonne === k ? "!border-green-600 !bg-green-50" : ""}`}
                      placeholder={`Réponse ${"ABCD"[k]}`}
                      value={c}
                      onChange={(e) =>
                        maj(i, (x) => ({
                          ...x,
                          choix: x.choix.map((y, z) =>
                            z === k ? e.target.value : y,
                          ) as QuestionQuiz["choix"],
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  className={`${champ} flex-1`}
                  placeholder="Explication (affichée après la réponse)"
                  value={q.explication}
                  onChange={(e) => maj(i, (x) => ({ ...x, explication: e.target.value }))}
                />
                <select
                  className={`${champ} !w-auto`}
                  value={q.difficulte}
                  onChange={(e) =>
                    maj(i, (x) => ({
                      ...x,
                      difficulte: Number(e.target.value) as QuestionQuiz["difficulte"],
                    }))
                  }
                >
                  <option value={1}>Facile</option>
                  <option value={2}>Moyenne</option>
                  <option value={3}>Difficile</option>
                </select>
              </div>
            </li>
          ))}
        </ol>
        <button
          className="rounded border-2 border-[#2b4b9a] px-3 py-1"
          onClick={() => setQuestions((qs) => [...qs, vide()])}
        >
          ＋ Ajouter une question
        </button>

        {erreur && <p className="rounded bg-red-100 p-2 text-red-800">{erreur}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded bg-[#2b4b9a] px-4 py-2 text-white disabled:opacity-50"
            disabled={envoi}
            onClick={enregistrer}
          >
            {envoi ? "Enregistrement…" : "💾 Enregistrer le quiz"}
          </button>
          <span className="text-sm text-[#47628a]">
            {source === "ia" ? "Généré par l'IA, relu par toi." : "Écrit à la main."} Un quiz
            d'élève doit être validé par un admin avant d'apparaître dans les combats.
          </span>
        </div>
      </div>
    </div>
  );
}
