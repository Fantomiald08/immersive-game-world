import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { construireVue } from "@/game/reseauVue";
import {
  formaterDate,
  publierAnnonce,
  publierOrganisation,
  supprimerAnnonce,
  supprimerCours,
  type CoursReseau,
} from "@/game/reseau";
import { masquerCours } from "@/game/organisation";
import { SEUIL_LENT_MS, type EtatService, type NiveauVerification } from "@/game/serveur";
import type { DonneesServeur } from "@/game/serveur-data";

export type Section = "accueil" | "local" | "tous" | "roles" | "services" | "evenements" | "performances" | "outils" | "aide";

const COULEUR_ETAT: Record<EtatService, string> = {
  "En cours": "#107c10",
  Lent: "#ffb900",
  Arrêté: "#d13438",
};
const COULEUR_NIVEAU: Record<NiveauVerification, string> = {
  Réussi: "#107c10",
  Avertissement: "#ffb900",
  Erreur: "#d13438",
};

export function Pastille({ couleur }: { couleur: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: couleur }} aria-hidden />;
}

/** En-tête de section, comme dans le Gestionnaire de serveur. */
export function EnTete({ titre, sousTitre, action }: { titre: string; sousTitre: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#d0d7e2] pb-3">
      <div>
        <h2 className="text-xl font-semibold text-[#1f3a5f]">{titre}</h2>
        <p className="text-sm text-[#4a5568]">{sousTitre}</p>
      </div>
      {action}
    </div>
  );
}

const Bouton = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    {...props}
    className={`rounded-sm border border-[#8a96a8] bg-white px-3 py-1 text-sm text-[#1f2937] hover:bg-[#e8f1fb] disabled:opacity-50 ${props.className ?? ""}`}
  />
);

