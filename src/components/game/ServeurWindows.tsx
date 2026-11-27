import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { estAdmin } from "@/game/admins";
import type { Present } from "@/game/multijoueur";
import { useDonneesServeur } from "@/game/serveur-data";
import type { DonneesServeur } from "@/game/serveur-data";
import {
  Accueil,
  Aide,
  Bouton,
  Evenements,
  Performances,
  Services,
  ServeurLocal,
  TousServeurs,
  type Section,
} from "./ServeurPanneaux";
import { ServeurGestion } from "./ServeurGestion";

type Entree = { id: Section; libelle: string };

/** Navigation principale, comme l'arbre de gauche du Gestionnaire de serveur. */
const NAVIGATION: Array<{ titre?: string; entrees: Entree[] }> = [
  {
    entrees: [
      { id: "accueil", libelle: "Tableau de bord" },
      { id: "local", libelle: "Serveur local" },
      { id: "tous", libelle: "Tous les serveurs" },
    ],
  },
  {
    titre: "Rôles et fonctionnalités",
    entrees: [
      { id: "cours", libelle: "Cours" },
      { id: "quiz", libelle: "Quiz" },
      { id: "fiches", libelle: "Fiches de révision" },
      { id: "annonces", libelle: "Annonces" },
      { id: "categories", libelle: "Catégories" },
    ],
  },
  {
    titre: "Gestion",
    entrees: [
      { id: "eleves", libelle: "Élèves" },
      { id: "services", libelle: "Services" },
      { id: "evenements", libelle: "Événements" },
      { id: "performances", libelle: "Performances" },
      { id: "aide", libelle: "Aide" },
    ],
  },
];

/** Outils du menu « Outils » : ouverts dans une fenêtre, classés par ordre alphabétique comme sous Windows. */
const OUTILS: Entree[] = ([
  { id: "annonces", libelle: "Gestion des annonces" },
  { id: "categories", libelle: "Gestion des catégories" },
  { id: "cours", libelle: "Gestion des cours" },
  { id: "eleves", libelle: "Gestion des élèves" },
  { id: "fiches", libelle: "Gestion des fiches" },
  { id: "quiz", libelle: "Gestion des quiz" },
  { id: "evenements", libelle: "Journal des événements" },
  { id: "performances", libelle: "Moniteur de performances" },
  { id: "services", libelle: "Services" },
] as Entree[]).sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));

const LIBELLES: Record<Section, string> = Object.fromEntries(
  [...NAVIGATION.flatMap((g) => g.entrees), ...OUTILS].map((e) => [e.id, e.libelle]),
) as Record<Section, string>;

/** Fenêtre du Gestionnaire de serveur. Réservée aux admins. */
export function ServeurWindows({
  moi,
  presents,
  onFermer,
}: {
  moi: { id: string; pseudo: string };
  presents: Present[];
  onFermer: () => void;
}) {
  if (!estAdmin({ id: moi.id, pseudo: moi.pseudo })) {
    return (
      <Cadre onFermer={onFermer}>
        <div role="alert" className="flex flex-col items-center gap-3 bg-white p-10 text-center text-[#1e1e1e]">
          <p className="text-[20px] font-light">Accès refusé</p>
          <p className="max-w-md text-[13px]">
            Le Gestionnaire de serveur est réservé aux administrateurs d'ISITECH WORLD. Demande l'accès à un admin si tu en
            as besoin.
          </p>
          <Bouton onClick={onFermer}>OK</Bouton>
        </div>
      </Cadre>
    );
  }
  return <GestionnaireActif moi={moi} presents={presents} onFermer={onFermer} />;
}

type MenuOuvert = "gerer" | "outils" | "afficher" | "aide" | null;

