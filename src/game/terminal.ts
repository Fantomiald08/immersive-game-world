/**
 * TERMINAL LINUX — système de fichiers virtuel + interpréteur de commandes.
 * Objectif pédagogique BTS SISR : navigation, fichiers, droits (chmod), espace disque limité.
 * Tout est pur et testé (aucun accès au vrai système : c'est une simulation en mémoire/JSON).
 */
export type Permission = { lecture: boolean; ecriture: boolean; execution: boolean };
export type Noeud =
  | { type: "fichier"; nom: string; contenu: string; taille: number; perms: string }
  | { type: "dossier"; nom: string; enfants: Record<string, Noeud>; perms: string };

export type Etat = { racine: Noeud; chemin: string[]; quotaOctets: number; utilisateur: string };
export type Resultat = { etat: Etat; sortie: string; erreur: boolean };

/** Quota « moyen » : 512 Ko virtuels. Volontairement limité pour forcer à gérer l'espace, comme un vrai disque. */
export const QUOTA_MOYEN = 512 * 1024;

type Dossier = Extract<Noeud, { type: "dossier" }>;
const dossier = (perms = "rwxr-xr-x"): Dossier => ({
  type: "dossier",
  nom: "",
  enfants: {},
  perms,
});

export function etatInitial(utilisateur = "eleve", quotaOctets = QUOTA_MOYEN): Etat {
  const racine = dossier();
  const home: Dossier = { ...dossier(), nom: "home" };
  home.enfants[utilisateur] = { ...dossier("rwxr-xr-x"), nom: utilisateur };
  racine.enfants["home"] = home;
  return { racine, chemin: ["home", utilisateur], quotaOctets, utilisateur };
}

/* ───────────── Chemins ───────────── */
const normaliser = (actuel: readonly string[], cible: string): string[] => {
  const segs = cible.startsWith("/") ? cible.split("/") : [...actuel, ...cible.split("/")];
  const r: string[] = [];
  for (const s of segs) {
    if (s === "" || s === ".") continue;
    if (s === "..") {
      if (r.length) r.pop();
      continue;
    }
    r.push(s);
  }
  return r;
};

function trouver(racine: Noeud, chemin: readonly string[]): Noeud | null {
  let n: Noeud = racine;
  for (const seg of chemin) {
    if (n.type !== "dossier") return null;
    const suivant = n.enfants[seg];
    if (!suivant) return null;
    n = suivant;
  }
  return n;
}
const dossierParent = (
  racine: Noeud,
  chemin: readonly string[],
): Extract<Noeud, { type: "dossier" }> | null => {
  const p = trouver(racine, chemin.slice(0, -1));
  return p && p.type === "dossier" ? p : null;
};

/** Taille totale occupée (fichiers uniquement, récursif). */
export function tailleTotale(n: Noeud): number {
  if (n.type === "fichier") return n.taille;
  return Object.values(n.enfants).reduce((s, c) => s + tailleTotale(c), 0);
}
export const espaceLibre = (e: Etat) => Math.max(0, e.quotaOctets - tailleTotale(e.racine));

/* ───────────── Droits (simplifié : rwx sur le propriétaire uniquement, mono-utilisateur) ───────────── */
export function lirePermission(perms: string): Permission {
  return { lecture: perms[0] === "r", ecriture: perms[1] === "w", execution: perms[2] === "x" };
}
export function modeVersPerms(mode: string): string | null {
  if (!/^[0-7]{3}$/.test(mode)) return null;
  const bits = "0123".padStart(1, "0");
  void bits;
  const car = (c: string) => [
    c[2] === "1" ? "" : "",
    c[1] === "1" ? "" : "",
    c[0] === "1" ? "" : "",
  ]; // inutilisé, gardé simple ci-dessous
  void car;
  const chiffre = Number(mode[0]);
  const r = chiffre & 4 ? "r" : "-",
    w = chiffre & 2 ? "w" : "-",
    x = chiffre & 1 ? "x" : "-";
  return r + w + x + "r-xr-x"; // le propriétaire change, groupe/autres restent en lecture/exécution par simplicité
}

