import { useState } from "react";
import { formaterDate } from "@/game/reseau";
import { SEUIL_LENT_MS, type EtatService, type NiveauVerification } from "@/game/serveur";
import type { DonneesServeur } from "@/game/serveur-data";
import type { Present } from "@/game/multijoueur";

export type Section =
  | "accueil"
  | "local"
  | "tous"
  | "cours"
  | "quiz"
  | "fiches"
  | "annonces"
  | "categories"
  | "eleves"
  | "services"
  | "evenements"
  | "performances"
  | "aide";

export const COULEUR_ETAT: Record<EtatService, string> = { "En cours": "#107c10", Lent: "#9d5d00", Arrêté: "#c42b1c" };
export const COULEUR_NIVEAU: Record<NiveauVerification, string> = {
  Réussi: "#107c10",
  Avertissement: "#9d5d00",
  Erreur: "#c42b1c",
};

export function Pastille({ couleur }: { couleur: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: couleur }} aria-hidden />;
}

export function EnTete({ titre, sousTitre, action }: { titre: string; sousTitre: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-[#d6d6d6] pb-3">
      <div>
        <h2 className="text-[22px] font-light text-[#1e1e1e]">{titre}</h2>
        <p className="text-[13px] text-[#505050]">{sousTitre}</p>
      </div>
      {action}
    </div>
  );
}

/** Tuile du tableau de bord : en-tête en majuscules bleu, lien optionnel vers la section. */
export function Tuile({
  titre,
  onOuvrir,
  children,
}: {
  titre: string;
  onOuvrir?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col border border-[#d6d6d6] bg-white">
      <header className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-2">
        <h3 className="text-[12px] font-semibold tracking-wide text-[#0067c0]">{titre}</h3>
        {onOuvrir && (
          <button type="button" onClick={onOuvrir} className="text-[12px] text-[#0067c0] hover:underline">
            Ouvrir
          </button>
        )}
      </header>
      <div className="flex-1 p-4 text-[13px]">{children}</div>
    </section>
  );
}

export const Bouton = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    {...props}
    className={`border border-[#8a8886] bg-[#fdfdfd] px-3 py-1 text-[13px] text-[#1e1e1e] hover:bg-[#f0f6fc] disabled:opacity-50 ${props.className ?? ""}`}
  />
);

export const Tableau = ({ entetes, children }: { entetes: string[]; children: React.ReactNode }) => (
  <div className="overflow-x-auto border border-[#d6d6d6] bg-white">
    <table className="w-full border-collapse text-left text-[13px]">
      <thead className="bg-[#f5f5f5] text-[#1e1e1e]">
        <tr>
          {entetes.map((e) => (
            <th key={e} className="border-b border-[#d6d6d6] px-3 py-1.5 font-semibold">
              {e}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);
export const Ligne = ({ children }: { children: React.ReactNode }) => (
  <tr className="border-b border-[#ededed] align-top hover:bg-[#f0f6fc]">{children}</tr>
);
export const Cellule = ({ children }: { children: React.ReactNode }) => <td className="px-3 py-1.5">{children}</td>;

/** Bouton déroulant (menu de tâches, comme « TÂCHES » dans le Gestionnaire de serveur). */
export function MenuDeroulant({
  libelle,
  items,
}: {
  libelle: string;
  items: Array<{ libelle: string; action: () => void }>;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="relative inline-block">
      <Bouton aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
        {libelle} ▾
      </Bouton>
      {ouvert && (
        <ul role="menu" className="absolute right-0 z-10 mt-1 min-w-[240px] border border-[#8a8886] bg-white py-1 shadow-md">
          {items.map((i) => (
            <li key={i.libelle} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOuvert(false);
                  i.action();
                }}
                className="block w-full px-4 py-1.5 text-left text-[13px] hover:bg-[#f0f6fc]"
              >
                {i.libelle}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const compte = (d: DonneesServeur) => ({
  actifs: d.services.filter((s) => s.etat === "En cours").length,
  lents: d.services.filter((s) => s.etat === "Lent").length,
  arretes: d.services.filter((s) => s.etat === "Arrêté").length,
  avert: d.verifications.filter((v) => v.niveau === "Avertissement").length,
  erreurs: d.verifications.filter((v) => v.niveau === "Erreur").length,
  reussis: d.verifications.filter((v) => v.niveau === "Réussi").length,
});

export function Accueil({ data, presents, aller }: { data: DonneesServeur; presents: Present[]; aller: (s: Section) => void }) {
  const c = compte(data);
  const r = data.reseau;
  const etapes: Array<{ libelle: string; vers: Section }> = [
    { libelle: "Configurer ce serveur local", vers: "local" },
    { libelle: "Ajouter des rôles et fonctionnalités", vers: "cours" },
    { libelle: "Afficher tous les serveurs", vers: "tous" },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section className="border border-[#d6d6d6] bg-white md:col-span-2">
        <div className="border-b border-[#e5e5e5] px-4 py-3">
          <h2 className="text-[18px] font-light text-[#1e1e1e]">Bienvenue dans le Gestionnaire de serveur</h2>
          <p className="text-[13px] text-[#505050]">Ce serveur héberge les cours, quiz, fiches et annonces d'ISITECH WORLD.</p>
        </div>
        <ol className="grid gap-px bg-[#e5e5e5] md:grid-cols-3">
          {etapes.map((e, i) => (
            <li key={e.libelle} className="bg-white">
              <button type="button" onClick={() => aller(e.vers)} className="flex h-full w-full items-start gap-3 p-4 text-left hover:bg-[#f0f6fc]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#0067c0] text-[13px] text-[#0067c0]">
                  {i + 1}
                </span>
                <span className="text-[13px] text-[#0067c0]">{e.libelle}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
      <Tuile titre="RÔLES ET FONCTIONNALITÉS" onOuvrir={() => aller("cours")}>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt>Cours</dt>
          <dd className="text-right font-semibold">{r.cours.length}</dd>
          <dt>Quiz</dt>
          <dd className="text-right font-semibold">{r.quiz.length}</dd>
          <dt>Fiches de révision</dt>
          <dd className="text-right font-semibold">{r.fiches.length}</dd>
          <dt>Annonces</dt>
          <dd className="text-right font-semibold">{r.annonces.length}</dd>
        </dl>
      </Tuile>
      <Tuile titre="SERVICES" onOuvrir={() => aller("services")}>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className="flex items-center gap-2"><Pastille couleur={COULEUR_ETAT["En cours"]} />En cours</dt>
          <dd className="text-right font-semibold">{c.actifs}</dd>
          <dt className="flex items-center gap-2"><Pastille couleur={COULEUR_ETAT.Lent} />Lents</dt>
          <dd className="text-right font-semibold">{c.lents}</dd>
          <dt className="flex items-center gap-2"><Pastille couleur={COULEUR_ETAT["Arrêté"]} />Arrêtés</dt>
          <dd className="text-right font-semibold">{c.arretes}</dd>
        </dl>
      </Tuile>
      <Tuile titre="PERFORMANCES" onOuvrir={() => aller("performances")}>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt>Élèves connectés</dt>
          <dd className="text-right font-semibold">{presents.length}</dd>
          <dt>Comptes</dt>
          <dd className="text-right font-semibold">{data.mesures.nbProfils}</dd>
          <dt>Réponse de la base</dt>
          <dd className="text-right font-semibold">{data.mesures.latenceMs === null ? "—" : `${data.mesures.latenceMs} ms`}</dd>
        </dl>
      </Tuile>
      <Tuile titre="MEILLEURES PRATIQUES" onOuvrir={() => aller("local")}>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className="flex items-center gap-2"><Pastille couleur={COULEUR_NIVEAU.Réussi} />Réussies</dt>
          <dd className="text-right font-semibold">{c.reussis}</dd>
          <dt className="flex items-center gap-2"><Pastille couleur={COULEUR_NIVEAU.Avertissement} />Avertissements</dt>
          <dd className="text-right font-semibold">{c.avert}</dd>
          <dt className="flex items-center gap-2"><Pastille couleur={COULEUR_NIVEAU.Erreur} />Erreurs</dt>
          <dd className="text-right font-semibold">{c.erreurs}</dd>
        </dl>
      </Tuile>
      <Tuile titre="ÉVÉNEMENTS" onOuvrir={() => aller("evenements")}>
        <p>{data.evenements.length} événement(s) récent(s) dans le journal.</p>
        <p className="mt-2 text-[#505050]">
          Dernier : {data.evenements[0] ? `${data.evenements[0].message} (${formaterDate(data.evenements[0].date)})` : "aucun"}
        </p>
      </Tuile>
    </div>
  );
}

export function ServeurLocal({
  data,
  presents,
  aller,
  onActualiser,
}: {
  data: DonneesServeur;
  presents: Present[];
  aller: (s: Section) => void;
  onActualiser: () => void;
}) {
  const m = data.mesures;
  const proprietes: Array<[string, string]> = [
    ["Nom de l'ordinateur", "ISITECH-SRV22"],
    ["Groupe", "ISITECH"],
    ["Mode d'administration", m.provisoire ? "Provisoire (pseudos)" : "Stable (identifiants de compte)"],
    ["Gestion à distance", "Activée"],
    ["Élèves connectés", String(presents.length)],
    ["Comptes enregistrés", String(m.nbProfils)],
    ["Temps réel", m.tempsReelOk ? "Ouvert" : "Fermé"],
    ["Génération IA", m.iaConfiguree ? "Configurée" : "Absente"],
    ["Réponse de la base", m.latenceMs === null ? "Aucune réponse" : `${m.latenceMs} ms`],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-light text-[#1e1e1e]">ISITECH-SRV22</h2>
        <MenuDeroulant
          libelle="TÂCHES"
          items={[
            { libelle: "Actualiser les données", action: onActualiser },
            { libelle: "Publier une annonce", action: () => aller("annonces") },
            { libelle: "Ouvrir le journal des événements", action: () => aller("evenements") },
            { libelle: "Gérer les élèves", action: () => aller("eleves") },
          ]}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Tuile titre="PROPRIÉTÉS">
          <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-y-1.5">
            {proprietes.map(([p, v]) => (
              <div key={p} className="contents">
                <dt className="text-[#505050]">{p}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Tuile>
        <Tuile titre="MEILLEURES PRATIQUES">
          <ul className="space-y-2">
            {data.verifications.map((v) => (
              <li key={v.titre} className="flex items-start gap-2">
                <Pastille couleur={COULEUR_NIVEAU[v.niveau]} />
                <span>
                  <strong className="font-semibold">{v.titre}</strong> : {v.message}
                </span>
              </li>
            ))}
          </ul>
        </Tuile>
      </div>
      <Tuile titre="ÉVÉNEMENTS RÉCENTS" onOuvrir={() => aller("evenements")}>
        <Evenements data={data} limite={8} />
      </Tuile>
    </div>
  );
}

export function TousServeurs({ data, presents }: { data: DonneesServeur; presents: Present[] }) {
  const c = compte(data);
  const etat: EtatService = c.arretes > 0 ? "Arrêté" : c.lents > 0 ? "Lent" : "En cours";
  return (
    <div className="space-y-4">
      <EnTete titre="Tous les serveurs" sousTitre="Serveurs gérés par ce gestionnaire." />
      <Tableau entetes={["Nom du serveur", "État de gestion", "Dernière mise à jour", "Services en cours", "Élèves connectés"]}>
        <Ligne>
          <Cellule>ISITECH-SRV22</Cellule>
          <Cellule>
            <span className="flex items-center gap-2">
              <Pastille couleur={COULEUR_ETAT[etat]} />
              {etat === "En cours" ? "En ligne" : etat === "Lent" ? "Dégradé" : "Hors ligne"}
            </span>
          </Cellule>
          <Cellule>{new Date(data.mesures.horodatage).toLocaleString("fr-FR")}</Cellule>
          <Cellule>
            {c.actifs} / {data.services.length}
          </Cellule>
          <Cellule>{presents.length}</Cellule>
        </Ligne>
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
              <strong className="font-semibold">{s.nom}</strong>
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
              className="border border-[#8a8886] bg-white px-2 py-1 text-[13px]"
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
        <p className="text-[#505050]">Aucun événement pour cette source.</p>
      ) : (
        <Tableau entetes={["Date", "Niveau", "Source", "Message"]}>
          {liste.map((e) => (
            <Ligne key={e.id}>
              <Cellule>{formaterDate(e.date)}</Cellule>
              <Cellule>
                <span className="flex items-center gap-2">
                  <Pastille couleur={e.niveau === "Avertissement" ? COULEUR_NIVEAU.Avertissement : "#0067c0"} />
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

export function Performances({ data, presents }: { data: DonneesServeur; presents: Present[] }) {
  const r = data.reseau;
  const max = Math.max(r.cours.length, r.quiz.length, r.fiches.length, 1);
  const mesures: Array<{ nom: string; valeur: number; unite: string; max: number }> = [
    { nom: "Réponse de la base", valeur: data.mesures.latenceMs ?? 0, unite: " ms", max: SEUIL_LENT_MS * 2 },
    { nom: "Élèves connectés", valeur: presents.length, unite: "", max: Math.max(presents.length, data.mesures.nbProfils, 1) },
    { nom: "Comptes", valeur: data.mesures.nbProfils, unite: "", max: Math.max(data.mesures.nbProfils, 1) },
    { nom: "Cours", valeur: r.cours.length, unite: "", max },
    { nom: "Quiz", valeur: r.quiz.length, unite: "", max },
    { nom: "Fiches", valeur: r.fiches.length, unite: "", max },
  ];
  return (
    <div className="space-y-4">
      <EnTete titre="Performances" sousTitre="Mesures réelles, actualisées toutes les 15 secondes." />
      <div className="space-y-3">
        {mesures.map((m) => (
          <div key={m.nom}>
            <div className="mb-1 flex justify-between text-[13px]">
              <span>{m.nom}</span>
              <span className="font-semibold">
                {m.valeur}
                {m.unite}
              </span>
            </div>
            <div className="h-2.5 bg-[#e5e5e5]">
              <div className="h-2.5 bg-[#0067c0]" style={{ width: `${Math.min(100, (m.valeur / m.max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Aide() {
  return (
    <div className="space-y-3 text-[13px]">
      <EnTete titre="Aide" sousTitre="Utiliser le Gestionnaire de serveur d'ISITECH WORLD." />
      <p>
        Les sections <strong>Cours</strong>, <strong>Quiz</strong>, <strong>Catégories</strong>, <strong>Annonces</strong> et{" "}
        <strong>Élèves</strong> permettent de gérer directement le contenu du jeu. Les données sont relues toutes les 15
        secondes.
      </p>
      <p>
        Les suppressions sont définitives. Masquer un cours le cache aux élèves sans le supprimer. Supprimer une catégorie
        déplace ses cours dans « Autre ».
      </p>
      <p>
        Le mode provisoire reconnaît les admins par leur pseudo. Pour une vraie sécurité, renseigne leurs identifiants de
        compte dans <code>ADMIN_IDS</code> (fichier admins.ts).
      </p>
    </div>
  );
}
