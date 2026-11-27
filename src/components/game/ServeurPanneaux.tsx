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

export const BLEU = "#0078d4";
export const VERT = "#107c10";
export const ROUGE = "#c50f1f";
export const AMBRE = "#9d5d00";

export const COULEUR_ETAT: Record<EtatService, string> = { "En cours": VERT, Lent: AMBRE, Arrêté: ROUGE };
export const COULEUR_NIVEAU: Record<NiveauVerification, string> = { Réussi: VERT, Avertissement: AMBRE, Erreur: ROUGE };

export function Pastille({ couleur }: { couleur: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: couleur }} aria-hidden />;
}

/** Titre de page : grand, fin, avec sous-titre discret (style Gestionnaire de serveur). */
export function EnTete({ titre, sousTitre, action }: { titre: string; sousTitre: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[22px] font-light text-[#1e1e1e]">{titre}</h2>
        <p className="text-[13px] text-[#505050]">{sousTitre}</p>
      </div>
      {action}
    </div>
  );
}

export const Bouton = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    {...props}
    className={`border border-[#8a8886] bg-[#fdfdfd] px-3 py-1 text-[13px] text-[#1e1e1e] hover:bg-[#e5f1fb] disabled:opacity-50 ${props.className ?? ""}`}
  />
);

export const Tableau = ({ entetes, children }: { entetes: string[]; children: React.ReactNode }) => (
  <div className="overflow-x-auto border border-[#d6d6d6] bg-white">
    <table className="w-full border-collapse text-left text-[13px]">
      <thead className="bg-[#f3f3f3] text-[#1e1e1e]">
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
  <tr className="border-b border-[#ededed] align-top hover:bg-[#e5f1fb]">{children}</tr>
);
export const Cellule = ({ children }: { children: React.ReactNode }) => <td className="px-3 py-1.5">{children}</td>;

