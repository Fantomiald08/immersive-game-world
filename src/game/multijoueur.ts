import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Apparence, Direction } from "./apparence";
import type { Point, SceneId } from "./monde";
import type { Profil } from "./profil";

export type Pos = Point & { dir: Direction; marche: boolean };
export type Joueur = Pos & { id: string; pseudo: string; niveau: number; apparence: Apparence };

const DUREE_BULLE = 4000;
const DELAI_CHAT = 1200;
const MAX_CHAT = 60;

/** Salle temps réel : présence (qui est là) + diffusion des positions + bulles de chat. Rien n'est stocké en base. */
export function useSalle(scene: SceneId, moi: Profil | null | undefined, depart: Point) {
  const [autres, setAutres] = useState<Record<string, Joueur>>({});
  const [bulles, setBulles] = useState<Record<string, { t: string; fin: number }>>({});
  const ch = useRef<RealtimeChannel | null>(null);
  const pos = useRef<Pos>({ ...depart, dir: "bas", marche: false });
  const dernier = useRef(0);
  const dernierChat = useRef(0);
  const attente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleApp = JSON.stringify(moi?.apparence ?? {});

  useEffect(() => {
    if (!moi) return;
    pos.current = { ...depart, dir: "bas", marche: false };
    const c = supabase.channel(`salle:${scene}`, {
      config: { presence: { key: moi.id }, broadcast: { self: false } },
    });
    const info = (): Joueur => ({
      id: moi.id,
      pseudo: moi.pseudo,
      niveau: moi.niveau,
      apparence: moi.apparence,
      ...pos.current,
    });
    c.on("presence", { event: "sync" }, () => {
      const st = c.presenceState<Joueur>();
      setAutres((prev) => {
        const n: Record<string, Joueur> = {};
        for (const [k, arr] of Object.entries(st)) {
          const j = arr[0];
          if (k === moi.id || !j) continue;
          const old = prev[k];
          n[k] = {
            id: j.id,
            pseudo: j.pseudo,
            niveau: j.niveau,
            apparence: j.apparence,
            x: old?.x ?? j.x,
            y: old?.y ?? j.y,
            dir: old?.dir ?? j.dir,
            marche: old?.marche ?? false,
          };
        }
        return n;
      });
    })
      .on("broadcast", { event: "pos" }, ({ payload }) => {
        const p = payload as Pos & { id: string };
        setAutres((prev) =>
          prev[p.id]
            ? { ...prev, [p.id]: { ...prev[p.id]!, x: p.x, y: p.y, dir: p.dir, marche: p.marche } }
            : prev,
        );
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        const p = payload as { id: string; t: string };
        if (!p?.id || typeof p.t !== "string" || p.id === moi.id) return;
        setBulles((b) => ({
          ...b,
          [p.id]: { t: p.t.slice(0, MAX_CHAT), fin: Date.now() + DUREE_BULLE },
        }));
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") void c.track(info());
      });
    ch.current = c;
    const t = setInterval(() => {
      void c.track(info());
    }, 3000);
    return () => {
      clearInterval(t);
      void supabase.removeChannel(c);
      ch.current = null;
      setAutres({});
      setBulles({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, moi?.id, moi?.pseudo, moi?.niveau, cleApp]);

  // Nettoyage des bulles expirées
  useEffect(() => {
    const t = setInterval(() => {
      setBulles((b) => {
        const now = Date.now();
        const reste = Object.entries(b).filter(([, v]) => v.fin > now);
        return reste.length === Object.keys(b).length ? b : Object.fromEntries(reste);
      });
    }, 500);
    return () => clearInterval(t);
  }, []);

  const envoyer = useCallback(
    (p: Pos) => {
      pos.current = p;
      const go = () => {
        dernier.current = Date.now();
        if (moi)
          void ch.current?.send({
            type: "broadcast",
            event: "pos",
            payload: { id: moi.id, ...pos.current },
          });
      };
      if (attente.current) {
        clearTimeout(attente.current);
        attente.current = null;
      }
      const reste = 90 - (Date.now() - dernier.current);
      if (reste <= 0) go();
      else attente.current = setTimeout(go, reste);
    },
    [moi],
  );

  /** Bulle de chat (ou emote) au-dessus de ma tête, visible par les joueurs de la salle. Anti-spam : 1 message / 1,2 s. */
  const dire = useCallback(
    (texte: string): boolean => {
      const t = texte.trim().slice(0, MAX_CHAT);
      if (!t || !moi || Date.now() - dernierChat.current < DELAI_CHAT) return false;
      dernierChat.current = Date.now();
      setBulles((b) => ({ ...b, [moi.id]: { t, fin: Date.now() + DUREE_BULLE } }));
      void ch.current?.send({ type: "broadcast", event: "chat", payload: { id: moi.id, t } });
      return true;
    },
    [moi],
  );

  return {
    autres: Object.values(autres),
    envoyer,
    dire,
    bulles: Object.fromEntries(Object.entries(bulles).map(([k, v]) => [k, v.t])) as Record<
      string,
      string
    >,
  };
}
