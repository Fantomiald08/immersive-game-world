import { useState } from "react";
import type { Question } from "@/game/quiz";

/** Quiz à choix multiples sur un cours : correction immédiate, score final, XP à la fin. */
export function QuizCours({
  questions,
  onFin,
  onFermer,
}: {
  questions: Question[];
  onFin: (score: number, total: number) => Promise<void>;
  onFermer: () => void;
}) {
  const [i, setI] = useState(0),
    [score, setScore] = useState(0),
    [choix, setChoix] = useState<number | null>(null),
    [fini, setFini] = useState(false);
  const q = questions[i]!;

  const repondre = (k: number) => {
    if (choix !== null) return;
    setChoix(k);
    if (k === q.bonne) setScore((s) => s + 1);
  };
  const suite = async () => {
    if (i + 1 < questions.length) {
      setI(i + 1);
      setChoix(null);
      return;
    }
    setFini(true);
    await onFin(score, questions.length);
  };

  if (fini) {
    return (
      <div className="space-y-3 text-center">
        <p className="font-pixel text-sm text-accent">
          {score} / {questions.length}
        </p>
        <p>
          {score === questions.length
            ? "Parfait ! Tu maîtrises ce cours."
            : score >= questions.length / 2
              ? "Bien joué, encore un effort !"
              : "Relis le cours et retente ta chance."}
        </p>
        <button className="pixel-btn" onClick={onFermer}>
          Terminer
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="font-pixel text-[9px] text-muted-foreground">
        Question {i + 1} / {questions.length} · Score {score}
      </div>
      <p className="text-xl">{q.enonce}</p>
      <div className="grid gap-2">
        {q.choix.map((c, k) => {
          const ok = choix !== null && k === q.bonne,
            ko = choix === k && k !== q.bonne;
          return (
            <button
              key={k}
              disabled={choix !== null}
              onClick={() => repondre(k)}
              className={`pixel-btn text-left !text-[10px] ${ok ? "!bg-primary" : ""} ${ko ? "!bg-destructive" : ""}`}
            >
              {ok ? "✔ " : ko ? "✘ " : "▸ "}
              {c}
            </button>
          );
        })}
      </div>
      {choix !== null && (
        <div className="space-y-2">
          <p>
            {choix === q.bonne
              ? "Bonne réponse !"
              : `Raté. La bonne réponse était « ${q.choix[q.bonne]} ».`}
          </p>
          <button className="pixel-btn" onClick={suite}>
            {i + 1 < questions.length ? "▶ Suivante" : "▶ Résultat"}
          </button>
        </div>
      )}
    </div>
  );
}
