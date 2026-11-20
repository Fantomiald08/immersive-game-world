import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Chargement } from "@/components/game/Chargement";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingMs: 150,
  pendingComponent: () => <Chargement plein texte="Connexion…" />,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/connexion" });
  },
  component: () => <Outlet />,
});
