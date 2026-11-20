/**
 * MODE HISTOIRE — chapitres, missions et dialogues.
 * Tout est DONNÉES (CHAPITRES) : ajouter un chapitre, une mission ou une énigme = ajouter un objet, pas de nouveau code.
 * Les missions avancent avec les actions du jeu (parler, visiter, combattre, lire le tableau, déposer un cours,
 * répondre à une énigme, gagner un badge). Logique pure et testée ; la sauvegarde se fait sur l'appareil, par joueur.
 */
import type { Difficulte } from "./combat";

export type Evenement =
  | { k: "parler"; pnj: string }
  | { k: "visite"; salle: string }
  | { k: "combat"; victoire: boolean; difficulte: Difficulte; bonnes: number }
  | { k: "tableau" }
  | { k: "depot" }
  | { k: "enigme"; id: string; bonne: boolean }
  | { k: "badge"; id: string };

/** Condition d'une mission : seuls les champs indiqués sont vérifiés. */
export type Condition = Partial<{
  k: Evenement["k"];
  pnj: string;
  salle: string;
  victoire: boolean;
  difficulteMin: Difficulte;
  bonnesMin: number;
  id: string;
  bonne: boolean;
}>;

/** Une énigme posée par un PNJ, affichée dans une fenêtre de dialogue à choix. */
export type Enigme = {
  id: string;
  question: string;
  choix: string[];
  bonne: number;
  succes: string;
  echec: string;
};

export type Mission = {
  id: string;
  objectif: string;
  dialogue: string;
  cond: Condition;
  xp: number;
  enigme?: Enigme;
};
export type Chapitre = {
  id: string;
  titre: string;
  intro: string;
  missions: Mission[];
  recompense: number;
  conclusion: string;
};

const ORDRE: Difficulte[] = ["facile", "normal", "difficile", "cauchemar"];

