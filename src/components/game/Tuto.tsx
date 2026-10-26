import { useState } from "react";
import { Fenetre } from "./Fenetre";
import { nomTouche, useReglages } from "@/game/reglages";

/** Petit tutoriel au premier lancement. */
export function Tuto({ onFin }: { onFin: () => void }) {
  const r = useReglages();
  const [i, setI] = useState(0);
  const t = r.touches;
  const pages = [
    {
      titre: "Bienvenue à Isitech !",
      texte:
        "Tu es dans l'école. Explore-la comme dans un jeu : chaque salle est différente, et les autres élèves sont là en direct.",
    },
    {
      titre: "Se déplacer",
      texte: `Avance avec ${["haut", "gauche", "bas", "droite"].map((a) => nomTouche(t[a as "haut"][0]!)).join(" ")} (ou les flèches). Maintiens ${nomTouche(t.courir[0]!)} pour courir. Tu te déplaces case par case. Sur mobile, utilise le joystick.`,
    },
    {
      titre: "Interagir",
      texte: `Place-toi face à une porte, un ordinateur ou un personnage et appuie sur ${nomTouche(t.agir[0]!)}. Pour passer d'une zone à l'autre, marche jusqu'au bord de l'écran.`,
    },
    {
      titre: "Le réseau Isitech",
      texte:
        "Utilise un ordinateur (dans les salles et à l'accueil), puis « Entrer sur le réseau Isitech » : tu peux y déposer des cours de tout type, créer des catégories et voir l'activité de la classe.",
    },
    {
      titre: "Progresser",
      texte:
        "Réussis des quiz, bats les monstres de la salle serveur, fais les quêtes du jour. Tu gagnes de l'XP et tu montes dans le classement de la cafétéria. Le menu ⚙ permet de changer les touches.",
    },
  ];
  const p = pages[i]!;
  return (
    <Fenetre titre={p.titre} onFermer={onFin}>
      <p className="text-xl">{p.texte}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="font-pixel text-[9px] text-muted-foreground">
          {i + 1} / {pages.length}
        </span>
        <span className="flex gap-2">
          <button className="pixel-btn !px-2 !py-1" onClick={onFin}>
            Passer
          </button>
          {i > 0 && (
            <button className="pixel-btn !px-2 !py-1" onClick={() => setI(i - 1)}>
              ◀
            </button>
          )}
          <button
            className="pixel-btn !px-2 !py-1"
            onClick={() => (i + 1 < pages.length ? setI(i + 1) : onFin())}
          >
            {i + 1 < pages.length ? "Suivant ▶" : "C'est parti !"}
          </button>
        </span>
      </div>
    </Fenetre>
  );
}