const Tableau = ({ entetes, children }: { entetes: string[]; children: React.ReactNode }) => (
  <div className="overflow-x-auto rounded-sm border border-[#d0d7e2]">
    <table className="w-full border-collapse text-left text-sm">
      <thead className="bg-[#eef2f7] text-[#1f3a5f]">
        <tr>
          {entetes.map((e) => (
            <th key={e} className="border-b border-[#d0d7e2] px-3 py-2 font-semibold">
              {e}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

const Ligne = ({ children }: { children: React.ReactNode }) => (
  <tr className="border-b border-[#eef2f7] align-top hover:bg-[#f5f9ff]">{children}</tr>
);
const Cellule = ({ children }: { children: React.ReactNode }) => <td className="px-3 py-2">{children}</td>;

export function Accueil({ data, aller }: { data: DonneesServeur; aller: (s: Section) => void }) {
  const r = data.reseau;
  const tuiles: Array<{ titre: string; texte: string; vers: Section }> = [
    { titre: "Configurer ce serveur local", texte: "Nom, mode d'administration, connexion et meilleures pratiques.", vers: "local" },
    { titre: "Ajouter des rôles et fonctionnalités", texte: "Voir les rôles du jeu et le nombre de cours, quiz et fiches.", vers: "roles" },
    { titre: "Vérifier les services", texte: "Base de données, temps réel, génération IA et comptes.", vers: "services" },
    { titre: "Outils d'administration", texte: "Publier une annonce, masquer ou supprimer un cours.", vers: "outils" },
  ];
  return (
    <div className="space-y-5">
      <EnTete titre="Tableau de bord" sousTitre="Bienvenue dans le Gestionnaire de serveur d'ISITECH WORLD." />
      <div className="grid gap-3 sm:grid-cols-2">
        {tuiles.map((t) => (
          <button
            key={t.titre}
            type="button"
            onClick={() => aller(t.vers)}
            className="rounded-sm border border-[#d0d7e2] bg-[#f5f9ff] p-4 text-left hover:border-[#0067b8] hover:bg-[#e8f1fb]"
          >
            <div className="font-semibold text-[#0067b8]">{t.titre}</div>
            <div className="mt-1 text-sm text-[#4a5568]">{t.texte}</div>
          </button>
        ))}
      </div>
      <div>
        <h3 className="mb-2 font-semibold text-[#1f3a5f]">Résumé du jeu</h3>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[
            ["Cours", r.cours.length],
            ["Quiz", r.quiz.length],
            ["Fiches", r.fiches.length],
            ["Annonces", r.annonces.length],
          ].map(([nom, n]) => (
            <div key={nom} className="rounded-sm border border-[#d0d7e2] p-3">
              <div className="text-[#4a5568]">{nom}</div>
              <div className="text-2xl font-semibold text-[#1f3a5f]">{n}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 font-semibold text-[#1f3a5f]">Meilleures pratiques</h3>
        <ul className="space-y-1 text-sm">
          {data.verifications.map((v) => (
            <li key={v.titre} className="flex items-start gap-2">
              <Pastille couleur={COULEUR_NIVEAU[v.niveau]} />
              <span>
                <strong>{v.titre}</strong> : {v.message}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ServeurLocal({ data, connectes }: { data: DonneesServeur; connectes: number }) {
  const m = data.mesures;
  const proprietes: Array<[string, string]> = [
    ["Nom de l'ordinateur", "ISITECH-SRV22"],
    ["Mode d'administration", m.provisoire ? "Provisoire (pseudos)" : "Stable (identifiants de compte)"],
    ["Élèves connectés", String(connectes)],
    ["Comptes enregistrés", String(m.nbProfils)],
    ["Temps réel", m.tempsReelOk ? "Ouvert" : "Fermé"],
    ["Génération IA", m.iaConfiguree ? "Configurée" : "Absente"],
    ["Réponse de la base", m.latenceMs === null ? "Aucune réponse" : `${m.latenceMs} ms`],
  ];
  return (
    <div className="space-y-5">
      <EnTete titre="Serveur local" sousTitre="Propriétés du serveur et analyse de sa configuration." />
      <Tableau entetes={["Propriété", "Valeur"]}>
        {proprietes.map(([p, v]) => (
          <Ligne key={p}>
            <Cellule>{p}</Cellule>
            <Cellule>{v}</Cellule>
          </Ligne>
        ))}
      </Tableau>
      <div>
        <h3 className="mb-2 font-semibold text-[#1f3a5f]">Analyseur des meilleures pratiques</h3>
        <Tableau entetes={["Niveau", "Vérification", "Résultat"]}>
          {data.verifications.map((v) => (
            <Ligne key={v.titre}>
              <Cellule>
                <span className="flex items-center gap-2">
                  <Pastille couleur={COULEUR_NIVEAU[v.niveau]} />
                  {v.niveau}
                </span>
              </Cellule>
              <Cellule>{v.titre}</Cellule>
              <Cellule>{v.message}</Cellule>
            </Ligne>
          ))}
        </Tableau>
      </div>
      <div>
        <h3 className="mb-2 font-semibold text-[#1f3a5f]">Événements récents</h3>
        <Evenements data={data} limite={8} />
      </div>
    </div>
  );
}

export function TousServeurs({ data }: { data: DonneesServeur }) {
  const actifs = data.services.filter((s) => s.etat === "En cours").length;
  const etat = data.services.some((s) => s.etat === "Arrêté")
    ? "Arrêté"
    : data.services.some((s) => s.etat === "Lent")
      ? "Lent"
      : "En cours";
  return (
    <div className="space-y-4">
      <EnTete titre="Tous les serveurs" sousTitre="Serveurs gérés depuis ce gestionnaire." />
      <Tableau entetes={["Nom", "État", "Services actifs", "Rôle principal"]}>
        <Ligne>
          <Cellule>ISITECH-SRV22 (serveur local)</Cellule>
          <Cellule>
            <span className="flex items-center gap-2">
              <Pastille couleur={COULEUR_ETAT[etat]} />
              {etat}
            </span>
          </Cellule>
          <Cellule>
            {actifs} / {data.services.length}
          </Cellule>
          <Cellule>Cours, quiz, fiches et annonces</Cellule>
        </Ligne>
      </Tableau>
      <p className="text-sm text-[#4a5568]">
        Le jeu s'appuie sur une base de données hébergée et sur la génération IA. Ils apparaissent dans la section Services.
      </p>
    </div>
  );
}

export function Roles({ data }: { data: DonneesServeur }) {
  return (
    <div className="space-y-4">
      <EnTete titre="Rôles et fonctionnalités" sousTitre="Ce que le serveur héberge pour le jeu, avec le nombre d'éléments." />
      <Tableau entetes={["Rôle", "Description", "Éléments"]}>
        {data.roles.map((r) => (
          <Ligne key={r.nom}>
            <Cellule>
              <strong>{r.nom}</strong>
            </Cellule>
            <Cellule>{r.description}</Cellule>
            <Cellule>{r.nombre}</Cellule>
          </Ligne>
        ))}
      </Tableau>
    </div>
  );
}

export function Services({ data, onActualiser }: { data: DonneesServeur; onActualiser: () => void }) {
  return (
    <div className="space-y-4">
      <EnTete
        titre="Services"
        sousTitre={`Un service est « Lent » au-delà de ${SEUIL_LENT_MS} ms de réponse.`}
        action={<Bouton onClick={onActualiser}>Actualiser</Bouton>}
      />
      <Tableau entetes={["Nom", "Description", "Démarrage", "État", "Détail"]}>
        {data.services.map((s) => (
          <Ligne key={s.nom}>
            <Cellule>
              <strong>{s.nom}</strong>
            </Cellule>
            <Cellule>{s.description}</Cellule>
            <Cellule>{s.demarrage}</Cellule>
            <Cellule>
              <span className="flex items-center gap-2">
                <Pastille couleur={COULEUR_ETAT[s.etat]} />
                {s.etat}
              </span>
            </Cellule>
            <Cellule>{s.detail}</Cellule>
          </Ligne>
        ))}
      </Tableau>
    </div>
  );
}

export function Evenements({ data, limite }: { data: DonneesServeur; limite?: number }) {
  const sources = [...new Set(data.evenements.map((e) => e.source))];
  const [source, setSource] = useState("Toutes");
  const liste = data.evenements
    .filter((e) => source === "Toutes" || e.source === source)
    .slice(0, limite ?? data.evenements.length);
  return (
    <div className="space-y-3">
      {!limite && (
        <EnTete
          titre="Événements"
          sousTitre="Ce qui s'est passé dans le jeu, du plus récent au plus ancien."
          action={
            <select
              aria-label="Filtrer par source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-sm border border-[#8a96a8] bg-white px-2 py-1 text-sm"
            >
              <option>Toutes</option>
              {sources.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          }
        />
      )}
      {liste.length === 0 ? (
        <p className="text-sm text-[#4a5568]">Aucun événement pour cette source.</p>
      ) : (
        <Tableau entetes={["Date", "Niveau", "Source", "Message"]}>
          {liste.map((e) => (
            <Ligne key={e.id}>
              <Cellule>{formaterDate(e.date)}</Cellule>
              <Cellule>
                <span className="flex items-center gap-2">
                  <Pastille couleur={e.niveau === "Avertissement" ? "#ffb900" : "#0067b8"} />
                  {e.niveau}
                </span>
              </Cellule>
              <Cellule>{e.source}</Cellule>
              <Cellule>{e.message}</Cellule>
            </Ligne>
          ))}
        </Tableau>
      )}
    </div>
  );
}

export function Performances({ data, connectes }: { data: DonneesServeur; connectes: number }) {
  const r = data.reseau;
  const mesures: Array<{ nom: string; valeur: number; unite: string; max: number }> = [
    { nom: "Réponse de la base", valeur: data.mesures.latenceMs ?? 0, unite: " ms", max: SEUIL_LENT_MS * 2 },
    { nom: "Élèves connectés", valeur: connectes, unite: "", max: Math.max(connectes, data.mesures.nbProfils, 1) },
    { nom: "Comptes", valeur: data.mesures.nbProfils, unite: "", max: Math.max(data.mesures.nbProfils, 1) },
    { nom: "Cours", valeur: r.cours.length, unite: "", max: Math.max(r.cours.length, r.quiz.length, r.fiches.length, 1) },
    { nom: "Quiz", valeur: r.quiz.length, unite: "", max: Math.max(r.cours.length, r.quiz.length, r.fiches.length, 1) },
    { nom: "Fiches", valeur: r.fiches.length, unite: "", max: Math.max(r.cours.length, r.quiz.length, r.fiches.length, 1) },
  ];
  return (
    <div className="space-y-4">
      <EnTete titre="Performances" sousTitre="Mesures réelles prises au dernier rafraîchissement (toutes les 15 secondes)." />
      <div className="space-y-3">
        {mesures.map((m) => (
          <div key={m.nom}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{m.nom}</span>
              <span className="font-semibold">
                {m.valeur}
                {m.unite}
              </span>
            </div>
            <div className="h-3 rounded-sm bg-[#e5ebf3]">
              <div
                className="h-3 rounded-sm bg-[#0067b8]"
                style={{ width: `${Math.min(100, (m.valeur / m.max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Outils({
  data,
  moi,
  onActualiser,
}: {
  data: DonneesServeur;
  moi: { id: string; pseudo: string };
  onActualiser: () => void;
}) {
  const qc = useQueryClient();
  const [titre, setTitre] = useState("");
  const [corps, setCorps] = useState("");
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const vue = construireVue(data.reseau, moi.id);

  const executer = async (action: () => Promise<void>, succes: string) => {
    setOccupe(true);
    setMessage(null);
    try {
      await action();
      setMessage({ texte: succes, erreur: false });
      await qc.invalidateQueries({ queryKey: ["reseau"] });
      onActualiser();
    } catch (e) {
      setMessage({ texte: e instanceof Error ? e.message : "L'action a échoué.", erreur: true });
    } finally {
      setOccupe(false);
    }
  };

  const publier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim() || !corps.trim()) {
      setMessage({ texte: "Le titre et le message sont obligatoires.", erreur: true });
      return;
    }
    void executer(async () => {
      await publierAnnonce(moi.id, titre, corps);
      setTitre("");
      setCorps("");
    }, "Annonce publiée pour les élèves.");
  };

  const basculerMasque = (c: { id: string; masque: boolean }) =>
    executer(
      () => publierOrganisation(moi.id, masquerCours(vue.organisation, c.id, !c.masque)),
      c.masque ? "Cours affiché à nouveau." : "Cours masqué pour les élèves.",
    );

  const supprimer = (c: CoursReseau) => {
    if (!window.confirm(`Supprimer définitivement le cours « ${c.titre} » ?`)) return;
    void executer(() => supprimerCours(c), "Cours supprimé.");
  };

  const retirerAnnonce = (id: string, titreAnnonce: string) => {
    if (!window.confirm(`Supprimer l'annonce « ${titreAnnonce} » ?`)) return;
    void executer(() => supprimerAnnonce(id), "Annonce supprimée.");
  };

  return (
    <div className="space-y-6">
      <EnTete titre="Outils d'administration" sousTitre="Gérer le contenu du jeu pour les élèves." />
      {message && (
        <p role="status" className={`text-sm ${message.erreur ? "text-[#d13438]" : "text-[#107c10]"}`}>
          {message.texte}
        </p>
      )}
      <section>
        <h3 className="mb-2 font-semibold text-[#1f3a5f]">Publier une annonce</h3>
        <form onSubmit={publier} className="space-y-2">
          <input
            aria-label="Titre de l'annonce"
            value={titre}
            maxLength={100}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Titre (100 caractères max)"
            className="w-full rounded-sm border border-[#8a96a8] px-3 py-1.5 text-sm"
          />
          <textarea
            aria-label="Message de l'annonce"
            value={corps}
            maxLength={1000}
            onChange={(e) => setCorps(e.target.value)}
            placeholder="Message (1000 caractères max)"
            rows={3}
            className="w-full rounded-sm border border-[#8a96a8] px-3 py-1.5 text-sm"
          />
          <Bouton type="submit" disabled={occupe}>
            Publier l'annonce
          </Bouton>
        </form>
      </section>
      <section>
        <h3 className="mb-2 font-semibold text-[#1f3a5f]">Cours du réseau</h3>
        {vue.cours.length === 0 ? (
          <p className="text-sm text-[#4a5568]">Aucun cours déposé pour l'instant.</p>
        ) : (
          <Tableau entetes={["Cours", "Auteur", "Déposé le", "Actions"]}>
            {vue.cours.map((c) => (
              <Ligne key={c.id}>
                <Cellule>
                  {c.titre} {c.masque && <em className="text-[#ffb900]">(masqué)</em>}
                </Cellule>
                <Cellule>{c.auteur}</Cellule>
                <Cellule>{formaterDate(c.date)}</Cellule>
                <Cellule>
                  <div className="flex flex-wrap gap-1">
                    <Bouton disabled={occupe} onClick={() => void basculerMasque(c)}>
                      {c.masque ? "Afficher" : "Masquer"}
                    </Bouton>
                    <Bouton disabled={occupe} onClick={() => supprimer(c)}>
                      Supprimer
                    </Bouton>
                  </div>
                </Cellule>
              </Ligne>
            ))}
          </Tableau>
        )}
      </section>
      <section>
        <h3 className="mb-2 font-semibold text-[#1f3a5f]">Annonces publiées</h3>
        {data.reseau.annonces.length === 0 ? (
          <p className="text-sm text-[#4a5568]">Aucune annonce publiée.</p>
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
      </section>
    </div>
  );
}

export function Aide() {
  return (
    <div className="space-y-3 text-sm">
      <EnTete titre="Aide" sousTitre="Comment utiliser le Gestionnaire de serveur." />
      <p>
        Le Gestionnaire de serveur regroupe les informations du jeu : services, rôles, événements et performances. Les
        données sont lues en direct et s'actualisent toutes les 15 secondes.
      </p>
      <p>
        Dans <strong>Outils</strong>, tu peux publier une annonce pour les élèves, masquer ou afficher un cours, ou
        supprimer un cours ou une annonce. Ces actions sont irréversibles pour les suppressions.
      </p>
      <p>
        Le mode provisoire permet de reconnaître les admins par leur pseudo. Pour une vraie sécurité, renseigne leurs
        identifiants de compte dans <code>ADMIN_IDS</code> (fichier admins.ts).
      </p>
    </div>
  );
}
