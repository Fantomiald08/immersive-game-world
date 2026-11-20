import { createFileRoute } from "@tanstack/react-router";
import { EcranJeu } from "@/components/game/Partie";

export const Route = createFileRoute("/_authenticated/histoire")({
  head: () => ({
    meta: [
      { title: "Mode Histoire — Isitech World" },
      { name: "description", content: "Vis l'histoire d'Isitech en solo, à ton rythme." },
      { property: "og:title", content: "Mode Histoire — Isitech World" },
      {
        property: "og:description",
        content: "Le mode solo d'Isitech World : missions, énigmes, combats.",
      },
    ],
  }),
  component: () => <EcranJeu mode="solo" />,
});
