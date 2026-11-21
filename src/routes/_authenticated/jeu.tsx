import { createFileRoute } from "@tanstack/react-router";
import { EcranJeu } from "@/components/game/Partie";

export const Route = createFileRoute("/_authenticated/jeu")({
  head: () => ({
    meta: [
      { title: "Multijoueur — Isitech World" },
      { name: "description", content: "Promène-toi dans l'école Isitech avec ta classe." },
      { property: "og:title", content: "Multijoueur — Isitech World" },
      { property: "og:description", content: "Le jeu multijoueur de la classe BTS SIO SISR." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <EcranJeu mode="multi" />,
});
