import { describe, expect, it } from "vitest";
import { DUREE_STATUT, SalleClient, type Etat, type Fiche, type Msg } from "./salle";
import { DEFAUT } from "./apparence";

/** Faux canal : tout message envoyé est livré aux autres clients (comme Supabase Broadcast, self: false). */
function creerSalle(n: number) {
  let t = 0;
  const clients: SalleClient[] = [];
  const etats: Etat[] = [];
  const envois = { total: 0, parType: {} as Record<string, number> };
  const file: Array<{ de: number; m: Msg }> = [];
  for (let i = 0; i < n; i++) {
    const f: Fiche = { id: `j${i}`, pseudo: `Joueur${i}`, niveau: 1, apparence: DEFAUT };
    etats.push({
      x: 5 + (i % 10),
      y: 3 + Math.floor(i / 10),
      dir: "bas",
      marche: false,
      run: false,
    });
    clients.push(
      new SalleClient(
        f,
        {
          envoyer: (m) => {
            envois.total++;
            envois.parType[m.k] = (envois.parType[m.k] ?? 0) + 1;
            file.push({ de: i, m });
          },
        },
        () => etats[i]!,
        () => t,
        () => {},
      ),
    );
  }
  const livrer = () => {
    while (file.length) {
      const { de, m } = file.shift()!;
      clients.forEach((c, i) => {
        if (i !== de) c.recevoir(m);
      });
    }
  };
  return {
    clients,
    etats,
    envois,
    livrer,
    avancer: (ms: number) => {
      t += ms;
    },
    maintenant: () => t,
    file,
  };
}

describe("salle temps réel (20 joueurs)", () => {
  it("tout le monde se voit après l'arrivée de chacun", () => {
    const s = creerSalle(20);
    s.clients.forEach((c) => {
      c.demarrer();
      s.livrer();
    });
    for (const c of s.clients) expect(c.autres.size).toBe(19);
  });

  it("un nouvel arrivant voit ceux déjà présents, avec leur position actuelle", () => {
    const s = creerSalle(3);
    s.clients[0]!.demarrer();
    s.livrer();
    s.clients[1]!.demarrer();
    s.livrer();
    s.etats[0]!.x = 9;
    s.etats[0]!.y = 4; // le joueur 0 a bougé depuis
    s.clients[2]!.demarrer();
    s.livrer();
    expect(s.clients[2]!.autres.get("j0")!.e).toMatchObject({ x: 9, y: 4 });
    expect(s.clients[2]!.autres.size).toBe(2);
  });

  it("le départ d'un joueur est vu par tous (bye), et l'oubli marche si l'onglet est fermé sans prévenir", () => {
    const s = creerSalle(4);
    s.clients.forEach((c) => {
      c.demarrer();
      s.livrer();
    });
    s.clients[3]!.quitter();
    s.livrer();
    expect(s.clients[0]!.autres.has("j3")).toBe(false);
    // le joueur 2 disparaît sans bye : plus aucun message de sa part
    for (let i = 0; i < 20; i++) {
      s.avancer(1000);
      [0, 1].forEach((k) => s.clients[k]!.tic());
      s.livrer();
    }
    expect(s.clients[0]!.autres.has("j2")).toBe(false);
    expect(s.clients[0]!.autres.has("j1")).toBe(true); // lui est resté présent grâce aux battements
  });

  it("les déplacements sont reçus (mv) et recalés (hb)", () => {
    const s = creerSalle(2);
    s.clients.forEach((c) => {
      c.demarrer();
      s.livrer();
    });
    s.etats[0] = { x: 6, y: 3, dir: "droite", marche: true, run: false };
    s.clients[0]!.envoyerEtat(s.etats[0]!);
    s.livrer();
    expect(s.clients[1]!.autres.get("j0")!.e).toMatchObject({ dir: "droite", marche: true });
    s.avancer(1500);
    s.etats[0]!.x = 11;
    s.clients[0]!.tic();
    s.livrer();
    expect(s.clients[1]!.autres.get("j0")!.e.x).toBe(11);
  });

  it("la bulle de chat dure 4 s, avec limite d'envoi", () => {
    const s = creerSalle(2);
    s.clients.forEach((c) => {
      c.demarrer();
      s.livrer();
    });
    expect(s.clients[0]!.dire("Salut")).toBe(true);
    expect(s.clients[0]!.dire("Spam")).toBe(false);
    s.livrer();
    expect(s.clients[1]!.textes().bulles["j0"]).toBe("Salut");
    s.avancer(4100);
    s.clients[1]!.tic();
    expect(s.clients[1]!.textes().bulles["j0"]).toBeUndefined();
  });

  it("le statut reste 5 minutes, est vu par un arrivant tardif, et peut être retiré avant", () => {
    const s = creerSalle(3);
    s.clients[0]!.demarrer();
    s.livrer();
    s.clients[1]!.demarrer();
    s.livrer();
    s.clients[0]!.definirStatut("Je cherche un binôme pour le TP");
    s.livrer();
    expect(s.clients[1]!.textes().statuts["j0"]).toBe("Je cherche un binôme pour le TP");
    s.avancer(60_000);
    s.clients[2]!.demarrer();
    s.livrer(); // arrive 1 minute plus tard
    expect(s.clients[2]!.textes().statuts["j0"]).toBe("Je cherche un binôme pour le TP");
    s.avancer(DUREE_STATUT - 59_000);
    s.clients.forEach((c) => c.tic());
    s.livrer();
    expect(s.clients[1]!.textes().statuts["j0"]).toBeUndefined(); // expiré au bout de 5 min
    s.clients[0]!.definirStatut("Encore moi");
    s.livrer();
    s.clients[0]!.definirStatut("");
    s.livrer(); // retiré avant
    expect(s.clients[1]!.textes().statuts["j0"]).toBeUndefined();
    expect(s.clients[0]!.textes().statuts["j0"]).toBeUndefined();
  });

  it("20 joueurs qui marchent en continu restent loin de la limite de 100 messages par seconde", () => {
    const s = creerSalle(20);
    s.clients.forEach((c) => {
      c.demarrer();
      s.livrer();
    });
    s.envois.total = 0;
    // 60 secondes : chaque joueur change de direction en moyenne toutes les 1,5 s (≈ 0,7 message/s) et bat toutes les 1,2 s
    for (let sec = 0; sec < 60; sec++) {
      for (let q = 0; q < 4; q++) {
        s.avancer(250);
        s.clients.forEach((c, i) => {
          s.etats[i]!.marche = true;
          if ((sec * 4 + q + i) % 6 === 0) {
            s.etats[i]!.dir = (["haut", "bas", "gauche", "droite"] as const)[(sec + i) % 4]!;
            c.envoyerEtat(s.etats[i]!);
          }
          c.tic();
        });
        s.livrer();
      }
    }
    const parSeconde = s.envois.total / 60;
    console.log("messages envoyés par seconde (20 joueurs en mouvement) :", parSeconde.toFixed(1));
    expect(parSeconde).toBeLessThan(40);
  });
});