export const CHAPITRES: Chapitre[] = [
  {
    id: "c1",
    titre: "Chapitre 1 — Le signal étrange",
    intro:
      "Ce matin, les écrans de supervision affichent des alertes inconnues. Le réseau d'Isitech ressent une présence étrange. L'hôtesse de l'accueil te demande de mener l'enquête, et le référent informatique a besoin d'aide pour comprendre ce qui se passe.",
    recompense: 50,
    conclusion:
      "Le premier virus est repoussé. Mais l'alerte a une source bien précise : elle vient du tableau d'affichage, et quelqu'un semble l'avoir provoquée exprès.",
    missions: [
      {
        id: "c1m1",
        objectif: "Parler à l'hôtesse de l'accueil",
        xp: 10,
        dialogue:
          "« Des alertes remontent du serveur depuis ce matin. Commence par la salle Serveurs, et jette un œil au tableau d'affichage en sortant. »",
        cond: { k: "parler", pnj: "accueil-hotesse" },
      },
      {
        id: "c1m2",
        objectif: "Parler au Référent Informatique",
        xp: 10,
        dialogue:
          "« J'ai vu passer un pic de trafic bizarre cette nuit. Ça vient de la salle Serveurs. Va vérifier les baies de brassage. »",
        cond: { k: "parler", pnj: "ref-ref" },
      },
      {
        id: "c1m3",
        objectif: "Te rendre dans la salle Serveurs",
        xp: 10,
        dialogue:
          "Les baies clignotent d'une lumière rouge inhabituelle. Un virus s'est installé. Il faut le combattre sur un PC gaming.",
        cond: { k: "visite", salle: "serveurs" },
      },
      {
        id: "c1m4",
        objectif: "Résoudre l'énigme du technicien du Labo",
        xp: 15,
        dialogue:
          "Le technicien hoche la tête : « Pas mal. Un virus qui se réplique, ça se combat avec de la rigueur, pas de la panique. »",
        cond: { k: "enigme", id: "labo-ping", bonne: true },
        enigme: {
          id: "labo-ping",
          question:
            "Un élève te demande : « Je veux vérifier si le serveur de cours répond avant de m'y connecter. Quelle commande j'utilise ? »",
          choix: ["ping", "chmod", "ls -la", "cd .."],
          bonne: 0,
          succes: "Exactement : ping envoie un petit signal et attend la réponse du serveur.",
          echec:
            "Pas tout à fait : c'est ping qui sert à vérifier qu'une machine répond sur le réseau.",
        },
      },
      {
        id: "c1m5",
        objectif: "Gagner un combat sur un PC gaming",
        xp: 20,
        dialogue:
          "Le virus est tombé. Mais tu sens que d'autres attaques, plus sournoises, arrivent déjà.",
        cond: { k: "combat", victoire: true },
      },
    ],
  },
  {
    id: "c2",
    titre: "Chapitre 2 — Le serveur infecté",
    intro:
      "Le virus était un leurre. Un malware plus sournois s'est glissé dans le réseau, et des élèves signalent des messages étranges sur le tableau d'affichage. Le directeur et la pédagogie s'inquiètent pour les cours déposés par la classe.",
    recompense: 70,
    conclusion:
      "Le malware est neutralisé. Une dernière trace mène à un message signé : « R. ». Le directeur te confie qu'il a déjà vu cette signature, il y a longtemps.",
    missions: [
      {
        id: "c2m1",
        objectif: "Lire le tableau d'affichage de l'accueil",
        xp: 10,
        dialogue:
          "Une annonce suspecte est épinglée, rédigée comme si elle venait de la direction. Elle a été publiée depuis un compte inconnu.",
        cond: { k: "tableau" },
      },
      {
        id: "c2m2",
        objectif: "Parler au Directeur",
        xp: 10,
        dialogue:
          "« Cette annonce n'est pas de moi. Quelqu'un usurpe mon nom sur le réseau. Trouve qui a accès à ce niveau de privilège. »",
        cond: { k: "parler", pnj: "dir-directeur" },
      },
      {
        id: "c2m3",
        objectif: "Parler au responsable Pédagogie",
        xp: 10,
        dialogue:
          "« Les cours déposés sont notre bien le plus précieux. Protège-les. Et méfie-toi des réponses trop rapides, un malware aime perturber le jugement. »",
        cond: { k: "parler", pnj: "ped-resp" },
      },
      {
        id: "c2m4",
        objectif: "Résoudre l'énigme de l'élève de la salle Vénus",
        xp: 15,
        dialogue:
          "« Bien vu ! Un VLAN, ça sépare vraiment le trafic, contrairement à une simple étiquette. »",
        cond: { k: "enigme", id: "venus-vlan", bonne: true },
        enigme: {
          id: "venus-vlan",
          question: "« À quoi sert un VLAN sur un réseau d'entreprise ? »",
          choix: [
            "À segmenter le réseau en groupes séparés",
            "À accélérer la connexion Wi-Fi",
            "À chiffrer les mots de passe",
            "À sauvegarder des fichiers",
          ],
          bonne: 0,
          succes:
            "C'est ça : un VLAN segmente le réseau en groupes indépendants, même sur le même câblage.",
          echec:
            "Non : un VLAN sert à segmenter le réseau en groupes séparés, pas à accélérer ou chiffrer quoi que ce soit.",
        },
      },
      {
        id: "c2m5",
        objectif: "Gagner un combat avec au moins 4 bonnes réponses",
        xp: 25,
        dialogue:
          "Tes réponses sont précises. Le malware perd sa couverture : il frappait au hasard, pas toi.",
        cond: { k: "combat", victoire: true, bonnesMin: 4 },
      },
      {
        id: "c2m6",
        objectif: "Vaincre un malware en difficulté Difficile",
        xp: 35,
        dialogue:
          "Le malware se désintègre dans un flash. Son code contient une signature : « Ransomware ».",
        cond: { k: "combat", victoire: true, difficulteMin: "difficile" },
      },
    ],
  },
  {
    id: "c3",
    titre: "Chapitre 3 — Les complices du réseau",
    intro:
      "La signature « R. » ne vient pas de nulle part : un réseau de petits bugs et de malwares relais prépare le terrain pour une attaque bien plus grande. Les salles Développeur et Commerce remontent des anomalies.",
    recompense: 80,
    conclusion:
      "Les relais du Ransomware sont coupés un par un. Il ne reste plus que le cœur de l'attaque : le Ransomware lui-même, retranché quelque part dans le réseau.",
    missions: [
      {
        id: "c3m1",
        objectif: "Parler au développeur",
        xp: 10,
        dialogue:
          "« J'ai trouvé un bout de code suspect dans les logs. On dirait un relais. Entraîne-toi encore, tu vas en avoir besoin. »",
        cond: { k: "parler", pnj: "dev-dev" },
      },
      {
        id: "c3m2",
        objectif: "Parler au chargé de commerce",
        xp: 10,
        dialogue:
          "« Des mails bizarres sont partis au nom de l'école. On dirait une tentative de phishing. »",
        cond: { k: "parler", pnj: "com-agent" },
      },
      {
        id: "c3m3",
        objectif: "Résoudre l'énigme du cuistot de la cafétéria",
        xp: 15,
        dialogue:
          "Le cuistot approuve d'un sourire : « Exactement. Toujours vérifier avant de cliquer. »",
        cond: { k: "enigme", id: "cafe-phishing", bonne: true },
        enigme: {
          id: "cafe-phishing",
          question:
            "« Un mail te demande de cliquer d'urgence sur un lien pour « sauver ton compte ». Que fais-tu ? »",
          choix: [
            "Je vérifie l'adresse de l'expéditeur avant de cliquer",
            "Je clique vite, c'est urgent",
            "Je réponds avec mon mot de passe",
            "Je transfère le mail à tous mes amis",
          ],
          bonne: 0,
          succes:
            "Exactement : on vérifie toujours l'expéditeur avant de cliquer sur un lien « urgent ».",
          echec:
            "Attention : un mail « urgent » est justement la technique préférée du phishing. Vérifie toujours avant de cliquer.",
        },
      },
      {
        id: "c3m4",
        objectif: "Gagner 2 combats (n'importe lesquels)",
        xp: 20,
        dialogue: "Les relais tombent les uns après les autres. Le réseau respire un peu mieux.",
        cond: { k: "combat", victoire: true },
      },
      {
        id: "c3m5",
        objectif: "Décrocher le badge Chasseur de virus",
        xp: 20,
        dialogue:
          "Ton nom commence à circuler dans l'école : tu es devenu une référence contre les menaces du réseau.",
        cond: { k: "badge", id: "chasseur" },
      },
    ],
  },
  {
    id: "c4",
    titre: "Chapitre 4 — Le piège du Ransomware",
    intro:
      "Le Ransomware a lancé son plan : chiffrer tous les cours de l'école pour les garder en otage. Chaque cours sauvegardé à temps est un cours sauvé. Le labo a besoin de ton aide pour préparer la dernière ligne droite.",
    recompense: 90,
    conclusion:
      "Les cours de la classe sont en sécurité. Le Ransomware n'a plus rien à prendre en otage. Il ne lui reste que la colère, et une dernière confrontation.",
    missions: [
      {
        id: "c4m1",
        objectif: "Déposer un cours sur le réseau Isitech",
        xp: 20,
        dialogue:
          "Ton cours est sauvegardé sur le réseau. Le Ransomware ne pourra plus rien chiffrer d'essentiel.",
        cond: { k: "depot" },
      },
      {
        id: "c4m2",
        objectif: "Parler au technicien du Labo",
        xp: 10,
        dialogue:
          "« Le Ransomware utilise une faille classique : il compte sur l'absence de sauvegardes. Chaque cours déposé est une victoire. »",
        cond: { k: "parler", pnj: "labo-chercheur" },
      },
      {
        id: "c4m3",
        objectif: "Résoudre l'énigme de la salle Mercure",
        xp: 15,
        dialogue:
          "« Voilà. C'est exactement pour ça qu'on fait des sauvegardes régulières, pas seulement une fois. »",
        cond: { k: "enigme", id: "mercure-sauvegarde", bonne: true },
        enigme: {
          id: "mercure-sauvegarde",
          question:
            "« Pourquoi fait-on des sauvegardes régulières d'un serveur, et pas une seule fois pour toutes ? »",
          choix: [
            "Parce que les données changent avec le temps",
            "Parce que ça rend l'ordinateur plus rapide",
            "Parce que c'est obligatoire par la loi française",
            "Parce que ça économise de l'électricité",
          ],
          bonne: 0,
          succes:
            "Exactement : les données évoluent, donc une sauvegarde doit être répétée pour rester utile.",
          echec:
            "Non : la bonne raison est que les données changent avec le temps, donc une sauvegarde unique devient vite dépassée.",
        },
      },
      {
        id: "c4m4",
        objectif: "Gagner un combat en difficulté Difficile ou plus",
        xp: 25,
        dialogue:
          "Le réseau se stabilise. Plus qu'une seule menace à affronter : la source de tout ça.",
        cond: { k: "combat", victoire: true, difficulteMin: "difficile" },
      },
    ],
  },
  {
    id: "c5",
    titre: "Chapitre 5 — Le Ransomware",
    intro:
      "Le message signé « R. » annonce l'attaque finale. Le Ransomware se retranche dans la salle serveur, prêt à tout chiffrer d'un coup. C'est le moment d'affronter le boss, avec tout ce que tu as appris.",
    recompense: 120,
    conclusion:
      "Dans un dernier cri, le Ransomware se tait. Ses fichiers sont libérés un à un. Isitech est en sécurité, et tes cours sont sauvegardés. Félicitations, tu as terminé l'histoire !",
    missions: [
      {
        id: "c5m1",
        objectif: "Parler à l'hôtesse de l'accueil",
        xp: 10,
        dialogue:
          "« Tout le monde compte sur toi. Le Ransomware est retranché dans la salle Serveurs. Vas-y, nous sommes avec toi. »",
        cond: { k: "parler", pnj: "accueil-hotesse" },
      },
      {
        id: "c5m2",
        objectif: "Vaincre le Ransomware en difficulté Cauchemar",
        xp: 60,
        dialogue: "Dans un dernier cri, le Ransomware se tait. Ses fichiers sont libérés un à un.",
        cond: { k: "combat", victoire: true, difficulteMin: "cauchemar" },
      },
      {
        id: "c5m3",
        objectif: "Décrocher le badge Sans faute (gagner un combat sans aucune erreur)",
        xp: 30,
        dialogue: "Une victoire parfaite. Le réseau d'Isitech n'oubliera pas ce jour.",
        cond: { k: "badge", id: "parfait" },
      },
    ],
  },
];

