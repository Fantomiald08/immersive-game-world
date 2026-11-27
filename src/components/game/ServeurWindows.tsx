import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { estAdmin } from "@/game/admins";
import { useDonneesServeur } from "@/game/serveur-data";
import {
  Accueil,
  Aide,
  Evenements,
  Outils,
  Performances,
  Roles,
  Services,
  ServeurLocal,
  TousServeurs,
  type Section,
} from "./ServeurPanneaux";

const NAVIGATION: Array<{ id: Section; libelle: string; icone: string }> = [
  { id: "accueil", libelle: "Tableau de bord", icone: "🏠" },
  { id: "local", libelle: "Serveur local", icone: "🖥️" },
  { id: "tous", libelle: "Tous les serveurs", icone: "🗂️" },
  { id: "roles", libelle: "Rôles et fonctionnalités", icone: "🧩" },
  { id: "services", libelle: "Services", icone: "⚙️" },
  { id: "evenements", libelle: "Événements", icone: "📜" },
  { id: "performances", libelle: "Performances", icone: "📈" },
  { id: "outils", libelle: "Outils", icone: "🛠️" },
  { id: "aide", libelle: "Aide", icone: "❔" },
];

/** Fenêtre du Gestionnaire de serveur. Réservée aux admins : le contrôle est refait côté serveur pour les données IA. */
export function ServeurWindows({
  moi,
  connectes,
  onFermer,
}: {
  moi: { id: string; pseudo: string };
  connectes: number;
  onFermer: () => void;
}) {
  if (!estAdmin({ id: moi.id, pseudo: moi.pseudo })) {
    return (
      <Fenetre onFermer={onFermer}>
        <div role="alert" className="flex flex-col items-center gap-3 p-8 text-center text-[#1f2937]">
          <div className="text-4xl" aria-hidden>
            ⛔
          </div>
          <h2 className="text-lg font-semibold">Accès refusé</h2>
          <p className="max-w-md text-sm">
            Le Gestionnaire de serveur est réservé aux administrateurs d'ISITECH WORLD. Demande l'accès à un admin si
            tu en as besoin.
          </p>
          <button
            type="button"
            onClick={onFermer}
            className="rounded-sm border border-[#8a96a8] bg-white px-4 py-1 text-sm hover:bg-[#e8f1fb]"
          >
            OK
          </button>
        </div>
      </Fenetre>
    );
  }
  return <GestionnaireActif moi={moi} connectes={connectes} onFermer={onFermer} />;
}

function GestionnaireActif({
  moi,
  connectes,
  onFermer,
}: {
  moi: { id: string; pseudo: string };
  connectes: number;
  onFermer: () => void;
}) {
  const [section, setSection] = useState<Section>("accueil");
  const [aideOuverte, setAideOuverte] = useState(false);
  const qc = useQueryClient();
  const donnees = useDonneesServeur(true);
  const actualiser = () => void qc.invalidateQueries({ queryKey: ["serveur-admin"] });
  const titreSection = NAVIGATION.find((n) => n.id === section)?.libelle ?? "";

  const contenu = (() => {
    if (donnees.isLoading) return <p className="text-sm text-[#4a5568]">Lecture de l'état du serveur…</p>;
    if (donnees.isError || !donnees.data)
      return (
        <p role="alert" className="text-sm text-[#d13438]">
          Impossible de lire l'état du serveur : {donnees.error instanceof Error ? donnees.error.message : "erreur inconnue"}.
        </p>
      );
    const d = donnees.data;
    switch (section) {
      case "accueil":
        return <Accueil data={d} aller={setSection} />;
      case "local":
        return <ServeurLocal data={d} connectes={connectes} />;
      case "tous":
        return <TousServeurs data={d} />;
      case "roles":
        return <Roles data={d} />;
      case "services":
        return <Services data={d} onActualiser={actualiser} />;
      case "evenements":
        return <Evenements data={d} />;
      case "performances":
        return <Performances data={d} connectes={connectes} />;
      case "outils":
        return <Outils data={d} moi={moi} onActualiser={actualiser} />;
      case "aide":
        return <Aide />;
    }
  })();

  return (
    <Fenetre onFermer={onFermer}>
      <div className="flex items-center justify-between border-b border-[#d0d7e2] bg-[#f3f6fa] px-3 py-1 text-sm">
        <nav aria-label="Menu" className="flex gap-1">
          <button type="button" onClick={actualiser} className="rounded-sm px-2 py-0.5 hover:bg-[#e8f1fb]">
            Actualiser
          </button>
          <button type="button" onClick={() => setSection("outils")} className="rounded-sm px-2 py-0.5 hover:bg-[#e8f1fb]">
            Outils
          </button>
          <button
            type="button"
            onClick={() => setAideOuverte((o) => !o)}
            aria-pressed={aideOuverte}
            className="rounded-sm px-2 py-0.5 hover:bg-[#e8f1fb]"
          >
            Aide
          </button>
        </nav>
        <span className="text-xs text-[#4a5568]">{donnees.dataUpdatedAt ? `Mis à jour à ${new Date(donnees.dataUpdatedAt).toLocaleTimeString("fr-FR")}` : ""}</span>
      </div>
      <div className="flex min-h-[460px]">
        <aside aria-label="Navigation du serveur" className="w-56 shrink-0 border-r border-[#d0d7e2] bg-[#eef2f7] py-2">
          {NAVIGATION.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                setSection(n.id);
                setAideOuverte(false);
              }}
              aria-current={section === n.id ? "page" : undefined}
              className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                section === n.id ? "bg-white font-semibold text-[#0067b8] shadow-[inset_3px_0_0_#0067b8]" : "text-[#1f2937] hover:bg-[#e1e8f1]"
              }`}
            >
              <span aria-hidden>{n.icone}</span>
              {n.libelle}
            </button>
          ))}
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto p-5">
          {aideOuverte ? <Aide /> : contenu}
          <span className="sr-only">{titreSection}</span>
        </main>
      </div>
    </Fenetre>
  );
}

/** Cadre de fenêtre façon Windows Server 2022 : barre de titre bleue, bouton de fermeture. */
function Fenetre({ children, onFermer }: { children: React.ReactNode; onFermer: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Gestionnaire de serveur"
      className="mx-auto w-full max-w-[980px] overflow-hidden rounded-md border border-[#1f3a5f] bg-white font-[system-ui,'Segoe_UI',sans-serif] text-[#1f2937] shadow-2xl"
    >
      <div className="flex items-center justify-between bg-[#1f3a5f] px-3 py-1.5 text-white">
        <span className="text-sm font-semibold">Gestionnaire de serveur · ISITECH-SRV22</span>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer le Gestionnaire de serveur"
          className="rounded-sm px-2 py-0.5 text-sm hover:bg-[#d13438]"
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}
