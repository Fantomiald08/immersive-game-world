import { describe, expect, it } from "vitest";
import {
  espaceLibre,
  etatInitial,
  executer,
  invite,
  modeVersPerms,
  tailleTotale,
  type Etat,
} from "./terminal";

const enchainer = (e: Etat, ...lignes: string[]) =>
  lignes.reduce((etat, l) => executer(etat, l).etat, e);
const sortieDe = (e: Etat, ligne: string) => executer(e, ligne).sortie;

describe("état initial et invite", () => {
  it("démarre dans /home/eleve, avec un quota moyen et aucun fichier", () => {
    const e = etatInitial();
    expect(invite(e)).toBe("eleve@isitech:~$");
    expect(tailleTotale(e.racine)).toBe(0);
    expect(espaceLibre(e)).toBe(e.quotaOctets);
  });
});

describe("navigation", () => {
  it("pwd, mkdir, cd fonctionnent ensemble, en chemin relatif et absolu", () => {
    let e = etatInitial();
    e = enchainer(e, "mkdir projets", "cd projets", "mkdir sisr", "cd sisr");
    expect(sortieDe(e, "pwd")).toBe("/home/eleve/projets/sisr");
    e = executer(e, "cd /home/eleve").etat;
    expect(sortieDe(e, "pwd")).toBe("/home/eleve");
    e = executer(e, "cd ..").etat;
    expect(sortieDe(e, "pwd")).toBe("/home");
  });
  it("cd sans argument ramène au dossier personnel", () => {
    let e = etatInitial();
    e = enchainer(e, "mkdir a", "cd a", "cd");
    expect(sortieDe(e, "pwd")).toBe("/home/eleve");
  });
  it("cd vers un dossier inexistant échoue proprement", () => {
    const r = executer(etatInitial(), "cd inconnu");
    expect(r.erreur).toBe(true);
    expect(r.sortie).toContain("introuvable");
  });
  it("mkdir sans -p échoue si le parent n'existe pas, réussit avec -p", () => {
    const e = etatInitial();
    expect(executer(e, "mkdir a/b/c").erreur).toBe(true);
    const ok = executer(e, "mkdir -p a/b/c");
    expect(ok.erreur).toBe(false);
    expect(executer(ok.etat, "cd a/b/c").erreur).toBe(false);
  });
  it("ls liste les fichiers et dossiers, dans l'ordre alphabétique, sans casser l'état", () => {
    let e = etatInitial();
    e = enchainer(e, "mkdir zeta", "touch alpha.txt");
    expect(sortieDe(e, "ls")).toBe("alpha.txt\nzeta/");
  });
});

describe("fichiers : touch, echo, cat, rm", () => {
  it("touch crée un fichier vide, cat le lit (vide)", () => {
    const e = enchainer(etatInitial(), "touch note.txt");
    expect(sortieDe(e, "cat note.txt")).toBe("");
  });
  it("echo avec redirection > écrit, >> ajoute", () => {
    let e = etatInitial();
    e = executer(e, 'echo "Bonjour" > note.txt').etat;
    expect(sortieDe(e, "cat note.txt")).toBe("Bonjour\n");
    e = executer(e, 'echo "Suite" >> note.txt').etat;
    expect(sortieDe(e, "cat note.txt")).toBe("Bonjour\nSuite\n");
  });
  it("echo sans redirection affiche juste le texte, sans créer de fichier", () => {
    const e = etatInitial();
    expect(sortieDe(e, "echo bonjour")).toBe("bonjour");
    expect(executer(e, "cat bonjour").erreur).toBe(true);
  });
  it("cat sur un fichier inexistant ou un dossier échoue", () => {
    const e = enchainer(etatInitial(), "mkdir d");
    expect(executer(e, "cat inconnu.txt").erreur).toBe(true);
    expect(executer(e, "cat d").erreur).toBe(true);
  });
  it("rm supprime un fichier, rm -r un dossier plein, rm seul refuse un dossier plein", () => {
    let e = enchainer(etatInitial(), "touch a.txt");
    e = executer(e, "rm a.txt").etat;
    expect(executer(e, "cat a.txt").erreur).toBe(true);
    e = enchainer(etatInitial(), "mkdir d", "touch d/f.txt");
    expect(executer(e, "rm d").erreur).toBe(true);
    const r = executer(e, "rm -r d");
    expect(r.erreur).toBe(false);
    expect(executer(r.etat, "cd d").erreur).toBe(true);
  });
  it("rm -f ne proteste pas sur un fichier déjà absent", () => {
    expect(executer(etatInitial(), "rm -f fantome.txt").erreur).toBe(false);
  });
});

