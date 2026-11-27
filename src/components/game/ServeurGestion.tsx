import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { construireVue } from "@/game/reseauVue";
import {
  formaterDate,
  publierAnnonce,
  publierOrganisation,
  supprimerAnnonce,
  supprimerCours,
  supprimerQuiz,
  type CoursReseau,
} from "@/game/reseau";
import {
  ajouterCategorie,
  categoriesAffichees,
  deplacerCategorie,
  deplacerCours,
  masquerCours,
  renommerCategorie,
  supprimerCategorie,
  validerQuiz,
} from "@/game/organisation";
import type { Present } from "@/game/multijoueur";
import type { DonneesServeur } from "@/game/serveur-data";
import { Bouton, Cellule, EnTete, Ligne, Pastille, Tableau, type Section } from "./ServeurPanneaux";

type Message = { texte: string; erreur: boolean } | null;

/** Sections de gestion du contenu du jeu : toutes les actions passent par les fonctions existantes du réseau. */
export function ServeurGestion({
  section,
  data,
  moi,
  presents,
}: {
  section: Extract<Section, "cours" | "quiz" | "fiches" | "annonces" | "categories" | "eleves">;
  data: DonneesServeur;
  moi: { id: string; pseudo: string };
  presents: Present[];
}) {
  const qc = useQueryClient();
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [titreAnnonce, setTitreAnnonce] = useState("");
  const [corpsAnnonce, setCorpsAnnonce] = useState("");
  const [nouvelleCategorie, setNouvelleCategorie] = useState("");

  const vue = construireVue(data.reseau, moi.id);
  const org = vue.organisation;
  const enLigne = new Set(presents.map((p) => p.id));

  const eleves = useQuery({
    queryKey: ["serveur-eleves"],
    enabled: section === "eleves",
    queryFn: async () => {
      const { data: lignes, error } = await supabase
        .from("profiles")
        .select("id,pseudo,niveau,xp,titre")
        .order("xp", { ascending: false })
        .limit(500);
      if (error) throw error;
      return lignes ?? [];
    },
  });

  /** Exécute une action, affiche le résultat et relit les données. */
  const executer = async (action: () => Promise<void>, succes: string) => {
    setOccupe(true);
    setMessage(null);
    try {
      await action();
      setMessage({ texte: succes, erreur: false });
      await qc.invalidateQueries({ queryKey: ["reseau"] });
      await qc.invalidateQueries({ queryKey: ["serveur-admin"] });
      await qc.invalidateQueries({ queryKey: ["serveur-eleves"] });
    } catch (e) {
      setMessage({ texte: e instanceof Error ? e.message : "L'action a échoué.", erreur: true });
    } finally {
      setOccupe(false);
    }
  };

  const bandeau = message && (
    <p role="status" className={`mb-3 text-[13px] ${message.erreur ? "text-[#c42b1c]" : "text-[#107c10]"}`}>
      {message.texte}
    </p>
  );

  // ───── Cours ─────
  const categories = categoriesAffichees(org);
  const masquer = (c: { id: string; masque: boolean }) =>
    executer(() => publierOrganisation(moi.id, masquerCours(org, c.id, !c.masque)), c.masque ? "Cours affiché." : "Cours masqué.");
  const changerCategorie = (coursId: string, cle: string) =>
    executer(() => publierOrganisation(moi.id, deplacerCours(org, coursId, cle)), "Cours déplacé.");
  const retirerCours = (c: CoursReseau) => {
    if (!window.confirm(`Supprimer définitivement le cours « ${c.titre} » ?`)) return;
    void executer(() => supprimerCours(c), "Cours supprimé.");
  };

  // ───── Quiz ─────
  const basculerValidation = (id: string, valide: boolean) =>
    executer(() => publierOrganisation(moi.id, validerQuiz(org, id, valide)), valide ? "Quiz validé." : "Validation retirée.");
  const retirerQuiz = (id: string, titre: string) => {
    if (!window.confirm(`Supprimer le quiz de « ${titre} » ?`)) return;
    void executer(() => supprimerQuiz(id), "Quiz supprimé.");
  };

  // ───── Annonces ─────
  const publier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titreAnnonce.trim() || !corpsAnnonce.trim()) {
      setMessage({ texte: "Le titre et le message sont obligatoires.", erreur: true });
      return;
    }
    void executer(async () => {
      await publierAnnonce(moi.id, titreAnnonce, corpsAnnonce);
      setTitreAnnonce("");
      setCorpsAnnonce("");
    }, "Annonce publiée pour les élèves.");
  };
  const retirerAnnonce = (id: string, titre: string) => {
    if (!window.confirm(`Supprimer l'annonce « ${titre} » ?`)) return;
    void executer(() => supprimerAnnonce(id), "Annonce supprimée.");
  };

  // ───── Catégories ─────
  const ajouter = (e: React.FormEvent) => {
    e.preventDefault();
    void executer(async () => {
      await publierOrganisation(moi.id, ajouterCategorie(org, nouvelleCategorie));
      setNouvelleCategorie("");
    }, "Catégorie ajoutée.");
  };
  const renommer = (cle: string, nom: string) => {
    const nouveau = window.prompt("Nouveau nom de la catégorie", nom);
    if (!nouveau) return;
    void executer(() => publierOrganisation(moi.id, renommerCategorie(org, cle, nouveau)), "Catégorie renommée.");
  };
  const deplacer = (cle: string, sens: -1 | 1) =>
    executer(() => publierOrganisation(moi.id, deplacerCategorie(org, cle, sens)), "Ordre mis à jour.");
  const retirerCategorie = (cle: string, nom: string) => {
    if (!window.confirm(`Supprimer la catégorie « ${nom} » ? Ses cours passeront dans « Autre ».`)) return;
    void executer(() => publierOrganisation(moi.id, supprimerCategorie(org, cle)), "Catégorie supprimée.");
  };

  const titreDuCours = (id: string) => data.reseau.cours.find((c) => c.id === id)?.titre ?? "Cours supprimé";
  const quizValides = new Set(org.quizValides);

  switch (section) {
    case "cours":
      return (
        <div className="space-y-4">
          <EnTete titre="Cours" sousTitre="Masquer, déplacer ou supprimer les cours déposés par les élèves et les admins." />
          {bandeau}
          {vue.cours.length === 0 ? (
            <p className="text-[#505050]">Aucun cours déposé pour l'instant.</p>
          ) : (
            <Tableau entetes={["Cours", "Auteur", "Déposé le", "Catégorie", "Actions"]}>
              {vue.cours.map((c) => (
                <Ligne key={c.id}>
                  <Cellule>
                    {c.titre} {c.masque && <em className="not-italic text-[#9d5d00]">(masqué)</em>}
                  </Cellule>
                  <Cellule>{c.auteur}</Cellule>
                  <Cellule>{formaterDate(c.date)}</Cellule>
                  <Cellule>
                    <select
                      aria-label={`Catégorie de ${c.titre}`}
                      value={c.cle}
                      disabled={occupe}
                      onChange={(e) => void changerCategorie(c.id, e.target.value)}
                      className="border border-[#8a8886] bg-white px-2 py-0.5 text-[13px]"
                    >
                      {categories.map((k) => (
                        <option key={k.cle} value={k.cle}>
                          {k.nom}
                        </option>
                      ))}
                    </select>
                  </Cellule>
                  <Cellule>
                    <div className="flex flex-wrap gap-1">
                      <Bouton disabled={occupe} onClick={() => void masquer(c)}>
                        {c.masque ? "Afficher" : "Masquer"}
                      </Bouton>
                      <Bouton disabled={occupe} onClick={() => retirerCours(c)}>
                        Supprimer
                      </Bouton>
                    </div>
                  </Cellule>
                </Ligne>
              ))}
            </Tableau>
          )}
        </div>
      );

    case "quiz":
      return (
        <div className="space-y-4">
          <EnTete titre="Quiz" sousTitre="Un quiz validé est proposé aux élèves. Un quiz non validé reste visible seulement pour son auteur." />
          {bandeau}
          {data.reseau.quiz.length === 0 ? (
            <p className="text-[#505050]">Aucun quiz pour l'instant.</p>
          ) : (
            <Tableau entetes={["Cours", "Source", "Questions", "Auteur", "Créé le", "Statut", "Actions"]}>
              {data.reseau.quiz.map((q) => {
                const valide = quizValides.has(q.id);
                const titre = titreDuCours(q.coursId);
                return (
                  <Ligne key={q.id}>
                    <Cellule>{titre}</Cellule>
                    <Cellule>{q.source === "ia" ? "IA" : "Manuel"}</Cellule>
                    <Cellule>{q.questions.length}</Cellule>
                    <Cellule>{q.auteur}</Cellule>
                    <Cellule>{formaterDate(q.date)}</Cellule>
                    <Cellule>
                      <span className="flex items-center gap-2">
                        <Pastille couleur={valide ? "#107c10" : "#9d5d00"} />
                        {valide ? "Validé" : "En attente"}
                      </span>
                    </Cellule>
                    <Cellule>
                      <div className="flex flex-wrap gap-1">
                        <Bouton disabled={occupe} onClick={() => void basculerValidation(q.id, !valide)}>
                          {valide ? "Retirer la validation" : "Valider"}
                        </Bouton>
                        <Bouton disabled={occupe} onClick={() => retirerQuiz(q.id, titre)}>
                          Supprimer
                        </Bouton>
                      </div>
                    </Cellule>
                  </Ligne>
                );
              })}
            </Tableau>
          )}
        </div>
      );

    case "fiches":
      return (
        <div className="space-y-4">
          <EnTete titre="Fiches de révision" sousTitre="Les fiches se créent depuis le détail du cours. Ici, tu consultes ce qui a été généré." />
          {data.reseau.fiches.length === 0 ? (
            <p className="text-[#505050]">Aucune fiche générée pour l'instant.</p>
          ) : (
            <Tableau entetes={["Cours", "Titre de la fiche", "Auteur", "Créée le", "Contenu"]}>
              {data.reseau.fiches.map((f) => (
                <Ligne key={f.id}>
                  <Cellule>{titreDuCours(f.coursId)}</Cellule>
                  <Cellule>{f.fiche.titre}</Cellule>
                  <Cellule>{f.auteur}</Cellule>
                  <Cellule>{formaterDate(f.date)}</Cellule>
                  <Cellule>
                    {f.fiche.resume.length} résumé(s), {f.fiche.notions.length} notion(s)
                  </Cellule>
                </Ligne>
              ))}
            </Tableau>
          )}
        </div>
      );

    case "annonces":
      return (
        <div className="space-y-5">
          <EnTete titre="Annonces" sousTitre="Messages publiés pour tous les élèves dans le réseau." />
          {bandeau}
          <form onSubmit={publier} className="max-w-2xl space-y-2 border border-[#d6d6d6] bg-white p-4">
            <h3 className="text-[12px] font-semibold tracking-wide text-[#0067c0]">NOUVELLE ANNONCE</h3>
            <input
              aria-label="Titre de l'annonce"
              value={titreAnnonce}
              maxLength={100}
              onChange={(e) => setTitreAnnonce(e.target.value)}
              placeholder="Titre (100 caractères max)"
              className="w-full border border-[#8a8886] px-3 py-1.5 text-[13px]"
            />
            <textarea
              aria-label="Message de l'annonce"
              value={corpsAnnonce}
              maxLength={1000}
              onChange={(e) => setCorpsAnnonce(e.target.value)}
              placeholder="Message (1000 caractères max)"
              rows={3}
              className="w-full border border-[#8a8886] px-3 py-1.5 text-[13px]"
            />
            <Bouton type="submit" disabled={occupe}>
              Publier l'annonce
            </Bouton>
          </form>
          {data.reseau.annonces.length === 0 ? (
            <p className="text-[#505050]">Aucune annonce publiée.</p>
          ) : (
            <Tableau entetes={["Annonce", "Auteur", "Publiée le", "Actions"]}>
              {data.reseau.annonces.map((a) => (
                <Ligne key={a.id}>
                  <Cellule>{a.titre}</Cellule>
                  <Cellule>{a.auteur}</Cellule>
                  <Cellule>{formaterDate(a.date)}</Cellule>
                  <Cellule>
                    <Bouton disabled={occupe} onClick={() => retirerAnnonce(a.id, a.titre)}>
                      Supprimer
                    </Bouton>
                  </Cellule>
                </Ligne>
              ))}
            </Tableau>
          )}
        </div>
      );

    case "categories":
      return (
        <div className="space-y-4">
          <EnTete titre="Catégories" sousTitre="Organisation du réseau : l'ordre et les noms affichés aux élèves." />
          {bandeau}
          <form onSubmit={ajouter} className="flex max-w-xl gap-2">
            <input
              aria-label="Nom de la nouvelle catégorie"
              value={nouvelleCategorie}
              maxLength={40}
              onChange={(e) => setNouvelleCategorie(e.target.value)}
              placeholder="Nom de la catégorie"
              className="flex-1 border border-[#8a8886] px-3 py-1 text-[13px]"
            />
            <Bouton type="submit" disabled={occupe || !nouvelleCategorie.trim()}>
              Ajouter
            </Bouton>
          </form>
          <Tableau entetes={["Ordre", "Catégorie", "Cours", "Actions"]}>
            {categories.map((k, i) => (
              <Ligne key={k.cle}>
                <Cellule>{i + 1}</Cellule>
                <Cellule>{k.nom}</Cellule>
                <Cellule>{vue.cours.filter((c) => c.cle === k.cle).length}</Cellule>
                <Cellule>
                  <div className="flex flex-wrap gap-1">
                    <Bouton disabled={occupe || k.cle === "autre"} onClick={() => renommer(k.cle, k.nom)}>
                      Renommer
                    </Bouton>
                    <Bouton disabled={occupe || i === 0} onClick={() => void deplacer(k.cle, -1)}>
                      Monter
                    </Bouton>
                    <Bouton disabled={occupe || i === categories.length - 1} onClick={() => void deplacer(k.cle, 1)}>
                      Descendre
                    </Bouton>
                    <Bouton disabled={occupe || k.cle === "autre"} onClick={() => retirerCategorie(k.cle, k.nom)}>
                      Supprimer
                    </Bouton>
                  </div>
                </Cellule>
              </Ligne>
            ))}
          </Tableau>
        </div>
      );

    case "eleves": {
      const liste = eleves.data ?? [];
      return (
        <div className="space-y-4">
          <EnTete titre="Élèves" sousTitre="Comptes enregistrés, classés par expérience. « En ligne » indique une présence dans le monde." />
          {eleves.isLoading && <p className="text-[#505050]">Chargement des comptes…</p>}
          {eleves.isError && (
            <p role="alert" className="text-[#c42b1c]">
              Impossible de charger les comptes : {eleves.error instanceof Error ? eleves.error.message : "erreur inconnue"}.
            </p>
          )}
          {!eleves.isLoading && !eleves.isError && (
            <Tableau entetes={["Pseudo", "Niveau", "Titre", "XP", "Présence"]}>
              {liste.map((p) => (
                <Ligne key={p.id}>
                  <Cellule>{p.pseudo}</Cellule>
                  <Cellule>{p.niveau}</Cellule>
                  <Cellule>{p.titre}</Cellule>
                  <Cellule>{p.xp}</Cellule>
                  <Cellule>
                    <span className="flex items-center gap-2">
                      <Pastille couleur={enLigne.has(p.id) ? "#107c10" : "#8a8886"} />
                      {enLigne.has(p.id) ? "En ligne" : "Hors ligne"}
                    </span>
                  </Cellule>
                </Ligne>
              ))}
            </Tableau>
          )}
        </div>
      );
    }
  }
}
