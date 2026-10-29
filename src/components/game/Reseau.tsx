import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Apercu, GestionReseau } from "./GestionReseau";
import { EditeurQuiz } from "./EditeurQuiz";
import { estAdmin } from "@/game/admins";
import {
  deplacerCours,
  ErreurOrg,
  masquerCours,
  validerQuiz,
  type Organisation,
} from "@/game/organisation";
import type { Profil } from "@/game/profil";
import {
  chargerFichier,
  deposerCours,
  FORMATS,
  formaterDate,
  formaterTaille,
  publierOrganisation,
  supprimerCours,
  supprimerQuiz,
  TAILLE_MAX,
  useReseau,
  type QuizReseau,
} from "@/game/reseau";
import { construireVue, type CoursVue, type Vue } from "@/game/reseauVue";

type Vue_ =
  | { k: "liste" }
  | { k: "activite" }
  | { k: "depot" }
  | { k: "gestion" }
  | { k: "cours"; id: string };

/** Écran de l'ordinateur : connexion machine, puis réseau COURS (dépôt, catégories, quiz). Les combats se font sur les PC gaming. */
export function Reseau({
  moi,
  onFermer,
  onDepose,
  onEntree,
}: {
  moi: Profil;
  onFermer: () => void;
  onDepose: () => void;
  onEntree: () => void;
}) {
  const [connecte, setConnecte] = useState(false);
  return (
    <div className="fixed inset-0 z-[2500] grid place-items-center bg-black/80 p-2 sm:p-6">
      <div className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col rounded-lg border-[10px] border-[#7a4a2a] bg-[#0d2744] shadow-2xl">
        {connecte ? (
          <Interface moi={moi} onQuitter={onFermer} onDepose={onDepose} />
        ) : (
          <Connexion
            moi={moi}
            onEntrer={() => {
              setConnecte(true);
              onEntree();
            }}
            onFermer={onFermer}
          />
        )}
      </div>
    </div>
  );
}

function Connexion({
  moi,
  onEntrer,
  onFermer,
}: {
  moi: Profil;
  onEntrer: () => void;
  onFermer: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#12396b] to-[#0a1d36] p-6 text-center text-white">
      <div className="font-pixel text-2xl">
        <span className="text-[#e07a2b]">isi</span>tech
      </div>
      <div className="text-lg text-[#9fc2e8]">Campus du numérique · Poste de travail</div>
      <div className="rounded border-2 border-[#2b4b9a] bg-[#0a1d36]/70 px-6 py-3 text-lg">
        Session : <b>{moi.pseudo}</b>
      </div>
      <button className="pixel-btn !bg-[#e07a2b] !text-white" onClick={onEntrer}>
        ▶ Entrer sur le réseau cours
      </button>
      <button className="text-sm text-[#9fc2e8] underline" onClick={onFermer}>
        Éteindre l'écran
      </button>
    </div>
  );
}

const choisi = "bg-[#e07a2b] text-white",
  normal = "text-[#cfe3fb] hover:bg-[#1c4a85]";

function Interface({
  moi,
  onQuitter,
  onDepose,
}: {
  moi: Profil;
  onQuitter: () => void;
  onDepose: () => void;
}) {
  const { data, isLoading, isError, refetch } = useReseau();
  const qc = useQueryClient();
  const admin = estAdmin(moi);
  const [vue, setVue] = useState<Vue_>({ k: "liste" });
  const [filtre, setFiltre] = useState("Toutes"); // clé de catégorie
  const [recherche, setRecherche] = useState("");
  const [msgAdmin, setMsgAdmin] = useState("");
  const [editeur, setEditeur] = useState<{ cours: CoursVue; existant?: QuizReseau } | null>(null);

  const v: Vue | null = useMemo(() => (data ? construireVue(data) : null), [data]);
  const recharger = () => qc.invalidateQueries({ queryKey: ["reseau"] });

  /** Modification de l'organisation (admin) : on calcule la nouvelle version, on la publie, on recharge. */
  const modifier = async (f: (o: Organisation) => Organisation) => {
    if (!v) return;
    try {
      await publierOrganisation(moi.id, f(v.organisation));
      await recharger();
      setMsgAdmin("");
    } catch (e) {
      setMsgAdmin(e instanceof ErreurOrg ? e.message : "Enregistrement impossible. Réessaie.");
    }
  };

  const cours = useMemo(
    () =>
      (v?.cours ?? []).filter(
        (c) =>
          (filtre === "Toutes" || c.cle === filtre) &&
          (!recherche.trim() ||
            (c.titre + " " + c.description + " " + c.auteur)
              .toLowerCase()
              .includes(recherche.trim().toLowerCase())),
      ),
    [v, filtre, recherche],
  );

  const activite = useMemo(
    () =>
      [
        ...(v?.cours ?? []).map((c) => ({
          date: c.date,
          texte: `${c.auteur} a déposé « ${c.titre} » dans ${c.categorieNom}${c.fichier ? " (avec fichier)" : ""}`,
          id: c.id,
        })),
        ...(data?.annonces ?? []).map((a) => ({
          date: a.date,
          texte: `${a.auteur} a publié l'annonce « ${a.titre} »`,
          id: a.id,
        })),
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 40),
    [v, data],
  );

  const courant =
    vue.k === "cours"
      ? (v?.cours.find((c) => c.id === vue.id) ?? v?.masques.find((c) => c.id === vue.id))
      : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#eef4fb] text-[#10243f]">
      <div className="flex items-center justify-between gap-2 bg-[#2b4b9a] px-3 py-2 text-white">
        <div className="font-pixel text-xs">
          <span className="text-[#ffb36b]">isi</span>tech · RÉSEAU COURS
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm sm:inline">
            {moi.pseudo}
            {admin ? " · admin" : ""}
          </span>
          <button className="rounded bg-[#e07a2b] px-3 py-1 text-sm" onClick={onQuitter}>
            ⏻ Quitter
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <nav className="flex shrink-0 flex-col gap-1 overflow-auto bg-[#0d2744] p-2 sm:w-56">
          <button
            className={`rounded px-2 py-1 text-left ${vue.k === "liste" && filtre === "Toutes" ? choisi : normal}`}
            onClick={() => {
              setVue({ k: "liste" });
              setFiltre("Toutes");
            }}
          >
            📚 Tous les cours ({v?.cours.length ?? 0})
          </button>
          <button
            className={`rounded px-2 py-1 text-left ${vue.k === "activite" ? choisi : normal}`}
            onClick={() => setVue({ k: "activite" })}
          >
            🕘 Activité récente
          </button>
          <button
            className={`rounded px-2 py-1 text-left ${vue.k === "depot" ? choisi : normal}`}
            onClick={() => setVue({ k: "depot" })}
          >
            📥 Déposer un cours
          </button>
          {admin && (
            <button
              className={`rounded px-2 py-1 text-left ${vue.k === "gestion" ? choisi : normal}`}
              onClick={() => setVue({ k: "gestion" })}
            >
              🛠 Gérer le réseau{v && v.quizAValider.length > 0 ? ` (${v.quizAValider.length})` : ""}
            </button>
          )}
          <div className="mt-2 px-2 font-pixel text-[8px] text-[#9fc2e8]">CATÉGORIES</div>
          <div className="flex-1 space-y-1 overflow-auto">
            {(v?.categories ?? []).map((c) => (
              <button
                key={c.cle}
                className={`w-full rounded px-2 py-1 text-left text-sm ${vue.k === "liste" && filtre === c.cle ? choisi : normal}`}
                onClick={() => {
                  setVue({ k: "liste" });
                  setFiltre(c.cle);
                }}
              >
                {c.nom}{" "}
                <span className="opacity-70">
                  ({(v?.cours ?? []).filter((x) => x.cle === c.cle).length})
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 px-1 text-xs text-[#9fc2e8]">
            ⚔ Pour t'entraîner avec les quiz, va sur un PC gaming (Serveurs, Développeur, Labo).
          </p>
        </nav>

        <main className="min-h-0 flex-1 overflow-auto p-4">
          {isLoading && <p>Chargement du réseau…</p>}
          {isError && (
            <p>
              Le réseau est injoignable.{" "}
              <button className="underline" onClick={() => refetch()}>
                Réessayer
              </button>
            </p>
          )}

          {v && vue.k === "liste" && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">
                  {filtre === "Toutes"
                    ? "Tous les cours"
                    : (v.categories.find((c) => c.cle === filtre)?.nom ?? "Catégorie")}
                </h2>
                <input
                  className="ml-auto w-full rounded border-2 border-[#9fc2e8] bg-white px-2 py-1 sm:w-56"
                  placeholder="🔎 Rechercher…"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>
              {cours.length === 0 && (
                <p className="text-[#47628a]">
                  Aucun cours ici pour l'instant.{" "}
                  <button className="underline" onClick={() => setVue({ k: "depot" })}>
                    Dépose le premier !
                  </button>
                </p>
              )}
              <ul className="grid gap-2 md:grid-cols-2">
                {cours.map((c) => (
                  <li key={c.id}>
                    <button
                      className="w-full rounded border-2 border-[#9fc2e8] bg-white p-3 text-left hover:border-[#e07a2b]"
                      onClick={() => setVue({ k: "cours", id: c.id })}
                    >
                      <div className="font-bold">
                        {c.fichier ? "📎 " : "📄 "}
                        {c.titre}
                      </div>
                      <div className="text-sm text-[#47628a]">
                        {c.categorieNom} · par {c.auteur} · {formaterDate(c.date)}
                      </div>
                      {c.description && (
                        <div className="mt-1 line-clamp-2 text-sm">{c.description}</div>
                      )}
                      {v.quizJouables.some((j) => j.cours.id === c.id) && (
                        <div className="mt-1 text-xs text-green-700">
                          ⚔ Quiz disponible pour les combats
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {v && vue.k === "activite" && (
            <>
              <h2 className="mb-3 text-xl font-bold">Activité récente</h2>
              {activite.length === 0 && <p className="text-[#47628a]">Rien pour l'instant.</p>}
              <ul className="space-y-2">
                {activite.map((a) => (
                  <li key={a.id} className="rounded border-l-4 border-[#e07a2b] bg-white p-2">
                    <div>{a.texte}</div>
                    <div className="text-xs text-[#47628a]">{formaterDate(a.date)}</div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {v && vue.k === "depot" && (
            <FormDepot
              categories={v.categories}
              defaut={filtre === "Toutes" ? (v.categories[0]?.cle ?? "") : filtre}
              onAnnuler={() => setVue({ k: "liste" })}
              onFait={async (c) => {
                await deposerCours(moi.id, c);
                await recharger();
                setVue({ k: "liste" });
                setFiltre(c.categorie);
                onDepose();
              }}
            />
          )}

          {v && vue.k === "gestion" && admin && (
            <GestionReseau moi={moi} vue={v} modifier={modifier} message={msgAdmin} />
          )}

          {v && vue.k === "cours" && !courant && (
            <p>
              Ce cours n'existe plus.{" "}
              <button className="underline" onClick={() => setVue({ k: "liste" })}>
                Retour
              </button>
            </p>
          )}
          {v && courant && (
            <Detail
              c={courant}
              v={v}
              moi={moi}
              admin={admin}
              onRetour={() => setVue({ k: "liste" })}
              modifier={modifier}
              message={msgAdmin}
              onSupprime={async () => {
                await supprimerCours(courant);
                await recharger();
                setVue({ k: "liste" });
              }}
              onQuiz={(existant) =>
                setEditeur({ cours: courant, ...(existant ? { existant } : {}) })
              }
              rechargement={recharger}
            />
          )}
        </main>
      </div>
      {editeur && (
        <EditeurQuiz
          cours={editeur.cours}
          moi={moi}
          {...(editeur.existant ? { existant: editeur.existant } : {})}
          onFermer={() => setEditeur(null)}
        />
      )}
    </div>
  );
}

function Detail({
  c,
  v,
  moi,
  admin,
  onRetour,
  onSupprime,
  onQuiz,
  modifier,
  message,
  rechargement,
}: {
  c: CoursVue;
  v: Vue;
  moi: Profil;
  admin: boolean;
  onRetour: () => void;
  onSupprime: () => Promise<void>;
  onQuiz: (existant?: QuizReseau) => void;
  modifier: (f: (o: Organisation) => Organisation) => Promise<void>;
  message: string;
  rechargement: () => Promise<unknown>;
}) {
  const [data, setData] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const [confirme, setConfirme] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const image = c.fichier?.mime.startsWith("image/");
  const auteur = c.auteurId === moi.id;
  const peutQuiz = admin || auteur;
  const valide = (q: QuizReseau) => v.quizJouables.some((j) => j.quiz.id === q.id);

  const ouvrir = async () => {
    try {
      setData(await chargerFichier(c.fichier!.ref));
      setErreur("");
    } catch {
      setErreur("Impossible de charger le fichier.");
    }
  };

  return (
    <div className="space-y-3">
      <button className="text-sm underline" onClick={onRetour}>
        ← Retour
      </button>
      <h2 className="text-2xl font-bold">
        {c.titre}
        {c.masque ? " (masqué)" : ""}
      </h2>
      <div className="text-sm text-[#47628a]">
        {c.categorieNom} · par {c.auteur} · {formaterDate(c.date)}
      </div>
      {c.description && <p className="text-lg">{c.description}</p>}
      {c.contenu && (
        <div className="max-h-72 overflow-auto whitespace-pre-wrap rounded border-2 border-[#9fc2e8] bg-white p-3 text-lg">
          {c.contenu}
        </div>
      )}
      {c.fichier && (
        <div className="rounded border-2 border-[#9fc2e8] bg-white p-3">
          <div>
            📎 <b>{c.fichier.nom}</b> · {formaterTaille(c.fichier.taille)}
          </div>
          {!data && (
            <button className="mt-2 rounded bg-[#2b4b9a] px-3 py-1 text-white" onClick={ouvrir}>
              Charger le fichier
            </button>
          )}
          {data && image && (
            <img src={data} alt={c.fichier.nom} className="mt-2 max-h-72 max-w-full" />
          )}
          {data && (
            <a
              className="mt-2 inline-block rounded bg-[#e07a2b] px-3 py-1 text-white"
              href={data}
              download={c.fichier.nom}
            >
              ⬇ Télécharger
            </a>
          )}
          {erreur && <p className="text-red-700">{erreur}</p>}
        </div>
      )}

      <section className="rounded border-2 border-[#9fc2e8] bg-white p-3">
        <h3 className="mb-2 font-bold">⚔ Quiz de ce cours</h3>
        {c.quiz.length === 0 && (
          <p className="text-[#47628a]">
            Aucun quiz pour l'instant.
            {peutQuiz ? "" : " L'auteur du cours ou un admin peut en créer un."}
          </p>
        )}
        <ul className="space-y-2">
          {c.quiz.map((q) => (
            <li key={q.id} className="rounded border border-[#9fc2e8] p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1">
                  {q.questions.length} questions · {q.source === "ia" ? "✨ IA" : "✍ manuel"} · par{" "}
                  {q.auteur} ·{" "}
                  {valide(q) ? (
                    <b className="text-green-700">✅ validé (jouable en combat)</b>
                  ) : (
                    <b className="text-[#b36b00]">⏳ en attente de validation</b>
                  )}
                </span>
                <button
                  className="rounded border-2 border-[#2b4b9a] px-2 py-1"
                  onClick={() => setOuvert(ouvert === q.id ? null : q.id)}
                >
                  {ouvert === q.id ? "Masquer" : "Voir"}
                </button>
                {peutQuiz && (
                  <button
                    className="rounded border-2 border-[#2b4b9a] px-2 py-1"
                    onClick={() => onQuiz(q)}
                  >
                    ✎ Modifier
                  </button>
                )}
                {admin && !valide(q) && (
                  <button
                    className="rounded bg-green-700 px-2 py-1 text-white"
                    onClick={() => void modifier((o) => validerQuiz(o, q.id, true))}
                  >
                    ✅ Valider
                  </button>
                )}
                {admin && valide(q) && q.auteurId !== moi.id && (
                  <button
                    className="rounded border-2 border-[#2b4b9a] px-2 py-1"
                    onClick={() => void modifier((o) => validerQuiz(o, q.id, false))}
                  >
                    Retirer la validation
                  </button>
                )}
                {q.auteurId === moi.id && (
                  <button
                    className="rounded border-2 border-red-700 px-2 py-1 text-red-700"
                    onClick={async () => {
                      await supprimerQuiz(q.id);
                      await rechargement();
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
              {ouvert === q.id && <Apercu quiz={q.questions} />}
            </li>
          ))}
        </ul>
        {peutQuiz && (
          <button
            className="mt-2 rounded bg-[#2b4b9a] px-3 py-2 text-white"
            onClick={() => onQuiz()}
          >
            ＋ Créer un quiz (à la main ou avec l'IA)
          </button>
        )}
      </section>

      {admin && (
        <section className="space-y-2 rounded border-2 border-[#e07a2b] bg-[#fff8ee] p-3">
          <h3 className="font-bold">🛠 Admin</h3>
          <label className="flex flex-wrap items-center gap-2">
            Catégorie
            <select
              className="rounded border-2 border-[#9fc2e8] bg-white px-2 py-1"
              value={c.cle}
              onChange={(e) => void modifier((o) => deplacerCours(o, c.id, e.target.value))}
            >
              {v.categories.map((x) => (
                <option key={x.cle} value={x.cle}>
                  {x.nom}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded border-2 border-[#2b4b9a] px-3 py-1"
            onClick={() => void modifier((o) => masquerCours(o, c.id, !c.masque))}
          >
            {c.masque ? "👁 Réafficher ce cours" : "🙈 Masquer ce cours"}
          </button>
          {message && <p className="text-red-800">{message}</p>}
        </section>
      )}

      {auteur &&
        (confirme ? (
          <button className="rounded bg-red-700 px-3 py-2 text-white" onClick={onSupprime}>
            Confirmer la suppression de mon cours
          </button>
        ) : (
          <button
            className="rounded border-2 border-red-700 px-3 py-2 text-red-700"
            onClick={() => setConfirme(true)}
          >
            🗑 Supprimer mon cours
          </button>
        ))}
    </div>
  );
}

function FormDepot({
  categories,
  defaut,
  onAnnuler,
  onFait,
}: {
  categories: Array<{ cle: string; nom: string }>;
  defaut: string;
  onAnnuler: () => void;
  onFait: (c: {
    titre: string;
    categorie: string;
    description: string;
    contenu: string;
    fichier: File | null;
  }) => Promise<void>;
}) {
  const [titre, setTitre] = useState(""),
    [categorie, setCategorie] = useState(defaut),
    [description, setDescription] = useState(""),
    [contenu, setContenu] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState(""),
    [envoi, setEnvoi] = useState(false);

  const choisirFichier = (f: File | null) => {
    if (f && f.size > TAILLE_MAX) {
      setErreur("Ce fichier dépasse 2 Mo. Compresse-le ou colle son texte ci-dessous.");
      setFichier(null);
      return;
    }
    setErreur("");
    setFichier(f);
  };
  const go = async () => {
    if (!titre.trim()) {
      setErreur("Donne un titre à ton cours.");
      return;
    }
    if (!contenu.trim() && !fichier && !description.trim()) {
      setErreur("Ajoute un texte, une description ou un fichier.");
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      await onFait({
        titre: titre.trim().slice(0, 100),
        categorie,
        description: description.trim().slice(0, 300),
        contenu: contenu.slice(0, 8000),
        fichier,
      });
    } catch (e) {
      setErreur(
        e instanceof Error && e.message.includes("2 Mo")
          ? e.message
          : "Le dépôt a échoué. Réessaie.",
      );
      setEnvoi(false);
    }
  };
  const champ = "mt-1 w-full rounded border-2 border-[#9fc2e8] bg-white px-2 py-1";
  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-xl font-bold">Déposer un cours</h2>
      <label className="block">
        Titre
        <input
          className={champ}
          maxLength={100}
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Ex : Configurer un serveur DHCP"
        />
      </label>
      <label className="block">
        Catégorie
        <select className={champ} value={categorie} onChange={(e) => setCategorie(e.target.value)}>
          {categories.map((c) => (
            <option key={c.cle} value={c.cle}>
              {c.nom}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Description (facultatif)
        <input
          className={champ}
          maxLength={300}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="block">
        Fichier (PDF, Word, PowerPoint, Excel, image, ZIP… 2 Mo max)
        <input
          className={champ}
          type="file"
          accept={FORMATS}
          onChange={(e) => choisirFichier(e.target.files?.[0] ?? null)}
        />
      </label>
      <label className="block">
        Texte du cours (sert à générer les quiz)
        <textarea
          className={champ}
          rows={8}
          maxLength={8000}
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          placeholder="Colle ici le texte de ton cours. Plus il est détaillé, meilleur sera le quiz."
        />
      </label>
      {erreur && <p className="text-red-700">{erreur}</p>}
      <div className="flex gap-2">
        <button
          className="rounded bg-[#e07a2b] px-4 py-2 text-white disabled:opacity-60"
          disabled={envoi}
          onClick={go}
        >
          {envoi ? "Envoi…" : "📥 Déposer sur le réseau"}
        </button>
        <button className="rounded border-2 border-[#2b4b9a] px-4 py-2" onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </div>
  );
}
