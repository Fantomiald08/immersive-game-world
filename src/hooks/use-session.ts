import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Session de connexion courante. `pret` reste faux tant que Supabase n'a pas répondu (évite un flash de la mauvaise page). */
export function useSession() {
  const [etat, setEtat] = useState<{ pret: boolean; session: Session | null }>({
    pret: false,
    session: null,
  });
  useEffect(() => {
    let vivant = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (vivant) setEtat({ pret: true, session: data.session });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (vivant) setEtat({ pret: true, session });
    });
    return () => {
      vivant = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return etat;
}