function GestionnaireActif({
  moi,
  presents,
  onFermer,
}: {
  moi: { id: string; pseudo: string };
  presents: Present[];
  onFermer: () => void;
}) {
  const [section, setSection] = useState<Section>("accueil");
  const [outil, setOutil] = useState<Section | null>(null);
  const [menu, setMenu] = useState<MenuOuvert>(null);
  const qc = useQueryClient();
  const donnees = useDonneesServeur(true);

  const actualiser = () => {
    void qc.invalidateQueries({ queryKey: ["serveur-admin"] });
    void qc.invalidateQueries({ queryKey: ["reseau"] });
    void qc.invalidateQueries({ queryKey: ["serveur-eleves"] });
  };
  const aller = (s: Section) => {
    setSection(s);
    setMenu(null);
  };
  const ouvrirOutil = (s: Section) => {
    setOutil(s);
    setMenu(null);
  };
  const basculer = (m: Exclude<MenuOuvert, null>) => setMenu((o) => (o === m ? null : m));

  const contenu = (s: Section, d: DonneesServeur) => {
    switch (s) {
      case "accueil":
        return <Accueil data={d} presents={presents} aller={aller} ouvrirOutil={ouvrirOutil} />;
      case "local":
        return <ServeurLocal data={d} presents={presents} aller={aller} ouvrirOutil={ouvrirOutil} onActualiser={actualiser} />;
      case "tous":
        return <TousServeurs data={d} presents={presents} />;
      case "services":
        return <Services data={d} onActualiser={actualiser} />;
      case "evenements":
        return <Evenements data={d} />;
      case "performances":
        return <Performances data={d} presents={presents} />;
      case "aide":
        return <Aide />;
      default:
        return <ServeurGestion section={s} data={d} moi={moi} presents={presents} />;
    }
  };

  const corps = (() => {
    if (donnees.isLoading) return <p className="text-[13px] text-[#505050]">Lecture de l'état du serveur…</p>;
    if (donnees.isError || !donnees.data)
      return (
        <p role="alert" className="text-[13px] text-[#c50f1f]">
          Impossible de lire l'état du serveur : {donnees.error instanceof Error ? donnees.error.message : "erreur inconnue"}.
        </p>
      );
    return contenu(section, donnees.data);
  })();

  return (
    <Cadre onFermer={onFermer}>
      <header className="flex flex-wrap items-center gap-3 bg-[#2d2d2d] px-5 py-3 text-white">
        <p className="mr-auto text-[20px] font-light">
          Gestionnaire de serveur <span className="mx-1 text-[#9a9a9a]">▸</span> {LIBELLES[section]}
        </p>
        <button
          type="button"
          onClick={actualiser}
          aria-label="Actualiser les données"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#8a8886] text-[16px] hover:bg-[#3a3a3a]"
        >
          ⟳
        </button>
        <nav aria-label="Menu principal" className="relative flex items-center text-[13px]">
          <MenuBarre
            libelle="Gérer"
            ouvert={menu === "gerer"}
            onBascule={() => basculer("gerer")}
            items={[
              { libelle: "Actualiser les données", action: actualiser },
              { libelle: "Ajouter des rôles et fonctionnalités", action: () => ouvrirOutil("cours") },
              { libelle: "Gérer les élèves", action: () => ouvrirOutil("eleves") },
              { libelle: "Publier une annonce", action: () => ouvrirOutil("annonces") },
            ]}
          />
          <MenuBarre
            libelle="Outils"
            ouvert={menu === "outils"}
            onBascule={() => basculer("outils")}
            items={OUTILS.map((o) => ({ libelle: o.libelle, action: () => ouvrirOutil(o.id) }))}
          />
          <MenuBarre
            libelle="Afficher"
            ouvert={menu === "afficher"}
            onBascule={() => basculer("afficher")}
            items={[
              { libelle: "Tableau de bord", action: () => aller("accueil") },
              { libelle: "Serveur local", action: () => aller("local") },
              { libelle: "Tous les serveurs", action: () => aller("tous") },
            ]}
          />
          <MenuBarre
            libelle="Aide"
            ouvert={menu === "aide"}
            onBascule={() => basculer("aide")}
            items={[
              { libelle: "Aide du gestionnaire", action: () => aller("aide") },
              { libelle: "Tableau de bord", action: () => aller("accueil") },
            ]}
          />
        </nav>
      </header>
      <div className="flex min-h-[540px]">
        <nav aria-label="Navigation du serveur" className="w-60 shrink-0 overflow-y-auto border-r border-[#d6d6d6] bg-white py-2">
          {NAVIGATION.map((g, i) => (
            <div key={i} className={i > 0 ? "mt-3" : ""}>
              {g.titre && <p className="px-4 pb-1 pt-2 text-[12px] text-[#505050]">{g.titre}</p>}
              {g.entrees.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => aller(e.id)}
                  aria-current={section === e.id ? "page" : undefined}
                  className={`flex w-full items-center gap-2 px-4 py-1.5 text-left text-[13px] ${
                    section === e.id ? "bg-[#0078d4] text-white" : "text-[#1e1e1e] hover:bg-[#e5f1fb]"
                  }`}
                >
                  {e.libelle}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <main className="relative min-w-0 flex-1 overflow-y-auto bg-white p-6">
          {corps}
          {outil && (
            <FenetreOutil titre={LIBELLES[outil]} onFermer={() => setOutil(null)} onActualiser={actualiser}>
              {donnees.data && contenu(outil, donnees.data)}
            </FenetreOutil>
          )}
        </main>
      </div>
    </Cadre>
  );
}

/** Menu de la barre sombre (Gérer, Outils, Afficher, Aide). */
function MenuBarre({
  libelle,
  ouvert,
  onBascule,
  items,
}: {
  libelle: string;
  ouvert: boolean;
  onBascule: () => void;
  items: Array<{ libelle: string; action: () => void }>;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        role="menuitem"
        aria-expanded={ouvert}
        onClick={onBascule}
        className={`px-3 py-1.5 hover:bg-[#3a3a3a] ${ouvert ? "bg-[#0078d4]" : ""}`}
      >
        {libelle}
      </button>
      {ouvert && (
        <ul role="menu" className="absolute right-0 top-full z-30 mt-px min-w-[300px] border border-[#8a8886] bg-white py-1 text-[#1e1e1e] shadow-lg">
          {items.map((i) => (
            <li key={i.libelle} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onBascule();
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

/** Fenêtre d'outil façon console MMC : barre de titre, menu Fichier / Action, puis le module. */
function FenetreOutil({
  titre,
  onFermer,
  onActualiser,
  children,
}: {
  titre: string;
  onFermer: () => void;
  onActualiser: () => void;
  children: React.ReactNode;
}) {
  const [menu, setMenu] = useState<"fichier" | "action" | null>(null);
  return (
    <div role="dialog" aria-label={titre} className="absolute inset-3 z-20 flex flex-col border border-[#8a8886] bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#d6d6d6] bg-white px-3 py-1 text-[13px]">
        <span>{titre} — Gestionnaire de serveur</span>
        <button type="button" aria-label={`Fermer ${titre}`} onClick={onFermer} className="px-2 hover:bg-[#c50f1f] hover:text-white">
          ✕
        </button>
      </div>
      <div className="relative flex gap-1 border-b border-[#d6d6d6] px-2 py-1 text-[13px]">
        <button type="button" onClick={() => setMenu(menu === "fichier" ? null : "fichier")} className="px-2 py-0.5 hover:bg-[#e5f1fb]">
          Fichier
        </button>
        <button type="button" onClick={() => setMenu(menu === "action" ? null : "action")} className="px-2 py-0.5 hover:bg-[#e5f1fb]">
          Action
        </button>
        {menu === "fichier" && (
          <ul className="absolute left-2 top-full z-30 border border-[#8a8886] bg-white py-1 shadow-md">
            <li>
              <button type="button" onClick={onFermer} className="block w-56 px-4 py-1.5 text-left hover:bg-[#e5f1fb]">
                Fermer la fenêtre
              </button>
            </li>
          </ul>
        )}
        {menu === "action" && (
          <ul className="absolute left-16 top-full z-30 border border-[#8a8886] bg-white py-1 shadow-md">
            <li>
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  onActualiser();
                }}
                className="block w-56 px-4 py-1.5 text-left hover:bg-[#e5f1fb]"
              >
                Actualiser
              </button>
            </li>
          </ul>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </div>
  );
}

/** Cadre de la fenêtre principale : barre de titre claire et bouton de fermeture. */
function Cadre({ children, onFermer }: { children: React.ReactNode; onFermer: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Gestionnaire de serveur"
      className="mx-auto w-full max-w-[1100px] overflow-hidden border border-[#8a8886] bg-white font-['Segoe_UI',system-ui,sans-serif] text-[#1e1e1e] shadow-xl"
    >
      <div className="flex items-center justify-between bg-white px-3 py-1.5 text-[13px]">
        <span>Gestionnaire de serveur</span>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer le Gestionnaire de serveur"
          className="px-3 py-0.5 hover:bg-[#c50f1f] hover:text-white"
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}
