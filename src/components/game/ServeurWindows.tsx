import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { estAdmin } from "@/game/admins";
import type { Present } from "@/game/multijoueur";
import { useDonneesServeur } from "@/game/serveur-data";
import { Accueil, Aide, Evenements, Performances, Services, ServeurLocal, TousServeurs, type Section } from "./ServeurPanneaux";
import { ServeurGestion } from "./ServeurGestion";

type Entree = { id: Section; libelle: string };
type Groupe = { titre: string; entrees: Entree[] };

const GROUPES: Groupe[] = [
  {
    titre: "Serveur",
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

const LIBELLES: Record<Section, string> = Object.fromEntries(
  GROUPES.flatMap((g) => g.entrees.map((e) => [e.id, e.libelle])),
) as Record<Section, string>;

/** Fenêtre du Gestionnaire de serveur. Réservée aux admins (contrôle côté interface et côté serveur pour l'IA). */
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
        <div role="alert" className="flex flex-col items-center gap-3 bg-[#f3f3f3] p-10 text-center text-[#1e1e1e]">
          <p className="text-[18px] font-light">Accès refusé</p>
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
  const [menu, setMenu] = useState<"gerer" | "outils" | "aide" | null>(null);
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

  const corps = (() => {
    if (donnees.isLoading) return <p className="text-[13px] text-[#505050]">Lecture de l'état du serveur…</p>;
    if (donnees.isError || !donnees.data)
      return (
        <p role="alert" className="text-[13px] text-[#c42b1c]">
          Impossible de lire l'état du serveur : {donnees.error instanceof Error ? donnees.error.message : "erreur inconnue"}.
        </p>
      );
    const d = donnees.data;
    switch (section) {
      case "accueil":
        return <Accueil data={d} presents={presents} aller={aller} />;
      case "local":
        return <ServeurLocal data={d} presents={presents} aller={aller} onActualiser={actualiser} />;
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
      case "cours":
      case "quiz":
      case "fiches":
      case "annonces":
      case "categories":
      case "eleves":
        return <ServeurGestion section={section} data={d} moi={moi} presents={presents} />;
    }
  })();

  return (
    <Cadre onFermer={onFermer}>
      <div className="flex items-center gap-1 border-b border-[#d6d6d6] bg-white px-2 text-[13px]" role="menubar">
        <MenuBarre libelle="Gérer" ouvert={menu === "gerer"} onBascule={() => setMenu(menu === "gerer" ? null : "gerer")}
          items={[
            { libelle: "Actualiser les données", action: actualiser },
            { libelle: "Ajouter des rôles et fonctionnalités", action: () => aller("cours") },
            { libelle: "Gérer les élèves", action: () => aller("eleves") },
            { libelle: "Publier une annonce", action: () => aller("annonces") },
          ]}
        />
        <MenuBarre libelle="Outils" ouvert={menu === "outils"} onBascule={() => setMenu(menu === "outils" ? null : "outils")}
          items={GROUPES[1]!.entrees.concat(GROUPES[2]!.entrees.filter((e) => e.id !== "aide")).map((e) => ({
            libelle: e.libelle,
            action: () => aller(e.id),
          }))}
        />
        <MenuBarre libelle="Aide" ouvert={menu === "aide"} onBascule={() => setMenu(menu === "aide" ? null : "aide")}
          items={[
            { libelle: "Aide du gestionnaire", action: () => aller("aide") },
            { libelle: "Tableau de bord", action: () => aller("accueil") },
          ]}
        />
      </div>
      <div className="flex min-h-[500px]">
        <nav aria-label="Navigation du serveur" className="w-60 shrink-0 overflow-y-auto border-r border-[#d6d6d6] bg-white py-2">
          {GROUPES.map((g) => (
            <div key={g.titre} className="mb-2">
              <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#505050]">{g.titre}</p>
              {g.entrees.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => aller(e.id)}
                  aria-current={section === e.id ? "page" : undefined}
                  className={`block w-full px-4 py-1.5 text-left text-[13px] ${
                    section === e.id
                      ? "bg-[#e8f1fb] font-semibold text-[#0067c0] shadow-[inset_3px_0_0_#0067c0]"
                      : "text-[#1e1e1e] hover:bg-[#f0f6fc]"
                  }`}
                >
                  {e.libelle}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <main className="min-w-0 flex-1 overflow-y-auto bg-[#f3f3f3] p-5">
          <p className="mb-3 text-[12px] text-[#505050]">
            Gestionnaire de serveur › ISITECH-SRV22 › <span className="text-[#1e1e1e]">{LIBELLES[section]}</span>
          </p>
          {corps}
        </main>
      </div>
    </Cadre>
  );
}

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
        className={`px-3 py-1.5 hover:bg-[#f0f6fc] ${ouvert ? "bg-[#e8f1fb]" : ""}`}
      >
        {libelle}
      </button>
      {ouvert && (
        <ul role="menu" className="absolute left-0 z-20 min-w-[260px] border border-[#8a8886] bg-white py-1 shadow-md">
          {items.map((i) => (
            <li key={i.libelle} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onBascule();
                  i.action();
                }}
                className="block w-full px-4 py-1.5 text-left hover:bg-[#f0f6fc]"
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

function Bouton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="border border-[#8a8886] bg-[#fdfdfd] px-4 py-1 text-[13px] hover:bg-[#f0f6fc] disabled:opacity-50"
    />
  );
}

/** Cadre de fenêtre : barre de titre claire, bouton de fermeture, bordure sobre. */
function Cadre({ children, onFermer }: { children: React.ReactNode; onFermer: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Gestionnaire de serveur"
      className="mx-auto w-full max-w-[1040px] overflow-hidden border border-[#8a8886] bg-white font-['Segoe_UI',system-ui,sans-serif] text-[#1e1e1e] shadow-xl"
    >
      <div className="flex items-center justify-between bg-white px-3 py-1.5 text-[13px] text-[#1e1e1e]">
        <span>Gestionnaire de serveur</span>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer le Gestionnaire de serveur"
          className="px-3 py-0.5 hover:bg-[#c42b1c] hover:text-white"
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}
