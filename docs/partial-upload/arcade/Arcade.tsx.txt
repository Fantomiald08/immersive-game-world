import { useEffect, useRef, useState } from "react";
import { PartieArcade } from "@/components/game/arcade/PartieArcade";
import { JEUX, LISTE_JEUX } from "@/game/arcade/jeux";
import { useArcade } from "@/game/arcade/reseau";
import { equipeDe, pleine, raisonBlocage, type RoomInfo } from "@/game/arcade/room";
import type { ModeArcade, PhasePartie } from "@/game/arcade/types";

type Moi = { id: string; pseudo: string; niveau: number };

const nomMode = (m: ModeArcade) => (m === "1v1" ? "1v1" : "Équipes 2v2");
const COULEUR_EQUIPE = ["#4da3ff", "#ff6b6b"] as const;

/** Borne d'arcade de la salle Vénus : rooms, équipes et trois mini-jeux multijoueurs de 120 secondes. */
export function Arcade({ moi, onFermer }: { moi: Moi; onFermer: () => void }) {
  const reseau = useArcade(moi);
  const { room, proprio, etat, salles, message } = reseau;
  const [liste, setListe] = useState(false);

  // Partie interrompue : la room repasse en « salle » alors que la partie n'était pas finie.
  const phasePartie = useRef<PhasePartie | "">("");
  const phaseRoom = useRef<"salle" | "jeu" | "">("");
  const [info, setInfo] = useState<string | null>(null);
  useEffect(() => {
    if (phaseRoom.current === "jeu" && room?.phase === "salle" && phasePartie.current !== "fini")
      setInfo("La partie a été interrompue (le propriétaire est parti ou a quitté la partie).");
    phaseRoom.current = room?.phase ?? "";
    if (room?.phase !== "jeu") phasePartie.current = "";
  }, [room?.phase]);

  const fermer = () => {
    reseau.quitter();
    onFermer();
  };
  const msg = message ?? info;
  const effacer = () => {
    reseau.effacerMessage();
    setInfo(null);
  };

  return (
    <div className="fixed inset-0 z-[2500] grid place-items-center bg-black/85 p-2 sm:p-4">
      <div className="pixel-box flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b-4 border-[#2a1810] px-3 py-2">
          <span className="font-pixel text-xs text-accent">🕹️ ARCADE — Salle Vénus</span>
          <div className="flex gap-2">
            {room && (
              <button
                className="pixel-btn !bg-muted !px-2 !py-1 !text-foreground"
                onClick={reseau.quitter}
              >
                Quitter la room
              </button>
            )}
            <button className="pixel-btn !px-2 !py-1" onClick={fermer} aria-label="Fermer l'arcade">
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-3 overflow-auto p-3">
          {msg && (
            <div
              role="status"
              className="flex items-start justify-between gap-2 border-2 border-accent bg-accent/15 px-3 py-2 text-lg"
            >
              <span>{msg}</span>
              <button className="underline" onClick={effacer}>
                OK
              </button>
            </div>
          )}

          {etat === "connexion" && (
            <p className="anim-blink py-10 text-center font-pixel text-xs text-primary">
              Connexion à l'arcade…
            </p>
          )}
          {etat === "erreur" && (
            <div className="space-y-3 py-8 text-center">
              <p className="font-pixel text-xs text-destructive">Connexion impossible</p>
              <p className="text-lg">
                Le réseau de l'arcade ne répond pas. Ferme la borne et réessaie dans un instant.
              </p>
              <button className="pixel-btn" onClick={fermer}>
                Fermer
              </button>
            </div>
          )}

          {etat === "pret" && !room && reseau.roomId && (
            <p className="anim-blink py-10 text-center font-pixel text-xs text-primary">
              Connexion à la room…
            </p>
          )}
          {etat === "pret" && !room && !reseau.roomId && !liste && (
            <Accueil onCreer={reseau.creer} onRejoindre={() => setListe(true)} />
          )}
          {etat === "pret" && !room && !reseau.roomId && liste && (
            <ListeRooms
              salles={salles}
              onRejoindre={(id) => {
                reseau.rejoindre(id);
              }}
              onRetour={() => setListe(false)}
            />
          )}
          {etat === "pret" && room && room.phase === "salle" && (
            <SalleAttente moi={moi} reseau={reseau} />
          )}
          {etat === "pret" && room && room.phase === "jeu" && (
            <PartieArcade
              key={room.manche}
              jeu={JEUX[room.jeu]}
              room={room}
              moiId={moi.id}
              reseau={reseau}
              onPhase={(p) => {
                phasePartie.current = p;
              }}
              onRetourRoom={reseau.retourSalle}
              onQuitterRoom={reseau.quitter}
              onFermer={fermer}
            />
          )}
          {etat === "pret" && room && room.phase === "jeu" && !proprio && (
            <p className="text-center text-sm text-muted-foreground">
              Seul le propriétaire de la room peut relancer ou changer de jeu.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Accueil({ onCreer, onRejoindre }: { onCreer: () => void; onRejoindre: () => void }) {
  return (
    <div className="space-y-4 py-4 text-center">
      <p className="text-xl text-muted-foreground">
        Défie tes camarades dans trois mini-jeux de 120 secondes : arène à armes, course de
        véhicules et combat 2D.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={onCreer}
          className="pixel-box space-y-1 p-6 transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          <div className="text-5xl">➕</div>
          <div className="font-pixel text-sm text-primary">Créer une room</div>
          <div className="text-lg text-muted-foreground">
            Tu deviens propriétaire : tu choisis le jeu.
          </div>
        </button>
        <button
          onClick={onRejoindre}
          className="pixel-box space-y-1 p-6 transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          <div className="text-5xl">🚪</div>
          <div className="font-pixel text-sm text-primary">Rejoindre une room</div>
          <div className="text-lg text-muted-foreground">Voir les rooms ouvertes en ce moment.</div>
        </button>
      </div>
    </div>
  );
}

function ListeRooms({
  salles,
  onRejoindre,
  onRetour,
}: {
  salles: RoomInfo[];
  onRejoindre: (id: string) => void;
  onRetour: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-pixel text-xs text-primary">Rooms ouvertes ({salles.length})</h2>
        <button className="pixel-btn !bg-muted !px-2 !py-1 !text-foreground" onClick={onRetour}>
          ← Retour
        </button>
      </div>
      {salles.length === 0 ? (
        <p className="py-8 text-center text-xl text-muted-foreground">
          Aucune room ouverte pour le moment. Crée la tienne !
        </p>
      ) : (
        <ul className="space-y-2">
          {salles.map((s) => {
            const jeu = JEUX[s.jeu];
            const occupee = s.phase === "jeu";
            const bloquee = occupee || pleine(s);
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 border-2 border-[#2a1810] bg-muted/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-xl">
                    <span aria-hidden>👑</span> {s.createur}
                  </div>
                  <div className="text-lg text-muted-foreground">
                    {jeu.icone} {jeu.nom} · {nomMode(s.mode)} · 👥 {s.nb}/{s.max}
                    {occupee && " · en partie"}
                  </div>
                </div>
                <button
                  className="pixel-btn !px-3 !py-1 disabled:opacity-50"
                  disabled={bloquee}
                  onClick={() => onRejoindre(s.id)}
                >
                  {occupee ? "En cours" : pleine(s) ? "Pleine" : "Rejoindre"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SalleAttente({ moi, reseau }: { moi: Moi; reseau: ReturnType<typeof useArcade> }) {
  const { room, proprio } = reseau;
  if (!room) return null;
  const jeu = JEUX[room.jeu];
  const blocage = raisonBlocage(room);
  const modes: ModeArcade[] = ["1v1", "equipes"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">
          Room de <span className="text-accent">{room.proprietaire.pseudo}</span>
        </h2>
        {proprio ? (
          <span className="bg-accent px-2 py-1 font-pixel text-[9px] text-accent-foreground">
            👑 PROPRIÉTAIRE
          </span>
        ) : (
          <span className="text-lg text-muted-foreground">
            Le propriétaire choisit le jeu et lance la partie.
          </span>
        )}
      </div>

      <section aria-label="Joueurs">
        <h3 className="mb-1 font-pixel text-[10px] text-primary">
          Joueurs ({room.joueurs.length}/{room.max})
        </h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {room.joueurs.map((j, i) => {
            const eq = equipeDe(room, j.id);
            return (
              <li
                key={j.id}
                className="flex items-center justify-between border-2 border-[#2a1810] bg-muted/40 px-3 py-2 text-xl"
              >
                <span>
                  {j.id === room.proprietaire.id && <span aria-label="propriétaire">👑 </span>}
                  {j.pseudo}
                  {j.id === moi.id && " (toi)"}
                </span>
                <span className="font-pixel text-[9px]" style={{ color: COULEUR_EQUIPE[eq] }}>
                  {i >= room.max
                    ? "…"
                    : room.mode === "1v1"
                      ? `JOUEUR ${i + 1}`
                      : eq === 0
                        ? "ÉQUIPE BLEUE"
                        : "ÉQUIPE ROUGE"}
                </span>
              </li>
            );
          })}
          {room.joueurs.length < room.max && (
            <li className="border-2 border-dashed border-[#2a1810] px-3 py-2 text-xl text-muted-foreground">
              En attente d'un joueur…
            </li>
          )}
        </ul>
      </section>

      <section aria-label="Mode de jeu">
        <h3 className="mb-1 font-pixel text-[10px] text-primary">Mode</h3>
        <div className="flex flex-wrap gap-2">
          {modes.map((m) => (
            <button
              key={m}
              disabled={!proprio}
              aria-pressed={room.mode === m}
              onClick={() => reseau.choisirMode(m)}
              className={`pixel-btn !px-3 !py-1 disabled:cursor-default ${room.mode === m ? "" : "!bg-muted !text-foreground"} ${!proprio && room.mode !== m ? "opacity-50" : ""}`}
            >
              {nomMode(m)}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Choix du mini-jeu">
        <h3 className="mb-1 font-pixel text-[10px] text-primary">Mini-jeu</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {LISTE_JEUX.map((j) => {
            const actif = room.jeu === j.id;
            return (
              <button
                key={j.id}
                disabled={!proprio}
                aria-pressed={actif}
                onClick={() => reseau.choisirJeu(j.id)}
                className={`space-y-1 border-4 p-3 text-left transition-colors disabled:cursor-default ${actif ? "border-accent bg-accent/15" : "border-[#2a1810] bg-muted/40"} ${proprio && !actif ? "hover:border-primary" : ""} ${!proprio && !actif ? "opacity-50" : ""}`}
              >
                <div className="text-3xl">{j.icone}</div>
                <div className="font-pixel text-[10px] text-primary">{j.nom}</div>
                <div className="text-base leading-tight text-muted-foreground">{j.description}</div>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-base text-muted-foreground">
          <span className="font-pixel text-[9px] text-primary">Touches : </span>
          {jeu.aide.join(" · ")} — ou les boutons à l'écran.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        {proprio ? (
          <>
            <button
              className="pixel-btn disabled:opacity-50"
              disabled={blocage !== null}
              onClick={() => reseau.lancer()}
            >
              ▶ Lancer la partie
            </button>
            {blocage && <span className="text-lg text-muted-foreground">{blocage}</span>}
          </>
        ) : (
          <p className="anim-blink text-xl text-muted-foreground">En attente du propriétaire…</p>
        )}
      </div>
    </div>
  );
}