export type EtatHistoire = { chapitre: number; faites: string[]; termine: boolean };
export const ETAT_INITIAL: EtatHistoire = { chapitre: 0, faites: [], termine: false };

/** Vrai si l'événement remplit la condition de la mission. */
export function correspond(c: Condition, ev: Evenement): boolean {
  if (c.k !== undefined && c.k !== ev.k) return false;
  if (ev.k === "parler" && c.pnj !== undefined) return c.pnj === ev.pnj;
  if (ev.k === "visite" && c.salle !== undefined) return c.salle === ev.salle;
  if (ev.k === "combat") {
    if (c.victoire !== undefined && c.victoire !== ev.victoire) return false;
    if (
      c.difficulteMin !== undefined &&
      ORDRE.indexOf(ev.difficulte) < ORDRE.indexOf(c.difficulteMin)
    )
      return false;
    if (c.bonnesMin !== undefined && ev.bonnes < c.bonnesMin) return false;
  }
  if (ev.k === "enigme") {
    if (c.id !== undefined && c.id !== ev.id) return false;
    if (c.bonne !== undefined && c.bonne !== ev.bonne) return false;
  }
  if (ev.k === "badge" && c.id !== undefined) return c.id === ev.id;
  return true;
}

export type Gains = {
  xp: number;
  missions: Mission[];
  chapitreTermine: Chapitre | null;
  fini: boolean;
};

