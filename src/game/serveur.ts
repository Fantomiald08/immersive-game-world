/**
 * Gestionnaire de serveur ISITECH (salle Serveurs, réservée aux admins).
 * Module pur : transforme des mesures réelles (base, temps réel, configuration IA, contenu du réseau)
 * en services, rôles, vérifications et événements, à la manière du Gestionnaire de serveur de Windows Server 2022.
 */
import type { Reseau } from "./reseau";

export const SEUIL_LENT_MS = 800;

export type EtatService = "En cours" | "Lent" | "Arrêté";
export type ServiceServeur = {
  nom: string;
  description: string;
  etat: EtatService;
  demarrage: "Automatique" | "Manuel";
  detail: string;
};
export type RoleServeur = { nom: string; description: string; nombre: number };
export type NiveauVerification = "Réussi" | "Avertissement" | "Erreur";
export type Verification = { titre: string; niveau: NiveauVerification; message: string };
export type NiveauEvenement = "Information" | "Avertissement";
export type EvenementServeur = {
  id: string;
  date: string;
  niveau: NiveauEvenement;
  source: string;
  message: string;
};
/** Mesures prises au moment de l'ouverture (ou du rafraîchissement) du gestionnaire. */
export type Mesures = {
  /** Temps de réponse de la base, en ms ; null si la base ne répond pas. */
  latenceMs: number | null;
  tempsReelOk: boolean;
  iaConfiguree: boolean;
  provisoire: boolean;
  nbProfils: number;
};

/** État d'un service de base de données selon le temps de réponse. */
export function etatBase(latenceMs: number | null): EtatService {
  if (latenceMs === null) return "Arrêté";
  return latenceMs > SEUIL_LENT_MS ? "Lent" : "En cours";
}

export function evaluerServices(m: Mesures): ServiceServeur[] {
  const base = etatBase(m.latenceMs);
  return [
    {
      nom: "Base de données",
      description: "Comptes, cours, quiz, fiches et annonces",
      etat: base,
      demarrage: "Automatique",
      detail: m.latenceMs === null ? "Aucune réponse" : `Réponse en ${m.latenceMs} ms`,
    },
    {
      nom: "Temps réel (salles et présence)",
      description: "Déplacements, bulles de discussion et joueurs connectés",
      etat: m.tempsReelOk ? "En cours" : "Arrêté",
      demarrage: "Automatique",
      detail: m.tempsReelOk ? "Canal ouvert" : "Canal fermé",
    },
    {
      nom: "Génération IA (quiz et fiches)",
      description: "Création automatique à partir des cours déposés",
      etat: m.iaConfiguree ? "En cours" : "Arrêté",
      demarrage: "Manuel",
      detail: m.iaConfiguree ? "Clé d'accès configurée" : "Clé d'accès absente",
    },
    {
      nom: "Comptes des élèves",
      description: "Connexion et profils",
      etat: base,
      demarrage: "Automatique",
      detail: `${m.nbProfils} profil(s) enregistré(s)`,
    },
  ];
}

/** Rôles du serveur : chaque rôle correspond à une partie du jeu, avec son nombre d'éléments. */
export function evaluerRoles(r: Reseau): RoleServeur[] {
  return [
    { nom: "Serveur de cours", description: "Cours, catégories et fichiers déposés", nombre: r.cours.length },
    { nom: "Serveur de quiz", description: "Quiz générés par l'IA ou créés à la main", nombre: r.quiz.length },
    { nom: "Serveur de fiches de révision", description: "Fiches générées à partir des cours", nombre: r.fiches.length },
    { nom: "Serveur d'annonces", description: "Messages publiés par les administrateurs", nombre: r.annonces.length },
  ];
}

/** Analyseur des meilleures pratiques : vérifie la configuration réelle du jeu. */
export function verifier(m: Mesures, r: Reseau): Verification[] {
  const quizParCours = new Set(r.quiz.map((q) => q.coursId));
  const sansQuiz = r.cours.filter((c) => !quizParCours.has(c.id)).length;
  const verifs: Verification[] = [];
  verifs.push(
    m.provisoire
      ? {
          titre: "Administrateurs",
          niveau: "Avertissement",
          message: "Mode provisoire actif : renseigne ADMIN_IDS dans admins.ts pour identifier les admins par leur compte.",
        }
      : {
          titre: "Administrateurs",
          niveau: "Réussi",
          message: "Les administrateurs sont identifiés par leur identifiant de compte.",
        },
  );
  verifs.push(
    m.iaConfiguree
      ? { titre: "Clé IA", niveau: "Réussi", message: "La clé d'accès à l'IA est configurée côté serveur." }
      : {
          titre: "Clé IA",
          niveau: "Erreur",
          message: "Aucune clé IA : la génération de quiz et de fiches est arrêtée.",
        },
  );
  if (m.latenceMs === null)
    verifs.push({ titre: "Base de données", niveau: "Erreur", message: "La base de données ne répond pas." });
  else if (m.latenceMs > SEUIL_LENT_MS)
    verifs.push({
      titre: "Base de données",
      niveau: "Avertissement",
      message: `Réponse lente (${m.latenceMs} ms, seuil ${SEUIL_LENT_MS} ms).`,
    });
  else verifs.push({ titre: "Base de données", niveau: "Réussi", message: `Réponse en ${m.latenceMs} ms.` });
  verifs.push(
    sansQuiz > 0
      ? {
          titre: "Cours sans quiz",
          niveau: "Avertissement",
          message: `${sansQuiz} cours n'ont pas encore de quiz.`,
        }
      : { titre: "Cours sans quiz", niveau: "Réussi", message: "Tous les cours ont un quiz." },
  );
  return verifs;
}

/** Journal des événements du jeu, du plus récent au plus ancien. */
export function evenementsRecents(r: Reseau, limite = 60): EvenementServeur[] {
  const liste: EvenementServeur[] = [
    ...r.cours.map((c) => ({
      id: `cours-${c.id}`,
      date: c.date,
      niveau: "Information" as const,
      source: "Réseau cours",
      message: `Cours déposé : ${c.titre} (par ${c.auteur})`,
    })),
    ...r.quiz.map((q) => ({
      id: `quiz-${q.id}`,
      date: q.date,
      niveau: "Information" as const,
      source: "Quiz",
      message: `Quiz ${q.source === "ia" ? "généré par l'IA" : "créé à la main"} (par ${q.auteur})`,
    })),
    ...r.fiches.map((f) => ({
      id: `fiche-${f.id}`,
      date: f.date,
      niveau: "Information" as const,
      source: "Fiches de révision",
      message: `Fiche « ${f.fiche.titre} » (par ${f.auteur})`,
    })),
    ...r.annonces.map((a) => ({
      id: `annonce-${a.id}`,
      date: a.date,
      niveau: "Information" as const,
      source: "Annonces",
      message: `Annonce : ${a.titre} (par ${a.auteur})`,
    })),
  ];
  return liste.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, limite);
}