/* ───────────── Commandes ───────────── */
type Ctx = { etat: Etat; args: string[]; brut: string };
type Cmd = (c: Ctx) => { etat: Etat; sortie: string; erreur?: boolean };

const chemins = (e: Etat) => "/" + e.chemin.join("/");
const erreur = (e: Etat, msg: string) => ({ etat: e, sortie: msg, erreur: true });

const ls: Cmd = ({ etat, args }) => {
  const montrerCaches = args.includes("-a") || args.includes("-la") || args.includes("-al");
  const long = args.includes("-l") || args.includes("-la") || args.includes("-al");
  const cible = args.find((a) => !a.startsWith("-"));
  const chemin = cible ? normaliser(etat.chemin, cible) : etat.chemin;
  const n = trouver(etat.racine, chemin);
  if (!n) return erreur(etat, `ls: ${cible ?? "."} : fichier ou dossier introuvable`);
  if (n.type === "fichier") return { etat, sortie: n.nom };
  const noms = Object.keys(n.enfants).sort();
  if (noms.length === 0) return { etat, sortie: "" };
  const lignes = noms
    .map((nom) => {
      const e2 = n.enfants[nom]!;
      if (!montrerCaches && nom.startsWith(".")) return null;
      if (!long) return e2.type === "dossier" ? `${nom}/` : nom;
      const taille = e2.type === "fichier" ? e2.taille : tailleTotale(e2);
      return `${e2.perms} ${String(taille).padStart(8)} ${e2.type === "dossier" ? nom + "/" : nom}`;
    })
    .filter((x): x is string => x !== null);
  return { etat, sortie: lignes.join("\n") };
};

const pwd: Cmd = ({ etat }) => ({ etat, sortie: chemins(etat) });

const cd: Cmd = ({ etat, args }) => {
  const cible = args[0] ?? "/home/" + etat.utilisateur;
  const chemin = normaliser(etat.chemin, cible);
  const n = trouver(etat.racine, chemin);
  if (!n) return erreur(etat, `cd: ${cible} : dossier introuvable`);
  if (n.type !== "dossier") return erreur(etat, `cd: ${cible} : n'est pas un dossier`);
  return { etat: { ...etat, chemin }, sortie: "" };
};

/** Clone profond d'un sous-arbre, pour ne jamais modifier l'ancien état (immutabilité). */
const cloner = (n: Noeud): Noeud =>
  n.type === "fichier"
    ? { ...n }
    : {
        ...n,
        enfants: Object.fromEntries(Object.entries(n.enfants).map(([k, v]) => [k, cloner(v)])),
      };

/** Remplace l'arborescence à `chemin` par `remplacement` (ou le supprime si null), en clonant le chemin parcouru. */
function remplacer(racine: Noeud, chemin: readonly string[], remplacement: Noeud | null): Noeud {
  if (chemin.length === 0) return remplacement ?? racine;
  const copie = cloner(racine) as Extract<Noeud, { type: "dossier" }>;
  let n = copie;
  for (let i = 0; i < chemin.length - 1; i++) {
    const suivant = n.enfants[chemin[i]!];
    if (!suivant || suivant.type !== "dossier") throw new Error("chemin invalide");
    n.enfants[chemin[i]!] = suivant;
    n = suivant as Extract<Noeud, { type: "dossier" }>;
  }
  const dernier = chemin[chemin.length - 1]!;
  if (remplacement === null) delete n.enfants[dernier];
  else n.enfants[dernier] = remplacement;
  return copie;
}