/** Fait avancer l'histoire avec un événement de jeu. Renvoie le nouvel état et ce qui a été gagné. */
export function progresser(e: EtatHistoire, ev: Evenement): { etat: EtatHistoire; gains: Gains } {
  const gains: Gains = { xp: 0, missions: [], chapitreTermine: null, fini: false };
  if (e.termine) return { etat: e, gains };
  const chap = CHAPITRES[e.chapitre];
  if (!chap) return { etat: { ...e, termine: true }, gains: { ...gains, fini: true } };

  const faites = [...e.faites];
  for (const m of chap.missions) {
    if (faites.includes(m.id)) continue;
    if (!correspond(m.cond, ev)) continue;
    faites.push(m.id);
    gains.xp += m.xp;
    gains.missions.push(m);
  }
  let next: EtatHistoire = { ...e, faites };
  if (chap.missions.every((m) => faites.includes(m.id))) {
    gains.xp += chap.recompense;
    gains.chapitreTermine = chap;
    const suivant = e.chapitre + 1;
    next =
      suivant < CHAPITRES.length
        ? { chapitre: suivant, faites: [], termine: false }
        : { chapitre: suivant, faites: [], termine: true };
    gains.fini = next.termine;
  }
  return { etat: next, gains };
}

/** La mission d'énigme en cours pour ce chapitre, si elle n'est pas encore faite (pour l'afficher au bon PNJ). */
export function enigmeEnAttente(e: EtatHistoire, id: string): Enigme | null {
  if (e.termine) return null;
  const chap = CHAPITRES[e.chapitre];
  if (!chap) return null;
  const m = chap.missions.find((x) => x.enigme?.id === id);
  if (!m || e.faites.includes(m.id)) return null;
  return m.enigme ?? null;
}

