import { vi } from "vitest";

/**
 * Faux Supabase Realtime en mémoire pour les tests : présence + diffusion, avec l'état de présence
 * envoyé à chaque nouvel arrivant, comme le vrai service.
 */
type Rappel = (...a: never[]) => void;
function creerHub() {
  type Canal = {
    nom: string;
    cle: string;
    meta: unknown;
    syncs: Array<() => void>;
    diffusions: Record<string, Array<(m: { payload: unknown }) => void>>;
  };
  const canaux: Canal[] = [];
  const fabrique = (nom: string, options: { config?: { presence?: { key?: string } } } = {}) => {
    const c: Canal = {
      nom,
      cle: options.config?.presence?.key ?? "",
      meta: undefined,
      syncs: [],
      diffusions: {},
    };
    const membres = () => canaux.filter((x) => x.nom === nom);
    const synchro = () => membres().forEach((x) => x.syncs.forEach((f) => f()));
    const api = {
      on(type: string, filtre: { event: string }, cb: Rappel) {
        if (type === "presence") c.syncs.push(cb as () => void);
        else (c.diffusions[filtre.event] ??= []).push(cb as never);
        return api;
      },
      subscribe(cb?: (s: string) => void) {
        canaux.push(c);
        cb?.("SUBSCRIBED");
        // Comme le vrai Supabase : un nouvel arrivant reçoit tout de suite l'état de présence.
        synchro();
        return api;
      },
      track(meta: unknown) {
        c.meta = meta;
        synchro();
        return Promise.resolve("ok");
      },
      untrack() {
        c.meta = undefined;
        synchro();
        return Promise.resolve("ok");
      },
      presenceState() {
        const r: Record<string, unknown[]> = {};
        for (const x of membres()) if (x.meta !== undefined) r[x.cle] = [x.meta];
        return r;
      },
      send(m: { event: string; payload: unknown }) {
        for (const x of membres())
          if (x !== c) x.diffusions[m.event]?.forEach((f) => f({ payload: m.payload }));
        return Promise.resolve("ok");
      },
    };
    return { api, c, synchro };
  };
  const instances = new Map<object, { c: Canal; synchro: () => void }>();
  return {
    canaux,
    channel: (nom: string, options?: { config?: { presence?: { key?: string } } }) => {
      const f = fabrique(nom, options);
      instances.set(f.api, { c: f.c, synchro: f.synchro });
      return f.api;
    },
    retirer: (api: object) => {
      const i = instances.get(api);
      if (!i) return Promise.resolve("ok");
      const k = canaux.indexOf(i.c);
      if (k >= 0) canaux.splice(k, 1);
      canaux.filter((x) => x.nom === i.c.nom).forEach((x) => x.syncs.forEach((f) => f()));
      return Promise.resolve("ok");
    },
    vider: () => canaux.splice(0, canaux.length),
  };
}
export const hub = creerHub();
export const moduleSupabase = { supabase: { channel: hub.channel, removeChannel: hub.retirer } };
void vi;