describe("cp et mv", () => {
  it("cp copie un fichier, l'original reste", () => {
    let e = executer(etatInitial(), 'echo "x" > a.txt').etat;
    e = executer(e, "cp a.txt b.txt").etat;
    expect(sortieDe(e, "cat a.txt")).toBe(sortieDe(e, "cat b.txt"));
  });
  it("cp -r copie un dossier entier", () => {
    let e = enchainer(etatInitial(), "mkdir d", "touch d/f.txt");
    e = executer(e, "cp -r d d2").etat;
    expect(executer(e, "cat d2/f.txt").erreur).toBe(false);
    expect(executer(e, "cat d/f.txt").erreur).toBe(false); // l'original existe toujours
  });
  it("mv déplace (l'original disparaît)", () => {
    let e = executer(etatInitial(), 'echo "x" > a.txt').etat;
    e = executer(e, "mv a.txt b.txt").etat;
    expect(executer(e, "cat a.txt").erreur).toBe(true);
    expect(executer(e, "cat b.txt").erreur).toBe(false);
  });
  it("cp/mv vers un dossier existant place le fichier dedans, avec son nom d'origine", () => {
    let e = enchainer(etatInitial(), "mkdir boite");
    e = executer(e, 'echo "x" > a.txt').etat;
    e = executer(e, "cp a.txt boite").etat;
    expect(executer(e, "cat boite/a.txt").erreur).toBe(false);
  });
});

describe("droits (chmod)", () => {
  it("chmod 000 bloque la lecture et l'écriture", () => {
    let e = executer(etatInitial(), 'echo "secret" > s.txt').etat;
    e = executer(e, "chmod 000 s.txt").etat;
    expect(executer(e, "cat s.txt").erreur).toBe(true);
    expect(executer(e, 'echo "x" >> s.txt').erreur).toBe(true);
  });
  it("chmod 644 autorise la lecture mais pas... (ici l'écriture du propriétaire reste possible avec 6)", () => {
    let e = executer(etatInitial(), 'echo "a" > s.txt').etat;
    e = executer(e, "chmod 400 s.txt").etat; // lecture seule
    expect(executer(e, "cat s.txt").erreur).toBe(false);
    expect(executer(e, 'echo "b" >> s.txt').erreur).toBe(true);
  });
  it("chmod avec un mode invalide est refusé", () => {
    const e = executer(etatInitial(), "touch a.txt").etat;
    expect(executer(e, "chmod 999 a.txt").erreur).toBe(true);
    expect(executer(e, "chmod rwx a.txt").erreur).toBe(true);
  });
  it("modeVersPerms calcule bien les bits lecture/écriture/exécution", () => {
    expect(modeVersPerms("700")!.slice(0, 3)).toBe("rwx");
    expect(modeVersPerms("400")!.slice(0, 3)).toBe("r--");
    expect(modeVersPerms("000")!.slice(0, 3)).toBe("---");
  });
});