const mkdir: Cmd = ({ etat, args }) => {
  const recursif = args.includes("-p");
  const cibles = args.filter((a) => a !== "-p");
  if (cibles.length === 0) return erreur(etat, "mkdir: argument manquant");
  let racine = etat.racine;
  for (const cible of cibles) {
    const chemin = normaliser(etat.chemin, cible);
    if (recursif) {
      const n = racine;
      for (let i = 0; i < chemin.length; i++) {
        const partiel = chemin.slice(0, i + 1);
        const existant = trouver(racine, partiel);
        if (!existant)
          racine = remplacer(racine, partiel, { ...dossier(), nom: partiel[partiel.length - 1]! });
        else if (existant.type !== "dossier")
          return erreur(etat, `mkdir: ${cible} : un fichier du même nom existe déjà`);
        void n;
      }
    } else {
      const parent = dossierParent(racine, chemin);
      if (!parent)
        return erreur(
          etat,
          `mkdir: ${cible} : dossier parent introuvable (utilise -p pour créer les parents)`,
        );
      if (trouver(racine, chemin)) return erreur(etat, `mkdir: ${cible} : existe déjà`);
      racine = remplacer(racine, chemin, { ...dossier(), nom: chemin[chemin.length - 1]! });
    }
  }
  return { etat: { ...etat, racine }, sortie: "" };
};

const rmdir: Cmd = ({ etat, args }) => {
  const cible = args[0];
  if (!cible) return erreur(etat, "rmdir: argument manquant");
  const chemin = normaliser(etat.chemin, cible);
  const n = trouver(etat.racine, chemin);
  if (!n) return erreur(etat, `rmdir: ${cible} : introuvable`);
  if (n.type !== "dossier") return erreur(etat, `rmdir: ${cible} : n'est pas un dossier`);
  if (Object.keys(n.enfants).length > 0) return erreur(etat, `rmdir: ${cible} : dossier non vide`);
  return { etat: { ...etat, racine: remplacer(etat.racine, chemin, null) }, sortie: "" };
};

function verifierEcriture(etat: Etat, chemin: readonly string[]): string | null {
  const parent = dossierParent(etat.racine, chemin);
  if (!parent) return `dossier parent introuvable`;
  if (!lirePermission(parent.perms).ecriture)
    return `permission refusée (dossier en lecture seule)`;
  return null;
}

const touch: Cmd = ({ etat, args }) => {
  if (args.length === 0) return erreur(etat, "touch: argument manquant");
  let racine = etat.racine;
  for (const cible of args) {
    const chemin = normaliser(etat.chemin, cible);
    const pb = verifierEcriture({ ...etat, racine }, chemin);
    if (pb) return erreur(etat, `touch: ${cible} : ${pb}`);
    if (!trouver(racine, chemin))
      racine = remplacer(racine, chemin, {
        type: "fichier",
        nom: chemin[chemin.length - 1]!,
        contenu: "",
        taille: 0,
        perms: "rw-r--r--",
      });
  }
  return { etat: { ...etat, racine }, sortie: "" };
};

const rm: Cmd = ({ etat, args }) => {
  const recursif = args.includes("-r") || args.includes("-rf") || args.includes("-fr");
  const force = args.includes("-f") || args.includes("-rf") || args.includes("-fr");
  const cibles = args.filter((a) => !a.startsWith("-"));
  if (cibles.length === 0) return erreur(etat, "rm: argument manquant");
  let racine = etat.racine;
  for (const cible of cibles) {
    const chemin = normaliser(etat.chemin, cible);
    const n = trouver(racine, chemin);
    if (!n) {
      if (force) continue;
      return erreur(etat, `rm: ${cible} : introuvable`);
    }
    if (n.type === "dossier" && Object.keys(n.enfants).length > 0 && !recursif)
      return erreur(etat, `rm: ${cible} : dossier non vide (utilise -r)`);
    racine = remplacer(racine, chemin, null);
  }
  return { etat: { ...etat, racine }, sortie: "" };
};

