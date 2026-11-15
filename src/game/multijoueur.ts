import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ZoneId } from "./carte/types";
import type { Profil } from "./profil";
import { SalleClient, type Distant, type Etat, type Msg, type Statut } from "./salle";

/** Joue dans une zone : positions, bulles de discussion et statuts des autres joueurs (protocole dans salle.ts). */
export function useSalle(zone: ZoneId, moi: Profil, lireEtat: () => Etat) {
  const [, rendre] = useState(0);
  const client = useRef<SalleClient | null>(null);
  const lire = useRef(lireEtat);
  lire.current = lireEtat;
  const statut = useRef<Statut>(null);
  const cleApp = JSON.stringify(moi.apparence);

  useEffect(() => {
    const canal = supabase.channel(`salle:${zone}`, { config: { broadcast: { self: false } } });
    const c = new SalleClient(
      { id: moi.id, pseudo: moi.pseudo, niveau: moi.niveau, apparence: moi.apparence },
      {
        envoyer: (m) => {
          void canal.send({ type: "broadcast", event: "m", payload: m });
        },
      },
      () => lire.current(),
      () => Date.now(),
      () => rendre((v) => v + 1),
    );
    client.current = c;
    canal
      .on("broadcast", { event: "m" }, ({ payload }) => c.recevoir(payload as Msg))
      .subscribe((s) => {
        if (s === "SUBSCRIBED") c.demarrer(statut.current);
      });
    const tic = setInterval(() => c.tic(), 250);
    const partir = () => c.quitter();
    window.addEventListener("pagehide", partir);
    return () => {
      clearInterval(tic);
      window.removeEventListener("pagehide", partir);
      c.quitter();
      client.current = null;
      setTimeout(() => {
        void supabase.removeChannel(canal);
      }, 200);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, moi.id, moi.pseudo, moi.niveau, cleApp]);

  const envoyerEtat = useCallback((e: Etat) => client.current?.envoyerEtat(e), []);
  const dire = useCallback((t: string) => client.current?.dire(t) ?? false, []);
  const definirStatut = useCallback((t: string) => {
    client.current?.definirStatut(t);
    statut.current = client.current?.statutMoi ?? null;
  }, []);
  const lireAutres = useCallback(() => client.current?.autres ?? new Map<string, Distant>(), []);

  const textes = client.current?.textes() ?? { bulles: {}, statuts: {} };
  return {
    autres: Array.from(client.current?.autres.values() ?? []),
    lireAutres,
    bulles: textes.bulles,
    statuts: textes.statuts,
    statutMoi: client.current?.statutMoi ?? statut.current,
    envoyerEtat,
    dire,
    definirStatut,
  };
}

/* ───────────── Canal global de l'école : qui est connecté et où, messages privés ───────────── */
export type Present = { id: string; pseudo: string; niveau: number; zone: ZoneId };
export type Conversation = {
  pseudo: string;
  msgs: Array<{ moi: boolean; t: string; date: number }>;
  nonLus: number;
};

const DELAI_TRACK = 6000; // l'offre gratuite limite les mises à jour de présence : on les espace
const DELAI_MP = 1000;

export function useEcole(
  moi: Profil,
  zone: ZoneId,
  surMessage?: (pseudo: string, texte: string) => void,
) {
  const [roster, setRoster] = useState<Present[]>([]);
  const [conv, setConv] = useState<Record<string, Conversation>>({});
  const canal = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const zoneRef = useRef(zone);
  const dernierTrack = useRef(0);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dernierMp = useRef(0);
  const cb = useRef(surMessage);
  cb.current = surMessage;
  const ouverte = useRef<string | null>(null);

  const suivre = useCallback(() => {
    dernierTrack.current = Date.now();
    void canal.current?.track({
      id: moi.id,
      pseudo: moi.pseudo,
      niveau: moi.niveau,
      zone: zoneRef.current,
    } satisfies Present);
  }, [moi.id, moi.pseudo, moi.niveau]);

  useEffect(() => {
    const c = supabase.channel("ecole", {
      config: { presence: { key: moi.id }, broadcast: { self: false } },
    });
    canal.current = c;
    c.on("presence", { event: "sync" }, () => {
      setRoster(
        Object.values(c.presenceState<Present>()).flatMap((a) =>
          a[0] ? [{ id: a[0].id, pseudo: a[0].pseudo, niveau: a[0].niveau, zone: a[0].zone }] : [],
        ),
      );
    })
      .on("broadcast", { event: "mp" }, ({ payload }) => {
        const p = payload as { de: string; a: string; pseudo: string; t: string };
        if (p.a !== moi.id || typeof p.t !== "string") return;
        const t = p.t.slice(0, 200);
        setConv((s) => {
          const ex = s[p.de] ?? { pseudo: p.pseudo, msgs: [], nonLus: 0 };
          return {
            ...s,
            [p.de]: {
              pseudo: p.pseudo,
              msgs: [...ex.msgs, { moi: false, t, date: Date.now() }].slice(-100),
              nonLus: ouverte.current === p.de ? 0 : ex.nonLus + 1,
            },
          };
        });
        cb.current?.(p.pseudo, t);
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") suivre();
      });
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
      void supabase.removeChannel(c);
      canal.current = null;
    };
  }, [moi.id, suivre]);

  // Changement de zone : on met la présence à jour, sans dépasser le rythme autorisé
  useEffect(() => {
    zoneRef.current = zone;
    if (minuteur.current) clearTimeout(minuteur.current);
    const attente = Math.max(0, DELAI_TRACK - (Date.now() - dernierTrack.current));
    minuteur.current = setTimeout(suivre, attente);
  }, [zone, suivre]);

  const enLigne = useCallback((id: string) => roster.some((p) => p.id === id), [roster]);

  /** Message privé. Il n'est pas gardé en mémoire côté serveur : il faut que l'autre soit connecté. */
  const envoyer = useCallback(
    (a: string, pseudo: string, texte: string): "ok" | "hors-ligne" | "trop-vite" | "vide" => {
      const t = texte.trim().slice(0, 200);
      if (!t) return "vide";
      if (!roster.some((p) => p.id === a)) return "hors-ligne";
      if (Date.now() - dernierMp.current < DELAI_MP) return "trop-vite";
      dernierMp.current = Date.now();
      void canal.current?.send({
        type: "broadcast",
        event: "mp",
        payload: { de: moi.id, a, pseudo: moi.pseudo, t },
      });
      setConv((s) => {
        const ex = s[a] ?? { pseudo, msgs: [], nonLus: 0 };
        return {
          ...s,
          [a]: { ...ex, msgs: [...ex.msgs, { moi: true, t, date: Date.now() }].slice(-100) },
        };
      });
      return "ok";
    },
    [moi.id, moi.pseudo, roster],
  );

  const ouvrir = useCallback((id: string | null) => {
    ouverte.current = id;
    if (id) setConv((s) => (s[id] && s[id]!.nonLus ? { ...s, [id]: { ...s[id]!, nonLus: 0 } } : s));
  }, []);

  const nonLus = Object.values(conv).reduce((n, c) => n + c.nonLus, 0);
  return { roster, conv, enLigne, envoyer, ouvrir, nonLus };
}
