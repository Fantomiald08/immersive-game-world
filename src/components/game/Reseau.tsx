import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CATEGORIES } from "@/game/categories";
import {
  chargerFichier,
  creerCategorie,
  deposerCours,
  FORMATS,
  formaterDate,
  formaterTaille,
  supprimerCategorie,
  supprimerCours,
  TAILLE_MAX,
  useReseau,
  type CoursReseau,
} from "@/game/reseau";
import type { Profil } from "@/game/profil";

type Vue = { k: "liste" } | { k: "activite" } | { k: "depot" } | { k: "cours"; id: string };

/** Écran de l'ordinateur : connexion machine, puis interface du réseau Isitech. */
export function Reseau({
  moi,
  onFermer,
  onDepose,
  onQuiz,
  onDefier,
  onEntree,
}: {
  moi: Profil;
  onFermer: () => void;
  onDepose: () => void;
  onEntree: () => void;
  onQuiz: (c: CoursReseau) => void;
  onDefier: (c: CoursReseau) => void;
}) {
  const [connecte, setConnecte] = useState(false);
  return (
    <div className="fixed inset-0 z-[2500] grid place-items-center bg-black/80 p-2 sm:p-6">
      <div className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col rounded-lg border-[10px] border-[#7a4a2a] bg-[#0d2744] shadow-2xl">
        {connecte ? (
          <Interface
            moi={moi}
            onQuitter={onFermer}
            onDepose={onDepose}
            onQuiz={onQuiz}
            onDefier={onDefier}
          />
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
        ▶ Entrer sur le réseau Isitech
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
  onQuiz,
  onDefier,
}: {
  moi: Profil;
  onQuitter: () => void;
  onDepose: () => void;
  onQuiz: (c: CoursReseau) => void;
  onDefier: (c: CoursReseau) => void;
}) {
  const { data, isLoading, isError, refetch } = useReseau();
  const qc = useQueryClient();
  const [vue, setVue] = useState<Vue>({ k: "liste" });
  const [filtre, setFiltre] = useState("Toutes");
  const [recherche, setRecherche] = useState("");
  const [nouvelle, setNouvelle] = useState("");
  const [msg, setMsg] = useState("");

  const categories = useMemo(() => {
    const vu = new Set<string>(),
      r: Array<{ nom: string; id?: string; auteurId?: string }> = [];
    for (const n of CATEGORIES) {
      vu.add(n.toLowerCase());
      r.push({ nom: n });
    }
    for (const c of data?.categories ?? [])
      if (!vu.has(c.nom.toLowerCase())) {
        vu.add(c.nom.toLowerCase());
        r.push({ nom: c.nom, id: c.id, auteurId: c.auteurId });
      }
    for (const c of data?.cours ?? [])
      if (!vu.has(c.categorie.toLowerCase())) {
        vu.add(c.categorie.toLowerCase());
        r.push({ nom: c.categorie });
      }
    return r;
  }, [data]);

  const cours = useMemo(
    () =>
      (data?.cours ?? []).filter(
        (c) =>
          (filtre === "Toutes" || c.categorie === filtre) &&
          (!recherche.trim() ||
            (c.titre + " " + c.description + " " + c.auteur)
              .toLowerCase()
              .includes(recherche.trim().toLowerCase())),
      ),
    [data, filtre, recherche],
  );

  const nb = (n: string) => (data?.cours ?? []).filter((c) => c.categorie === n).length;
  const recharger = () => qc.invalidateQueries({ queryKey: ["reseau"] });

  const ajouterCategorie = async () => {
    const n = nouvelle.trim();
    if (n.length < 2) {
      setMsg("Le nom de la catégorie est trop court.");
      return;
    }
    if (categories.some((c) => c.nom.toLowerCase() === n.toLowerCase())) {
      setMsg("Cette catégorie existe déjà.");
      return;
    }
    try {
      await creerCategorie(moi.id, n);
      setNouvelle("");
      setMsg("");
      await recharger();
      setFiltre(n);
    } catch {
      setMsg("Impossible de créer la catégorie.");
    }
  };

  const activite = useMemo(
    () =>
      [
        ...(data?.cours ?? []).map((c) => ({
          date: c.date,
          texte: `${c.auteur} a déposé « ${c.titre} » dans ${c.categorie}${c.fichier ? " (avec fichier)" : ""}`,
          id: c.id,
        })),
        ...(data?.categories ?? []).map((c) => ({
          date: c.date,
          texte: `${c.auteur} a créé la catégorie « ${c.nom} »`,
          id: c.id,
        })),
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 40),
    [data],
  );

  const courant = vue.k === "cours" ? data?.cours.find((c) => c.id === vue.id) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#eef4fb] text-[#10243f]">
      <div className="flex items-center justify-between gap-2 bg-[#2b4b9a] px-3 py-2 text-white">
        <div className="font-pixel text-xs">
          <span className="text-[#ffb36b]">isi</span>tech · RÉSEAU
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm sm:inline">{moi.pseudo}</span>
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
            📚 Tous les cours ({data?.cours.length ?? 0})
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
          <div className="mt-2 px-2 font-pixel text-[8px] text-[#9fc2e8]">CATÉGORIES</div>
          <div className="flex-1 space-y-1 overflow-auto">
            {categories.map((c) => (
              <div key={c.nom} className="flex items-center gap-1">
                <button
                  className={`flex-1 rounded px-2 py-1 text-left text-sm ${vue.k === "liste" && filtre === c.nom ? choisi : normal}`}
                  onClick={() => {
                    setVue({ k: "liste" });
                    setFiltre(c.nom);
                  }}
                >
                  {c.nom} <span className="opacity-70">({nb(c.nom)})</span>
                </button>
                {c.id && c.auteurId === moi.id && nb(c.nom) === 0 && (
                  <button
                    className="px-1 text-[#ff9b8f]"
                    title="Supprimer la catégorie"
                    onClick={async () => {
                      await supprimerCategorie(c.id!);
                      await recharger();
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-1">
            <input
              className="min-w-0 flex-1 rounded border border-[#2b4b9a] bg-[#12396b] px-2 py-1 text-sm text-white placeholder:text-[#7fa3cf]"
              placeholder="Nouvelle catégorie"
              maxLength={40}
              value={nouvelle}
              onChange={(e) => setNouvelle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void ajouterCategorie();
              }}
            />
            <button className="rounded bg-[#e07a2b] px-2 text-white" onClick={ajouterCategorie}>
              ＋
            </button>
          </div>
          {msg && <p className="text-xs text-[#ffb3a8]">{msg}</p>}
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

          {data && vue.k === "liste" && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">
                  {filtre === "Toutes" ? "Tous les cours" : filtre}
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
                        {c.categorie} · par {c.auteur} · {formaterDate(c.date)}
                      </div>
                      {c.description && (
                        <div className="mt-1 line-clamp-2 text-sm">{c.description}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {data && vue.k === "activite" && (
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

          {data && vue.k === "depot" && (
            <FormDepot
              categories={categories.map((c) => c.nom)}
              defaut={filtre === "Toutes" ? CATEGORIES[0] : filtre}
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

          {data && vue.k === "cours" && !courant && (
            <p>
              Ce cours n'existe plus.{" "}
              <button className="underline" onClick={() => setVue({ k: "liste" })}>
                Retour
              </button>
            </p>
          )}
          {courant && (
            <Detail
              c={courant}
              moi={moi}
              onRetour={() => setVue({ k: "liste" })}
              onQuiz={() => onQuiz(courant)}
              onDefier={() => onDefier(courant)}
              onSupprime={async () => {
                await supprimerCours(courant);
                await recharger();
                setVue({ k: "liste" });
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function Detail({
  c,
  moi,
  onRetour,
  onQuiz,
  onDefier,
  onSupprime,
}: {
  c: CoursReseau;
  moi: Profil;
  onRetour: () => void;
  onQuiz: () => void;
  onDefier: () => void;
  onSupprime: () => Promise<void>;
}) {
  const [data, setData] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const [confirme, setConfirme] = useState(false);
  const ouvrir = async () => {
    try {
      setData(await chargerFichier(c.fichier!.ref));
      setErreur("");
    } catch {
      setErreur("Impossible de charger le fichier.");
    }
  };
  const image = c.fichier?.mime.startsWith("image/");
  return (
    <div className="space-y-3">
      <button className="text-sm underline" onClick={onRetour}>
        ← Retour
      </button>
      <h2 className="text-2xl font-bold">{c.titre}</h2>
      <div className="text-sm text-[#47628a]">
        {c.categorie} · par {c.auteur} · {formaterDate(c.date)}
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
      <div className="flex flex-wrap gap-2">
        <button className="rounded bg-[#2b4b9a] px-3 py-2 text-white" onClick={onQuiz}>
          ❓ Lancer le quiz
        </button>
        <button className="rounded bg-[#e07a2b] px-3 py-2 text-white" onClick={onDefier}>
          ⚔️ Défier
        </button>
        {c.auteurId === moi.id &&
          (confirme ? (
            <button className="rounded bg-red-700 px-3 py-2 text-white" onClick={onSupprime}>
              Confirmer la suppression
            </button>
          ) : (
            <button
              className="rounded border-2 border-red-700 px-3 py-2 text-red-700"
              onClick={() => setConfirme(true)}
            >
              🗑 Supprimer
            </button>
          ))}
      </div>
    </div>
  );
}

function FormDepot({
  categories,
  defaut,
  onAnnuler,
  onFait,
}: {
  categories: string[];
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
            <option key={c}>{c}</option>
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
        Texte du cours (sert à générer les quiz et les combats)
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