/** Résumé pour l'affichage : chapitre courant, missions, avancement. */
export function resume(e: EtatHistoire) {
  const total = CHAPITRES.reduce((n, c) => n + c.missions.length, 0);
  const avant = CHAPITRES.slice(0, Math.min(e.chapitre, CHAPITRES.length)).reduce(
    (n, c) => n + c.missions.length,
    0,
  );
  const chap = e.termine ? null : (CHAPITRES[e.chapitre] ?? null);
  return {
    chapitre: chap,
    missions: chap
      ? chap.missions.map((m) => ({ mission: m, faite: e.faites.includes(m.id) }))
      : [],
    terminee: e.termine,
    pourcent: total === 0 ? 0 : Math.round(((avant + (chap ? e.faites.length : 0)) / total) * 100),
  };
}

/* ───────────── Sauvegarde sur l'appareil, par joueur ───────────── */
const cle = (uid: string) => `isitech.histoire.v1.${uid}`;
export function lireHistoire(uid: string): EtatHistoire {
  try {
    const b = typeof localStorage !== "undefined" ? localStorage.getItem(cle(uid)) : null;
    if (!b) return ETAT_INITIAL;
    const j = JSON.parse(b) as Partial<EtatHistoire>;
    return {
      chapitre: Number(j.chapitre) || 0,
      faites: Array.isArray(j.faites) ? j.faites.filter((x) => typeof x === "string") : [],
      termine: !!j.termine,
    };
  } catch {
    return ETAT_INITIAL;
  }
}
export function ecrireHistoire(uid: string, e: EtatHistoire): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(cle(uid), JSON.stringify(e));
  } catch {
    /* stockage indisponible */
  }
}