/** Bouton déroulant « TÂCHES » (menu d'actions sur une page). */
export function MenuDeroulant({ libelle, items }: { libelle: string; items: Array<{ libelle: string; action: () => void }> }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="relative inline-block">
      <Bouton aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
        {libelle} ▾
      </Bouton>
      {ouvert && (
        <ul role="menu" className="absolute right-0 z-20 mt-1 min-w-[280px] border border-[#8a8886] bg-white py-1 shadow-md">
          {items.map((i) => (
            <li key={i.libelle} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOuvert(false);
                  i.action();
                }}
                className="block w-full px-4 py-1.5 text-left text-[13px] hover:bg-[#e5f1fb]"
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

/** Carte de rôle du tableau de bord : en-tête rouge si un problème existe, verte sinon, avec lignes d'état. */
export function Carte({
  titre,
  nombre,
  alerte,
  lignes,
  onOuvrir,
}: {
  titre: string;
  nombre?: number;
  alerte: boolean;
  lignes: Array<{ libelle: string; valeur?: string; badge?: number; couleur?: string }>;
  onOuvrir?: () => void;
}) {
  return (
    <section className="flex flex-col border border-[#d6d6d6] bg-white">
      <header
        className={`flex items-center justify-between gap-2 px-4 py-2 ${alerte ? "bg-[#b10e1c] text-white" : "border-b-[3px] border-[#107c10] text-[#1e1e1e]"}`}
      >
        <button type="button" onClick={onOuvrir} className="text-left text-[15px] font-semibold hover:underline">
          {titre}
        </button>
        {nombre !== undefined && <span className="text-[18px] font-light">{nombre}</span>}
      </header>
      <ul className="divide-y divide-[#ededed]">
        {lignes.map((l) => (
          <li key={l.libelle} className="flex items-center justify-between gap-2 px-4 py-2 text-[13px]">
            <span className="flex items-center gap-2 text-[#1e1e1e]">
              {l.couleur && <Pastille couleur={l.couleur} />}
              {l.libelle}
            </span>
            <span className="flex items-center gap-2">
              {l.badge !== undefined && l.badge > 0 && (
                <span className="min-w-[20px] bg-[#c50f1f] px-1 text-center text-[12px] font-semibold text-white">{l.badge}</span>
              )}
              {l.valeur && <span className="text-[#0067b8]">{l.valeur}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
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

/** Tableau de bord : bloc de bienvenue avec pastilles colorées, puis cartes des rôles du serveur. */
export function Accueil({
  data,
  presents,
  aller,
  ouvrirOutil,
}: {
  data: DonneesServeur;
  presents: Present[];
  aller: (s: Section) => void;
  ouvrirOutil: (s: Section) => void;
}) {
  const c = compte(data);
  const r = data.reseau;
  const etapes: Array<{ libelle: string; action: () => void }> = [
    { libelle: "Configurer ce serveur local", action: () => aller("local") },
    { libelle: "Ajouter des rôles et fonctionnalités", action: () => ouvrirOutil("cours") },
    { libelle: "Afficher les autres serveurs", action: () => aller("tous") },
  ];
  const evenementsDe = (source: string) => data.evenements.filter((e) => e.source === source).length;
  const roles: Array<{ id: Section; titre: string; nombre: number; source: string }> = [
    { id: "cours", titre: "Serveur de cours", nombre: r.cours.length, source: "Réseau cours" },
    { id: "quiz", titre: "Serveur de quiz", nombre: r.quiz.length, source: "Quiz" },
    { id: "fiches", titre: "Serveur de fiches", nombre: r.fiches.length, source: "Fiches de révision" },
    { id: "annonces", titre: "Serveur d'annonces", nombre: r.annonces.length, source: "Annonces" },
  ];
  const localAlerte = c.erreurs > 0 || c.arretes > 0;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] tracking-wide text-[#505050]">BIENVENUE DANS LE GESTIONNAIRE DE SERVEUR</p>
        <div className="mt-3 flex border border-[#d6d6d6] bg-white">
          <div className="flex w-40 shrink-0 flex-col text-[12px] font-semibold tracking-wide text-white">
            <button type="button" onClick={() => aller("tous")} className="flex-1 bg-[#e8702a] p-3 text-left hover:brightness-95">
              DÉMARRAGE RAPIDE
            </button>
            <button type="button" onClick={() => aller("evenements")} className="flex-1 bg-[#f2a33a] p-3 text-left hover:brightness-95">
              NOUVEAUTÉS
            </button>
            <button type="button" onClick={() => aller("aide")} className="flex-1 bg-[#f5b74b] p-3 text-left hover:brightness-95">
              EN SAVOIR PLUS
            </button>
          </div>
          <ol className="flex-1 space-y-4 p-6">
            {etapes.map((e, i) => (
              <li key={e.libelle}>
                <button type="button" onClick={e.action} className="flex items-center gap-4 text-left">
                  <span
                    className={`flex shrink-0 items-center justify-center rounded-full text-white ${
                      i === 0 ? "h-10 w-10 bg-[#e8502c] text-[18px]" : "h-6 w-6 bg-[#8a8886] text-[12px]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={i === 0 ? "text-[20px] text-[#2b6cb0]" : "text-[14px] text-[#505050] hover:text-[#0078d4]"}>
                    {e.libelle}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div>
        <p className="text-[12px] tracking-wide text-[#505050]">RÔLES ET GROUPES DE SERVEURS</p>
        <p className="text-[12px] text-[#505050]">
          Rôles : {roles.length + 1} &nbsp;|&nbsp; Groupes de serveurs : 1 &nbsp;|&nbsp; Serveurs au total : 1
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <Carte
            titre="Serveur local"
            alerte={localAlerte}
            onOuvrir={() => aller("local")}
            lignes={[
              { libelle: "Gestionnabilité", valeur: c.arretes > 0 ? "Hors ligne" : "En ligne", couleur: c.arretes > 0 ? ROUGE : VERT },
              { libelle: "Événements", valeur: `${data.evenements.length}` },
              { libelle: "Services", badge: c.arretes + c.lents },
              { libelle: "Performances", valeur: data.mesures.latenceMs === null ? "—" : `${data.mesures.latenceMs} ms` },
              { libelle: "Résultats BPA", badge: c.erreurs + c.avert },
            ]}
          />
          {roles.map((r) => (
            <Carte
              key={r.id}
              titre={r.titre}
              nombre={r.nombre}
              alerte={false}
              onOuvrir={() => ouvrirOutil(r.id)}
              lignes={[
                { libelle: "Gestionnabilité", valeur: "En ligne", couleur: VERT },
                { libelle: "Événements", valeur: `${evenementsDe(r.source)}` },
                { libelle: "Présents dans le monde", valeur: `${presents.length}` },
              ]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Page « Serveur local » : propriétés en deux colonnes, menu TÂCHES, et tuiles de synthèse. */
export function ServeurLocal({
  data,
  presents,
  aller,
  ouvrirOutil,
  onActualiser,
}: {
  data: DonneesServeur;
  presents: Present[];
  aller: (s: Section) => void;
  ouvrirOutil: (s: Section) => void;
  onActualiser: () => void;
}) {
  const m = data.mesures;
  const c = compte(data);
  const proprietes: Array<[string, string]> = [
    ["Nom de l'ordinateur", "ISITECH-SRV22"],
    ["Groupe de travail", "ISITECH"],
    ["Pare-feu", "Actif"],
    ["Gestion à distance", "Activée"],
    ["Mode d'administration", m.provisoire ? "Provisoire (pseudos)" : "Stable (identifiants de compte)"],
    ["Élèves connectés", String(presents.length)],
    ["Comptes enregistrés", String(m.nbProfils)],
    ["Temps réel", m.tempsReelOk ? "Ouvert" : "Fermé"],
    ["Génération IA", m.iaConfiguree ? "Configurée" : "Absente"],
    ["Système", "Windows Server 2022 Standard (jeu)"],
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[22px] font-light text-[#1e1e1e]">ISITECH-SRV22</h2>
          <p className="text-[13px] text-[#505050]">Propriétés du serveur et état des rôles.</p>
        </div>
        <MenuDeroulant
          libelle="TÂCHES"
          items={[
            { libelle: "Actualiser les données", action: onActualiser },
            { libelle: "Gérer les cours", action: () => ouvrirOutil("cours") },
            { libelle: "Publier une annonce", action: () => ouvrirOutil("annonces") },
            { libelle: "Ouvrir le journal des événements", action: () => ouvrirOutil("evenements") },
            { libelle: "Gérer les élèves", action: () => ouvrirOutil("eleves") },
          ]}
        />
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-[#0067b8]">PROPRIÉTÉS</h3>
          <dl className="divide-y divide-[#ededed] border-y border-[#ededed] text-[13px]">
            {proprietes.map(([p, v]) => (
              <div key={p} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 py-1.5">
                <dt className="text-[#1e1e1e]">{p}</dt>
                <dd className="text-[#0067b8]">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-[#0067b8]">MEILLEURES PRATIQUES</h3>
          <ul className="divide-y divide-[#ededed] border-y border-[#ededed] text-[13px]">
            {data.verifications.map((v) => (
              <li key={v.titre} className="flex items-start gap-2 py-2">
                <Pastille couleur={COULEUR_NIVEAU[v.niveau]} />
                <span>
                  <strong className="font-semibold">{v.titre}</strong> : {v.message}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Carte titre="Événements" nombre={data.evenements.length} alerte={false} onOuvrir={() => ouvrirOutil("evenements")} lignes={[{ libelle: "Dernier", valeur: data.evenements[0] ? formaterDate(data.evenements[0].date) : "aucun" }]} />
        <Carte titre="Services" nombre={data.services.length} alerte={c.arretes > 0} onOuvrir={() => aller("services")} lignes={[{ libelle: "En cours", valeur: `${c.actifs}` }, { libelle: "Arrêtés", badge: c.arretes }]} />
        <Carte titre="Performances" alerte={false} onOuvrir={() => aller("performances")} lignes={[{ libelle: "Réponse", valeur: m.latenceMs === null ? "—" : `${m.latenceMs} ms` }]} />
        <Carte titre="Résultats BPA" alerte={c.erreurs > 0} onOuvrir={() => aller("local")} lignes={[{ libelle: "Avertissements", badge: c.avert }, { libelle: "Erreurs", badge: c.erreurs }]} />
      </div>
      <section>
        <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-[#0067b8]">ÉVÉNEMENTS RÉCENTS</h3>
        <Evenements data={data} limite={8} />
      </section>
    </div>
  );
}

/** Liste « Tous les serveurs » : un tableau avec les colonnes du Gestionnaire de serveur. */
export function TousServeurs({ data, presents }: { data: DonneesServeur; presents: Present[] }) {
  const c = compte(data);
  const etat: EtatService = c.arretes > 0 ? "Arrêté" : c.lents > 0 ? "Lent" : "En cours";
  return (
    <div className="space-y-4">
      <EnTete titre="Tous les serveurs" sousTitre="Serveurs gérés par ce gestionnaire." />
      <Tableau entetes={["Nom du serveur", "Gestionnabilité", "Dernière mise à jour", "Services en cours", "Élèves connectés"]}>
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
                  <Pastille couleur={e.niveau === "Avertissement" ? AMBRE : BLEU} />
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
              <div className="h-2.5 bg-[#0078d4]" style={{ width: `${Math.min(100, (m.valeur / m.max) * 100)}%` }} />
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
        Le menu <strong>Outils</strong> ouvre les modules de gestion dans une fenêtre, comme les outils d'administration de
        Windows Server. Les modules <strong>Gestion des cours</strong>, <strong>des quiz</strong>, <strong>des catégories</strong>,{" "}
        <strong>des annonces</strong> et <strong>des élèves</strong> agissent directement sur le contenu du jeu.
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
