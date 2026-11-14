import { createFileRoute, Link } from "@tanstack/react-router";
import { Personnage } from "@/components/game/Personnage";
import { DEFAUT } from "@/game/apparence";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Isitech World — Le jeu multijoueur de l'école" },
      { name: "description", content: "Balade-toi dans l'école Isitech avec ta classe de BTS SIO SISR : cours, quiz et combats." },
      { property: "og:title", content: "Isitech World" },
      { property: "og:description", content: "Un jeu 2D multijoueur dans l'école Isitech." },
    ],
  }),
  component: Accueil,
});

function Accueil() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 text-center">
      <Personnage a={DEFAUT} marche taille={140} />
      <h1 className="font-pixel text-3xl leading-snug text-primary md:text-5xl">ISITECH<br /><span className="text-accent">WORLD</span></h1>
      <p className="max-w-md text-2xl text-muted-foreground">Retrouve ta classe dans les couloirs de l'école, partage tes cours et affronte les monstres de la salle serveur.</p>
      <Link to="/connexion" className="pixel-btn anim-blink">▶ PRESS START</Link>
    </div>
  );
}