describe("quota de stockage (espace moyen, volontairement limité)", () => {
  it("refuse d'écrire au-delà du quota, avec un message clair", () => {
    const e = etatInitial("eleve", 100); // quota minuscule pour le test
    const r = executer(
      e,
      'echo "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789" > gros.txt',
    );
    expect(r.erreur).toBe(true);
    expect(r.sortie).toContain("espace disque insuffisant");
  });
  it("après avoir libéré de la place (rm), l'écriture redevient possible", () => {
    const e = etatInitial("eleve", 50);
    const s = executer(e, "truncate -s 40 a.txt");
    expect(s.erreur).toBe(false);
    expect(executer(s.etat, "truncate -s 40 b.txt").erreur).toBe(true); // plus de place
    const libere = executer(s.etat, "rm a.txt").etat;
    expect(executer(libere, "truncate -s 40 b.txt").erreur).toBe(false);
  });
  it("truncate -s accepte K et M et calcule la bonne taille en octets", () => {
    const e = etatInitial("eleve", 10 * 1024 * 1024);
    let r = executer(e, "truncate -s 10K f1.txt");
    expect(espaceLibre(r.etat)).toBe(e.quotaOctets - 10 * 1024);
    r = executer(r.etat, "truncate -s 1M f2.txt");
    expect(espaceLibre(r.etat)).toBe(e.quotaOctets - 10 * 1024 - 1024 * 1024);
  });
  it("df et du reflètent l'espace utilisé et libre", () => {
    const e = etatInitial("eleve", 1000);
    const r = executer(e, "truncate -s 100 a.txt").etat;
    expect(sortieDe(r, "df")).toContain("Utilisé : 100");
    expect(sortieDe(r, "df")).toContain("Libre   : 900");
    expect(sortieDe(r, "du")).toContain("100");
  });
  it("le quota moyen par défaut est strictement positif et raisonnable (ni minuscule, ni énorme)", () => {
    const e = etatInitial();
    expect(e.quotaOctets).toBeGreaterThan(64 * 1024);
    expect(e.quotaOctets).toBeLessThan(10 * 1024 * 1024);
  });
});

describe("find et grep", () => {
  it("find retrouve un fichier par motif, avec des jokers", () => {
    const e = enchainer(etatInitial(), "mkdir d", "touch d/rapport.txt", "touch d/photo.png");
    const r = executer(e, "find d -name *.txt");
    expect(r.sortie).toContain("rapport.txt");
    expect(r.sortie).not.toContain("photo.png");
  });
  it("grep filtre les lignes contenant le motif", () => {
    let e = executer(etatInitial(), 'echo "ligne un" > f.txt').etat;
    e = executer(e, 'echo "ligne deux" >> f.txt').etat;
    e = executer(e, 'echo "autre chose" >> f.txt').etat;
    expect(sortieDe(e, "grep ligne f.txt")).toBe(
      "ligne un\nligne deux\nautre chose"
        .split("\n")
        .filter((l) => l.includes("ligne"))
        .join("\n"),
    );
  });
});

describe("robustesse générale", () => {
  it("une commande inconnue renvoie une erreur sans planter", () => {
    const r = executer(etatInitial(), "bibliboup");
    expect(r.erreur).toBe(true);
    expect(r.sortie).toContain("introuvable");
  });
  it("une ligne vide ne fait rien", () => {
    const e = etatInitial();
    expect(executer(e, "").etat).toBe(e);
  });
  it("n'importe quelle suite de commandes garde un état cohérent (taille jamais négative, jamais au-dessus du quota)", () => {
    const commandes = [
      "mkdir a",
      "cd a",
      "touch f.txt",
      'echo "x" > f.txt',
      "cd ..",
      "rm -r a",
      "mkdir -p a/b/c",
      "cp -r a a2",
      "mv a2 a3",
      "rm -rf a3",
      "truncate -s 10K g.txt",
      "chmod 000 g.txt",
      "cat g.txt",
      "rm -f g.txt",
      "ls -la",
      "df -h",
      "du -h",
    ];
    let e = etatInitial("eleve", 64 * 1024);
    for (let tour = 0; tour < 5; tour++) {
      for (const c of commandes) {
        e = executer(e, c).etat;
        expect(tailleTotale(e.racine)).toBeGreaterThanOrEqual(0);
        expect(tailleTotale(e.racine)).toBeLessThanOrEqual(e.quotaOctets);
      }
    }
  });
  it("help liste les commandes disponibles", () => {
    expect(sortieDe(etatInitial(), "help")).toContain("mkdir");
  });
});
