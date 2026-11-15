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
      texte: `Place-toi face à une porte, un ordinateur ou un personnage et appuie sur ${nomTouche(t.agir[0]!)}. Change de direction quand tu veux : le personnage répond tout de suite. Pour passer d'une zone à l'autre, marche jusqu'au bord de l'écran.`,
    },
    {
      titre: "Discuter avec les autres",
      texte:
        "Écris dans la barre du bas pour afficher une bulle de 4 secondes. Le bouton 📌 Statut affiche un message au-dessus de ta tête pendant 5 minutes. ✉ Messages permet d'écrire en privé à un élève connecté. Le tableau d'affichage de l'accueil donne les annonces et ton journal.",
    },
    {
      titre: "Deux réseaux : cours et combat",
      texte:
        "Les ordinateurs (accueil, salles) ouvrent le réseau COURS : dépôt de cours, catégories, quiz. Les PC gaming (salles Serveurs, Développeur et Labo) ouvrent le réseau COMBAT : choisis un quiz, une difficulté, et affronte un monstre pour gagner de l'XP.",
    },
    {
      titre: "Progresser",
      texte:
        "Réussis des quiz, bats les monstres de la salle serveur, fais les quêtes du jour. Tu gagnes de l'XP et tu montes dans le classement de la cafétéria. Le menu ⚙ permet de changer les touches, et 🗺 Carte montre où sont les autres.",
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