const cat: Cmd = ({ etat, args }) => {
  if (args.length === 0) return erreur(etat, "cat: argument manquant");
  const textes: string[] = [];
  for (const cible of args) {
    const chemin = normaliser(etat.chemin, cible);
    const n = trouver(etat.racine, chemin);
    if (!n) return erreur(etat, `cat: ${cible} : introuvable`);
    if (n.type !== "fichier") return erreur(etat, `cat: ${cible} : est un dossier`);
    if (!lirePermission(n.perms).lecture) return erreur(etat, `cat: ${cible} : permission refusée`);
    textes.push(n.contenu);
  }
  return { etat, sortie: textes.join("\n") };
};

/** Écrit du contenu dans un fichier, en vérifiant le quota de stockage. */
function ecrireFichier(
  etat: Etat,
  chemin: readonly string[],
  contenu: string,
  ajouter: boolean,
): Resultat {
  const existant = trouver(etat.racine, chemin);
  if (existant && existant.type === "dossier")
    return { etat, sortie: `est un dossier`, erreur: true };
  if (existant && !lirePermission(existant.perms).ecriture)
    return { etat, sortie: `permission refusée`, erreur: true };
  const pb = verifierEcriture(etat, chemin);
  if (pb && !existant) return { etat, sortie: pb, erreur: true };
  const nouveauContenu =
    ajouter && existant?.type === "fichier" ? existant.contenu + contenu : contenu;
  const nouvelleTaille = new TextEncoder().encode(nouveauContenu).length;
  const tailleAvant = existant?.type === "fichier" ? existant.taille : 0;
  const libre = espaceLibre(etat) + tailleAvant;
  if (nouvelleTaille > libre) {
    return {
      etat,
      sortie: `espace disque insuffisant (${nouvelleTaille} o demandés, ${libre} o disponibles). Libère de la place avec rm.`,
      erreur: true,
    };
  }
  const racine = remplacer(etat.racine, chemin, {
    type: "fichier",
    nom: chemin[chemin.length - 1]!,
    contenu: nouveauContenu,
    taille: nouvelleTaille,
    perms: existant?.type === "fichier" ? existant.perms : "rw-r--r--",
  });
  return { etat: { ...etat, racine }, sortie: "", erreur: false };
}

const echo: Cmd = ({ etat, brut, args }) => {
  const m = brut.match(/^echo\s+(.*?)\s*(>>?)\s*(\S+)\s*$/);
  if (m) {
    const [, texteBrut, op, cible] = m;
    const texte = (texteBrut ?? "").replace(/^"(.*)"$/, "$1");
    const chemin = normaliser(etat.chemin, cible!);
    return ecrireFichier(etat, chemin, texte + "\n", op === ">>");
  }
  return { etat, sortie: args.join(" ").replace(/^"(.*)"$/, "$1") };
};

/** Crée ou redimensionne un fichier à une taille précise (en octets), pour s'entraîner à gérer l'espace disque. */
const truncate: Cmd = ({ etat, args }) => {
  const i = args.indexOf("-s");
  const cible = args.find((a, k) => k !== i && k !== i + 1 && !a.startsWith("-"));
  const taille = i >= 0 ? args[i + 1] : undefined;
  if (!cible || !taille)
    return erreur(etat, "truncate: usage truncate -s TAILLE fichier (ex : -s 50K, -s 2M)");
  const m = /^(\d+)([KM]?)$/.exec(taille);
  if (!m) return erreur(etat, "truncate: taille invalide (exemples : 100, 50K, 2M)");
  const octets = Number(m[1]) * (m[2] === "M" ? 1024 * 1024 : m[2] === "K" ? 1024 : 1);
  const chemin = normaliser(etat.chemin, cible);
  return ecrireFichier(etat, chemin, "\0".repeat(octets), false);
};

