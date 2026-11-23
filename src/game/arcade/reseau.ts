import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Apparence } from "@/game/apparence";
import { supabase } from "@/integrations/supabase/client";
import {
  construireRoom,
  estProprietaire,
  peutChangerMode,
  pleine,
  raisonBlocage,
  resumeRoom,
  sallesDepuisPresence,
  sansPlace,
  JEU_DEFAUT,
  MODE_DEFAUT,
  type Membre,
  type RoomInfo,
  type RoomVue,
} from "./room";
import type { JeuId, ModeArcade } from "./types";

/**
 * Réseau de l'arcade (Supabase Realtime).
 *
 *  - Salon « arcade:lobby » : chaque propriétaire de room y publie un résumé de sa room (présence).
 *    Tout le monde lit la liste des rooms ouvertes.
 *  - Canal « arcade:room:<id> » (un par room) : la présence donne les joueurs, et celle du propriétaire
 *    porte les réglages (jeu, mode, phase). Les messages « in » (touches) et « snap » (état de la partie)
 *    passent en diffusion. Le propriétaire est l'hôte : lui seul fait tourner la simulation.
 *
 * Budget messages (offre gratuite : 100 / s pour tout le projet) : état envoyé 8 fois par seconde,
 * touches envoyées seulement quand elles changent (au plus 10 fois par seconde et par joueur).
 */

export type EtatReseau = "connexion" | "pret" | "erreur";
export type Reglages = {
  jeu: JeuId;
  mode: ModeArcade;
  phase: "salle" | "jeu";
  manche: number;
  graine: number;
};
export type Abonne = {
  /** Touches d'un joueur (reçues par l'hôte). */
  entree?: (id: string, bits: number) => void;
  /** État de la partie (reçu par les autres joueurs). */
  snapshot?: (manche: number, etat: unknown) => void;
};

const REGLAGES_DEFAUT: Reglages = {
  jeu: JEU_DEFAUT,
  mode: MODE_DEFAUT,
  phase: "salle",
  manche: 0,
  graine: 0,
};
const DELAI_ENTREE = 100;
const DELAI_ROOM_INTROUVABLE = 2500;

type Moi = { id: string; pseudo: string; niveau: number; apparence?: Apparence | undefined };

