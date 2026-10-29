import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Fenetre } from "./Fenetre";
import { JournalContenu } from "./Journal";
import { estAdmin } from "@/game/admins";
import type { Profil } from "@/game/profil";
import type { Prog } from "@/game/progression";
import { formaterDate, publierAnnonce, supprimerAnnonce, useReseau } from "@/game/reseau";

type Onglet = "annonces" | "nouvelles" | "journal" | "evenements";

/** Le tableau d'affichage de l'accueil : annonces, nouvelles, journal du joueur, événements. */
export function Tableau({
  moi,
  prog,
  onFermer,
}: {
  moi: Profil;
  prog: Prog | null;
  onFermer: () => void;
}) {
  const [onglet, setOnglet] = useState<Onglet>("annonces");
  const { data } = useReseau();
  const qc = useQueryClient();
  const admin = estAdmin(moi);
  const [titre, setTitre] = useState(""),
    [corps, setCorps] = useState(""),
    [erreur, setErreur] = useState(""),
    [envoi, setEnvoi] = useState(false);

  const nouvelles = useMemo(
    () =>
      [
        ...(data?.cours ?? []).map((c) => ({
          id: c.id,
          date: c.date,
          texte: `📚 ${c.auteur} a déposé « ${c.titre} » (${c.categorie})`,
        })),
        ...(data?.categories ?? []).map((c) => ({
          id: c.id,
          date: c.date,
          texte: `🗂 ${c.auteur} a créé la catégorie « ${c.nom} »`,
        })),
        ...(data?.annonces ?? []).map((a) => ({
          id: a.id,
          date: a.date,
          texte: `📢 Nouvelle annonce : « ${a.titre} »`,
        })),
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 20),
    [data],
  );

  const publier = async () => {
    if (titre.trim().length < 3 || corps.trim().length < 3) {
      setErreur("Écris un titre et un message.");
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      await publierAnnonce(moi.id, titre, corps);
      setTitre("");
      setCorps("");
      await qc.invalidateQueries({ queryKey: ["reseau"] });
    } catch {
      setErreur("Publication impossible pour le moment.");
    }
    setEnvoi(false);
  };
  const onglets: Array<[Onglet, string]> = [
    ["annonces", "📢 Annonces"],
    ["nouvelles", "📰 Nouvelles"],
    ["journal", "📔 Mon journal"],
    ["evenements", "🎃 Événements"],
  ];

  return (
    <Fenetre titre="📋 Tableau d'affichage" onFermer={onFermer} large>
      <div className="mb-3 flex flex-wrap gap-2">
        {onglets.map(([k, n]) => (
          <button
            key={k}
            className={`pixel-btn !px-2 !py-1 !text-[9px] ${onglet === k ? "!bg-accent" : ""}`}
            onClick={() => setOnglet(k)}
          >
            {n}
          </button>
        ))}
      </div>

      {onglet === "annonces" && (
        <div className="space-y-3 text-lg">
          {admin && (
            <div className="pixel-box space-y-2 p-3">
              <div className="font-pixel text-[9px] text-accent">PUBLIER UNE ANNONCE</div>
              <input
                className="pixel-input"
                maxLength={100}
                placeholder="Titre"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
              />
              <textarea
                className="pixel-input"
                rows={3}
                maxLength={1000}
                placeholder="Message pour toute la classe"
                value={corps}
                onChange={(e) => setCorps(e.target.value)}
              />
              {erreur && <p className="text-destructive">{erreur}</p>}
              <button className="pixel-btn" disabled={envoi} onClick={publier}>
                {envoi ? "Envoi…" : "📌 Afficher sur le tableau"}
              </button>
            </div>
          )}
          {(data?.annonces ?? []).length === 0 && (
            <p className="text-muted-foreground">Aucune annonce pour l'instant.</p>
          )}
          <ul className="space-y-2">
            {(data?.annonces ?? []).map((a) => (
              <li key={a.id} className="pixel-box p-3">
                <div className="font-bold">📢 {a.titre}</div>
                <div className="whitespace-pre-wrap">{a.corps}</div>
                <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {a.auteur} · {formaterDate(a.date)}
                  </span>
                  {a.auteurId === moi.id && (
                    <button
                      className="underline"
                      onClick={async () => {
                        await supprimerAnnonce(a.id);
                        await qc.invalidateQueries({ queryKey: ["reseau"] });
                      }}
                    >
                      Retirer
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onglet === "nouvelles" && (
        <ul className="space-y-2 text-lg">
          {nouvelles.length === 0 && (
            <li className="text-muted-foreground">Rien de neuf pour l'instant.</li>
          )}
          {nouvelles.map((n) => (
            <li key={n.id} className="pixel-box p-2">
              <div>{n.texte}</div>
              <div className="text-sm text-muted-foreground">{formaterDate(n.date)}</div>
            </li>
          ))}
        </ul>
      )}

      {onglet === "journal" && (prog ? <JournalContenu prog={prog} /> : <p>Chargement…</p>)}

      {onglet === "evenements" && (
        <div className="space-y-2 text-lg">
          <p>Aucun événement en cours.</p>
          <p className="text-muted-foreground">
            C'est ici que s'afficheront bientôt les histoires et événements de l'école (Halloween,
            Noël…), avec leurs missions.
          </p>
        </div>
      )}
      <button className="pixel-btn mt-4" onClick={onFermer}>
        Fermer
      </button>
    </Fenetre>
  );
}