const cp: Cmd = ({ etat, args }) => {
  const recursif = args.includes("-r");
  const [src, dst] = args.filter((a) => a !== "-r");
  if (!src || !dst) return erreur(etat, "cp: usage cp [-r] source destination");
  const cheminSrc = normaliser(etat.chemin, src);
  const n = trouver(etat.racine, cheminSrc);
  if (!n) return erreur(etat, `cp: ${src} : introuvable`);
  if (n.type === "dossier" && !recursif)
    return erreur(etat, `cp: ${src} : est un dossier (utilise -r)`);
  let cheminDst = normaliser(etat.chemin, dst);
  const dstExistant = trouver(etat.racine, cheminDst);
  if (dstExistant?.type === "dossier") cheminDst = [...cheminDst, n.nom];
  const taille = tailleTotale(n);
  if (taille > espaceLibre(etat))
    return erreur(
      etat,
      `cp: espace disque insuffisant (${taille} o demandés, ${espaceLibre(etat)} o disponibles)`,
    );
  const pb = verifierEcriture(etat, cheminDst);
  if (pb) return erreur(etat, `cp: ${pb}`);
  const copie = cloner(n);
  copie.nom = cheminDst[cheminDst.length - 1]!;
  return { etat: { ...etat, racine: remplacer(etat.racine, cheminDst, copie) }, sortie: "" };
};

const mv: Cmd = ({ etat, args }) => {
  const [src, dst] = args;
  if (!src || !dst) return erreur(etat, "mv: usage mv source destination");
  const cheminSrc = normaliser(etat.chemin, src);
  const n = trouver(etat.racine, cheminSrc);
  if (!n) return erreur(etat, `mv: ${src} : introuvable`);
  let cheminDst = normaliser(etat.chemin, dst);
  const dstExistant = trouver(etat.racine, cheminDst);
  if (dstExistant?.type === "dossier") cheminDst = [...cheminDst, n.nom];
  const pb = verifierEcriture(etat, cheminDst);
  if (pb) return erreur(etat, `mv: ${pb}`);
  const copie = cloner(n);
  copie.nom = cheminDst[cheminDst.length - 1]!;
  let racine = remplacer(etat.racine, cheminSrc, null);
  racine = remplacer(racine, cheminDst, copie);
  return { etat: { ...etat, racine }, sortie: "" };
};

const chmod: Cmd = ({ etat, args }) => {
  const [mode, cible] = args;
  if (!mode || !cible)
    return erreur(etat, "chmod: usage chmod MODE fichier (ex : chmod 644 fichier)");
  const perms = modeVersPerms(mode);
  if (!perms) return erreur(etat, "chmod: mode invalide (utilise 3 chiffres, ex : 644, 755, 000)");
  const chemin = normaliser(etat.chemin, cible);
  const n = trouver(etat.racine, chemin);
  if (!n) return erreur(etat, `chmod: ${cible} : introuvable`);
  const racine = remplacer(etat.racine, chemin, { ...n, perms });
  return { etat: { ...etat, racine }, sortie: "" };
};

const octets = (o: number, h: boolean) =>
  !h
    ? `${o}`
    : o >= 1024 * 1024
      ? `${(o / 1024 / 1024).toFixed(1)}M`
      : o >= 1024
        ? `${(o / 1024).toFixed(1)}K`
        : `${o}o`;

const du: Cmd = ({ etat, args }) => {
  const h = args.includes("-h");
  const cible = args.find((a) => !a.startsWith("-"));
  const chemin = cible ? normaliser(etat.chemin, cible) : etat.chemin;
  const n = trouver(etat.racine, chemin);
  if (!n) return erreur(etat, `du: ${cible} : introuvable`);
  return { etat, sortie: `${octets(tailleTotale(n), h)}\t${cible ?? "."}` };
};

const df: Cmd = ({ etat, args }) => {
  const h = args.includes("-h");
  const utilise = tailleTotale(etat.racine),
    libre = espaceLibre(etat);
  return {
    etat,
    sortie: `Système de fichiers virtuel\nUtilisé : ${octets(utilise, h)}\nLibre   : ${octets(libre, h)}\nTotal   : ${octets(etat.quotaOctets, h)}`,
  };
};