export function useArcade(moi: Moi, actif = true) {
  const [etat, setEtat] = useState<EtatReseau>("connexion");
  const [salles, setSalles] = useState<RoomInfo[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [canalPret, setCanalPret] = useState(false);
  /** Un invité n'a de pouvoir qu'après avoir vu le créateur dans la room (évite de se croire propriétaire trop tôt). */
  const [createurVu, setCreateurVu] = useState(false);
  const [reglages, setReglages] = useState<Reglages>(REGLAGES_DEFAUT);
  const [message, setMessage] = useState<string | null>(null);

  // L'apparence ne relance pas la présence à chaque rafraîchissement du profil : seule sa valeur compte.
  const apparenceRef = useRef(moi.apparence);
  apparenceRef.current = moi.apparence;
  const cleApparence = JSON.stringify(moi.apparence ?? null);
  const lobby = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const canal = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const abonnes = useRef<Abonne>({});
  const depuis = useRef(0);
  const dernierResume = useRef("");
  const sallesRef = useRef<RoomInfo[]>([]);
  sallesRef.current = salles;

  const room: RoomVue | null = useMemo(
    () => (roomId && (roomId === moi.id || createurVu) ? construireRoom(roomId, membres) : null),
    [roomId, moi.id, createurVu, membres],
  );
  const proprio = estProprietaire(room, moi.id);

  /* ───────────── Salon : la liste des rooms ───────────── */
  useEffect(() => {
    if (!actif) return;
    setEtat("connexion");
    const c = supabase.channel("arcade:lobby", {
      config: { presence: { key: moi.id }, broadcast: { self: false } },
    });
    lobby.current = c;
    c.on("presence", { event: "sync" }, () => {
      setSalles(sallesDepuisPresence(c.presenceState() as Record<string, unknown[]>));
    }).subscribe((s) => {
      if (s === "SUBSCRIBED") setEtat("pret");
      else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setEtat("erreur");
    });
    return () => {
      void supabase.removeChannel(c);
      lobby.current = null;
      dernierResume.current = "";
    };
  }, [actif, moi.id]);

  /* Le propriétaire publie sa room dans le salon ; dès qu'il n'est plus propriétaire, il la retire. */
  const resume = useMemo(
    () => (room && proprio ? JSON.stringify(resumeRoom(room)) : ""),
    [room, proprio],
  );
  useEffect(() => {
    const c = lobby.current;
    if (!c || etat !== "pret" || resume === dernierResume.current) return;
    dernierResume.current = resume;
    if (resume) void c.track({ salle: JSON.parse(resume) as RoomInfo });
    else void c.untrack();
  }, [resume, etat]);

  /* ───────────── Room : joueurs, réglages, messages de jeu ───────────── */
  useEffect(() => {
    if (!actif || !roomId) return;
    depuis.current = Date.now();
    setCanalPret(false);
    setCreateurVu(roomId === moi.id);
    let vuCreateur = roomId === moi.id;
    const c = supabase.channel(`arcade:room:${roomId}`, {
      config: { presence: { key: moi.id }, broadcast: { self: false } },
    });
    canal.current = c;
    c.on("presence", { event: "sync" }, () => {
      const liste = Object.values(c.presenceState<Membre>()).flatMap((a) => (a[0] ? [a[0]] : []));
      if (liste.some((m) => m.id === roomId)) {
        vuCreateur = true;
        setCreateurVu(true);
      }
      setMembres(liste);
    })
      .on("broadcast", { event: "in" }, ({ payload }) => {
        const p = payload as { i?: string; m?: number };
        if (typeof p.i === "string" && typeof p.m === "number")
          abonnes.current.entree?.(p.i, p.m | 0);
      })
      .on("broadcast", { event: "snap" }, ({ payload }) => {
        const p = payload as { k?: number; s?: unknown };
        if (typeof p.k === "number") abonnes.current.snapshot?.(p.k, p.s);
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setCanalPret(true);
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          setMessage("Connexion à la room perdue.");
          setRoomId(null);
        }
      });
    // Room déjà fermée : si le créateur n'apparaît jamais, on ressort.
    const garde = setTimeout(() => {
      if (!vuCreateur) {
        setMessage("Cette room n'existe plus.");
        setRoomId(null);
      }
    }, DELAI_ROOM_INTROUVABLE);
    return () => {
      clearTimeout(garde);
      void supabase.removeChannel(c);
      canal.current = null;
      setCanalPret(false);
      setMembres([]);
    };
  }, [actif, roomId, moi.id]);

  /* Ma présence dans la room : le propriétaire y ajoute les réglages de la partie. */
  useEffect(() => {
    const c = canal.current;
    if (!c || !canalPret) return;
    const base: Membre = {
      id: moi.id,
      pseudo: moi.pseudo,
      niveau: moi.niveau,
      depuis: depuis.current,
      ...(apparenceRef.current ? { apparence: apparenceRef.current } : {}),
    };
    void c.track(proprio ? { ...base, ...reglages } : base);
  }, [canalPret, proprio, reglages, moi.id, moi.pseudo, moi.niveau, cleApparence]);

  /* Arrivé trop tard dans une room pleine : on ressort. */
  useEffect(() => {
    if (room && roomId !== moi.id && sansPlace(room, moi.id)) {
      setMessage("Cette room est pleine.");
      setRoomId(null);
    }
  }, [room, roomId, moi.id]);

  /* Annonce quand le propriétaire change (départ du créateur). */
  const dernierProprio = useRef<string | null>(null);
  useEffect(() => {
    const p = room?.proprietaire;
    if (p && dernierProprio.current && dernierProprio.current !== p.id)
      setMessage(
        p.id === moi.id
          ? "Le propriétaire est parti : tu deviens propriétaire de la room."
          : `Le propriétaire est parti : ${p.pseudo} est le nouveau propriétaire.`,
      );
    dernierProprio.current = p?.id ?? null;
  }, [room?.proprietaire, moi.id]);

  /* ───────────── Actions ───────────── */
  const creer = useCallback(() => {
    setReglages(REGLAGES_DEFAUT);
    setMessage(null);
    setRoomId(moi.id);
  }, [moi.id]);

  const rejoindre = useCallback((id: string) => {
    const info = sallesRef.current.find((s) => s.id === id);
    if (!info) return setMessage("Cette room n'existe plus.");
    if (info.phase === "jeu") return setMessage("Une partie est déjà en cours dans cette room.");
    if (pleine(info)) return setMessage("Cette room est pleine.");
    setMessage(null);
    setRoomId(id);
  }, []);

  const quitter = useCallback(() => {
    setRoomId(null);
    setMessage(null);
  }, []);

  const choisirJeu = useCallback(
    (jeu: JeuId) => {
      if (proprio && room?.phase === "salle") setReglages((r) => ({ ...r, jeu }));
    },
    [proprio, room?.phase],
  );
  const choisirMode = useCallback(
    (mode: ModeArcade): boolean => {
      if (!proprio || !room || room.phase !== "salle") return false;
      if (!peutChangerMode(room, mode)) {
        setMessage("Trop de joueurs pour ce mode : fais sortir quelqu'un d'abord.");
        return false;
      }
      setReglages((r) => ({ ...r, mode }));
      return true;
    },
    [proprio, room],
  );
  const lancer = useCallback((): boolean => {
    if (!proprio || !room || raisonBlocage(room)) return false;
    setReglages((r) => ({
      ...r,
      phase: "jeu",
      manche: Date.now() % 2147483647,
      graine: Math.floor(Math.random() * 2 ** 31),
    }));
    return true;
  }, [proprio, room]);
  const retourSalle = useCallback(() => {
    if (proprio) setReglages((r) => ({ ...r, phase: "salle" }));
  }, [proprio]);

  /* ───────────── Messages de jeu ───────────── */
  const derniereEntree = useRef({
    t: 0,
    bits: -1,
    minuteur: null as ReturnType<typeof setTimeout> | null,
  });
  const envoyerEntree = useCallback(
    (manche: number, bits: number) => {
      const e = derniereEntree.current;
      const envoyer = () => {
        e.t = Date.now();
        e.bits = bits;
        void canal.current?.send({
          type: "broadcast",
          event: "in",
          payload: { i: moi.id, m: bits, k: manche },
        });
      };
      if (e.minuteur) clearTimeout(e.minuteur);
      const attente = DELAI_ENTREE - (Date.now() - e.t);
      if (attente <= 0) envoyer();
      else e.minuteur = setTimeout(envoyer, attente);
    },
    [moi.id],
  );
  useEffect(
    () => () => {
      if (derniereEntree.current.minuteur) clearTimeout(derniereEntree.current.minuteur);
    },
    [],
  );
  const envoyerSnapshot = useCallback((manche: number, s: unknown) => {
    void canal.current?.send({ type: "broadcast", event: "snap", payload: { k: manche, s } });
  }, []);
  const abonner = useCallback((a: Abonne) => {
    abonnes.current = a;
    return () => {
      if (abonnes.current === a) abonnes.current = {};
    };
  }, []);

  // Si on quitte l'arcade en pleine room, la room se ferme proprement (les effets ci-dessus nettoient les canaux).
  return {
    etat,
    salles,
    room,
    roomId,
    proprio,
    reglages,
    message,
    effacerMessage: () => setMessage(null),
    creer,
    rejoindre,
    quitter,
    choisirJeu,
    choisirMode,
    lancer,
    retourSalle,
    envoyerEntree,
    envoyerSnapshot,
    abonner,
  };
}
export type ArcadeReseau = ReturnType<typeof useArcade>;
