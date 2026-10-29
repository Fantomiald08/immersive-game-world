import { useState } from "react";
import { ADMIN_IDS, modeProvisoire } from "@/game/admins";
import {
  ajouterCategorie,
  CLE_AUTRE,
  deplacerCategorie,
  masquerCours,
  renommerCategorie,
  supprimerCategorie,
  validerQuiz,
  type Organisation,
} from "@/game/organisation";
import type { Profil } from "@/game/profil";
import { testerIA } from "@/game/quizIA";
import { formaterDate } from "@/game/reseau";
import type { Vue } from "@/game/reseauVue";

type Onglet = "categories" | "quiz" | "masques" | "ia";

/** Panneau des admins : catégories (ajouter, renommer, déplacer, supprimer), validation des quiz, cours masqués, test de l'IA. */
export function GestionReseau({
  moi,
  vue,
  modifier,
  message,
}: {
  moi: Profil;
  vue: Vue;
  modifier: (f: (o: Organisation) => Organisation) => Promise<void>;
  message: string;
}) {
  const [onglet, setOnglet] = useState<Onglet>("categories");
  const [nouveau, setNouveau] = useState("");
  const [edition, setEdition] = useState<{ cle: string; nom: string } | null>(null);
  const [suppression, setSuppression] = useState<{ cle: string; vers: string } | null>(null);
  const [test, setTest] = useState<string>("");
  const [ouvert, setOuvert] = useState<string | null>(null);

  const nb = (cle: string) => vue.cours.filter((c) => c.cle === cle).length;
  const champ = "rounded border-2 border-[#9fc2e8] bg-white px-2 py-1";
  const bouton =
    "rounded border-2 border-[#2b4b9a] px-2 py-1 hover:bg-[#dbe8fa] disabled:opacity-40";
  const validesParAdmin = vue.quizJouables.filter((j) =>
    vue.organisation.quizValides.includes(j.quiz.id),
  );

  const tester = async () => {
    setTest("Test en cours…");
    const r = await testerIA();
    setTest(r.ok ? `✅ L'IA fonctionne. Exemple : « ${r.questions[0]?.q} »` : `❌ ${r.message}`);
  };
  const onglets: Array<[Onglet, string]> = [
    ["categories", "🗂 Catégories"],
    ["quiz", `✅ Quiz (${vue.quizAValider.length} à valider)`],
    ["masques", `🙈 Cours masqués (${vue.masques.length})`],
    ["ia", "✨ IA"],
  ];

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">🛠 Gérer le réseau</h2>
      {modeProvisoire() && (
        <div className="rounded border-2 border-[#e07a2b] bg-[#fff3d6] p-3 text-sm">
          <b>Mode provisoire.</b> Les admins sont reconnus par leur pseudo, ce qui n'est pas sûr :
          un élève pourrait prendre le même. Pour sécuriser, ouvre <code>src/game/admins.ts</code>{" "}
          et ajoute les identifiants dans <code>ADMIN_IDS</code>.
          <div className="mt-1">
            Ton identifiant : <code className="select-all rounded bg-white px-1">{moi.id}</code>
          </div>
        </div>
      )}
      {!modeProvisoire() && !ADMIN_IDS.includes(moi.id) && <p>Tu n'es pas admin.</p>}
      <div className="flex flex-wrap gap-2">
        {onglets.map(([k, n]) => (
          <button
            key={k}
            className={`${bouton} ${onglet === k ? "!bg-[#2b4b9a] text-white" : ""}`}
            onClick={() => setOnglet(k)}
          >
            {n}
          </button>
        ))}
      </div>
      {message && <p className="rounded bg-red-100 p-2 text-red-800">{message}</p>}

      {onglet === "categories" && (
        <div className="space-y-2">
          <ul className="space-y-1">
            {vue.categories.map((c, i) => (
              <li
                key={c.cle}
                className="flex flex-wrap items-center gap-2 rounded border-2 border-[#9fc2e8] bg-white p-2"
              >
                {edition?.cle === c.cle ? (
                  <>
                    <input
                      className={`${champ} flex-1`}
                      autoFocus
                      maxLength={40}
                      value={edition.nom}
                      onChange={(e) => setEdition({ cle: c.cle, nom: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void modifier((o) => renommerCategorie(o, c.cle, edition.nom));
                          setEdition(null);
                        }
                      }}
                    />
                    <button
                      className={bouton}
                      onClick={() => {
                        void modifier((o) => renommerCategorie(o, c.cle, edition.nom));
                        setEdition(null);
                      }}
                    >
                      OK
                    </button>
                    <button className={bouton} onClick={() => setEdition(null)}>
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-bold">
                      {c.nom}{" "}
                      <span className="font-normal text-[#47628a]">· {nb(c.cle)} cours</span>
                    </span>
                    {c.cle !== CLE_AUTRE ? (
                      <>
                        <button
                          className={bouton}
                          disabled={i === 0}
                          title="Monter"
                          onClick={() => void modifier((o) => deplacerCategorie(o, c.cle, -1))}
                        >
                          ↑
                        </button>
                        <button
                          className={bouton}
                          disabled={i >= vue.categories.length - 2}
                          title="Descendre"
                          onClick={() => void modifier((o) => deplacerCategorie(o, c.cle, 1))}
                        >
                          ↓
                        </button>
                        <button
                          className={bouton}
                          title="Renommer"
                          onClick={() => setEdition({ cle: c.cle, nom: c.nom })}
                        >
                          ✎ Renommer
                        </button>
                        <button
                          className={`${bouton} !border-red-700 text-red-700`}
                          title="Supprimer"
                          onClick={() => setSuppression({ cle: c.cle, vers: CLE_AUTRE })}
                        >
                          🗑
                        </button>
                      </>
                    ) : (
                      <span className="text-sm text-[#47628a]">(catégorie de secours)</span>
                    )}
                  </>
                )}
                {suppression?.cle === c.cle && (
                  <div className="flex w-full flex-wrap items-center gap-2 rounded bg-[#fde8e4] p-2">
                    <span>
                      Supprimer « {c.nom} » ? Ses {nb(c.cle)} cours iront dans :
                    </span>
                    <select
                      className={champ}
                      value={suppression.vers}
                      onChange={(e) => setSuppression({ cle: c.cle, vers: e.target.value })}
                    >
                      {vue.categories
                        .filter((x) => x.cle !== c.cle)
                        .map((x) => (
                          <option key={x.cle} value={x.cle}>
                            {x.nom}
                          </option>
                        ))}
                    </select>
                    <button
                      className={`${bouton} !bg-red-700 text-white`}
                      onClick={() => {
                        void modifier((o) => supprimerCategorie(o, c.cle, suppression.vers));
                        setSuppression(null);
                      }}
                    >
                      Confirmer
                    </button>
                    <button className={bouton} onClick={() => setSuppression(null)}>
                      Annuler
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              className={`${champ} flex-1`}
              maxLength={40}
              placeholder="Nouvelle catégorie"
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nouveau.trim()) {
                  void modifier((o) => ajouterCategorie(o, nouveau));
                  setNouveau("");
                }
              }}
            />
            <button
              className={bouton}
              onClick={() => {
                if (nouveau.trim()) {
                  void modifier((o) => ajouterCategorie(o, nouveau));
                  setNouveau("");
                }
              }}
            >
              ＋ Ajouter
            </button>
          </div>
          <p className="text-sm text-[#47628a]">
            Pour déplacer un cours dans une autre catégorie, ouvre-le : un menu « Catégorie »
            apparaît pour les admins. Renommer une catégorie ne change rien pour les auteurs des
            cours.
          </p>
        </div>
      )}

      {onglet === "quiz" && (
        <div className="space-y-3">
          <h3 className="font-bold">À valider ({vue.quizAValider.length})</h3>
          {vue.quizAValider.length === 0 && (
            <p className="text-[#47628a]">Aucun quiz en attente.</p>
          )}
          {vue.quizAValider.map(({ quiz, cours }) => (
            <div key={quiz.id} className="rounded border-2 border-[#9fc2e8] bg-white p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1">
                  <b>{cours.titre}</b> · {quiz.questions.length} questions ·{" "}
                  {quiz.source === "ia" ? "✨ IA" : "✍ manuel"} · par {quiz.auteur} ·{" "}
                  {formaterDate(quiz.date)}
                </span>
                <button
                  className={bouton}
                  onClick={() => setOuvert(ouvert === quiz.id ? null : quiz.id)}
                >
                  {ouvert === quiz.id ? "Masquer" : "Relire"}
                </button>
                <button
                  className={`${bouton} !bg-green-700 text-white`}
                  onClick={() => void modifier((o) => validerQuiz(o, quiz.id, true))}
                >
                  ✅ Valider
                </button>
              </div>
              {ouvert === quiz.id && <Apercu quiz={quiz.questions} />}
            </div>
          ))}
          <h3 className="font-bold">Validés par toi ({validesParAdmin.length})</h3>
          {validesParAdmin.map(({ quiz, cours }) => (
            <div
              key={quiz.id}
              className="flex flex-wrap items-center gap-2 rounded border-2 border-[#9fc2e8] bg-white p-2"
            >
              <span className="flex-1">
                {cours.titre} · {quiz.questions.length} questions · par {quiz.auteur}
              </span>
              <button
                className={bouton}
                onClick={() => void modifier((o) => validerQuiz(o, quiz.id, false))}
              >
                Retirer la validation
              </button>
            </div>
          ))}
        </div>
      )}

      {onglet === "masques" && (
        <ul className="space-y-1">
          {vue.masques.length === 0 && (
            <li className="text-[#47628a]">
              Aucun cours masqué. Pour en masquer un, ouvre-le puis « Masquer ce cours ».
            </li>
          )}
          {vue.masques.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded border-2 border-[#9fc2e8] bg-white p-2"
            >
              <span className="flex-1">
                {c.titre} · par {c.auteur}
              </span>
              <button
                className={bouton}
                onClick={() => void modifier((o) => masquerCours(o, c.id, false))}
              >
                Réafficher
              </button>
            </li>
          ))}
        </ul>
      )}

      {onglet === "ia" && (
        <div className="space-y-2">
          <p>
            L'IA écrit les quiz depuis le texte des cours. Elle passe par une fonction serveur qui
            garde la clé secrète.
          </p>
          <button className={bouton} onClick={tester}>
            🔌 Tester la connexion à l'IA
          </button>
          {test && <p className="rounded bg-white p-2">{test}</p>}
          <p className="text-sm text-[#47628a]">
            Si le test échoue : vérifie que la fonction <code>generer-quiz</code> est déployée et
            que le secret <code>GEMINI_API_KEY</code> existe (voir LISEZMOI-V5).
          </p>
        </div>
      )}
    </div>
  );
}

export function Apercu({
  quiz,
}: {
  quiz: Array<{ q: string; choix: string[]; bonne: number; explication: string }>;
}) {
  return (
    <ol className="mt-2 space-y-2 border-t pt-2">
      {quiz.map((q, i) => (
        <li key={i}>
          <div className="font-bold">
            {i + 1}. {q.q}
          </div>
          <ul className="ml-4 list-disc">
            {q.choix.map((c, k) => (
              <li key={k} className={k === q.bonne ? "font-bold text-green-700" : ""}>
                {c}
                {k === q.bonne ? " ✔" : ""}
              </li>
            ))}
          </ul>
          {q.explication && <div className="ml-4 text-sm text-[#47628a]">💡 {q.explication}</div>}
        </li>
      ))}
    </ol>
  );
}