const whoami: Cmd = ({ etat }) => ({ etat, sortie: etat.utilisateur });
const clear: Cmd = ({ etat }) => ({ etat, sortie: "\x1bclear" });

const find: Cmd = ({ etat, args }) => {
  const i = args.indexOf("-name");
  const motif = i >= 0 ? args[i + 1] : undefined;
  const depart = args.find((a, k) => k !== i && k !== i + 1 && !a.startsWith("-")) ?? ".";
  if (!motif) return erreur(etat, "find: usage find DOSSIER -name MOTIF");
  const chemin = normaliser(etat.chemin, depart);
  const racineRecherche = trouver(etat.racine, chemin);
  if (!racineRecherche) return erreur(etat, `find: ${depart} : introuvable`);
  const regex = new RegExp(
    "^" +
      motif
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".") +
      "$",
  );
  const resultats: string[] = [];
  const parcourir = (n: Noeud, chemin2: string) => {
    if (regex.test(n.nom || depart)) resultats.push(chemin2);
    if (n.type === "dossier")
      for (const [k, v] of Object.entries(n.enfants))
        parcourir(v, chemin2 === "." ? k : `${chemin2}/${k}`);
  };
  parcourir(racineRecherche, depart);
  return { etat, sortie: resultats.join("\n") };
};

const grep: Cmd = ({ etat, args }) => {
  const [motif, cible] = args;
  if (!motif || !cible) return erreur(etat, "grep: usage grep MOTIF fichier");
  const chemin = normaliser(etat.chemin, cible);
  const n = trouver(etat.racine, chemin);
  if (!n || n.type !== "fichier") return erreur(etat, `grep: ${cible} : fichier introuvable`);
  const lignes = n.contenu.split("\n").filter((l) => l.includes(motif));
  return { etat, sortie: lignes.join("\n") };
};

const AIDE = `Commandes disponibles :
  pwd, ls [-a] [-l], cd DOSSIER, mkdir [-p] DOSSIER, rmdir DOSSIER
  touch FICHIER, rm [-r] [-f] CIBLE, cp [-r] SRC DST, mv SRC DST
  cat FICHIER, echo TEXTE [> ou >> FICHIER], grep MOTIF FICHIER, find DOSSIER -name MOTIF
  chmod MODE FICHIER (ex : chmod 644 fichier), du [-h], df [-h], truncate -s TAILLE FICHIER
  whoami, clear, help`;
const help: Cmd = ({ etat }) => ({ etat, sortie: AIDE });

const COMMANDES: Record<string, Cmd> = {
  ls,
  pwd,
  cd,
  mkdir,
  rmdir,
  touch,
  rm,
  cat,
  echo,
  truncate,
  cp,
  mv,
  chmod,
  du,
  df,
  whoami,
  clear,
  find,
  grep,
  help,
  man: help,
};

/** Exécute une ligne de commande. N'altère jamais l'état reçu (immutabilité, comme tout le moteur du jeu). */
export function executer(etat: Etat, ligne: string): Resultat {
  const brut = ligne.trim();
  if (!brut) return { etat, sortie: "", erreur: false };
  const mots = brut.match(/"[^"]*"|\S+/g) ?? [];
  const nom = mots[0]!;
  const args = mots.slice(1);
  const cmd = COMMANDES[nom];
  if (!cmd)
    return {
      etat,
      sortie: `${nom} : commande introuvable (tape "help" pour la liste)`,
      erreur: true,
    };
  const r = cmd({ etat, args, brut });
  return { etat: r.etat, sortie: r.sortie, erreur: r.erreur ?? false };
}

export const invite = (e: Etat) =>
  `${e.utilisateur}@isitech:${chemins(e).replace(`/home/${e.utilisateur}`, "~")}$`;
