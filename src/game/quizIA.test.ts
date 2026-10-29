import { describe, expect, it } from "vitest";
import {
  extraireJson,
  nettoyerQuestions,
  nouvellesLimites,
  traiter,
  type Deps,
} from "../../supabase/functions/generer-quiz/handler";

const COURS =
  "Le protocole DHCP attribue automatiquement une adresse IP aux machines d'un réseau. Il fonctionne en quatre étapes : Discover, Offer, Request et Acknowledge. Le serveur DHCP gère un pool d'adresses et une durée de bail.";
const bonne = (i: number) => ({
  q: `Question numéro ${i} sur le protocole DHCP ?`,
  choix: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
  bonne: i % 4,
  explication: "Parce que.",
  difficulte: 2,
});
const reponseIA = (qs: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({
    candidates: [
      { content: { parts: [{ text: typeof qs === "string" ? qs : JSON.stringify(qs) }] } },
    ],
  }),
});

function deps(sur: Partial<Deps> = {}): Deps & { appels: number } {
  const d = {
    cleApi: "cle-secrete",
    modele: "gemini-test",
    utilisateurId: "u1",
    limites: nouvellesLimites(),
    maintenant: () => 1_700_000_000_000,
    appels: 0,
    peutGenerer: async () => true,
    fetchFn: async () => {
      d.appels++;
      return reponseIA(Array.from({ length: 8 }, (_, i) => bonne(i)));
    },
    ...sur,
  } as Deps & { appels: number };
  return d;
}
const corps = (c: Record<string, unknown> = {}) => ({
  coursId: "c1",
  titre: "DHCP",
  categorie: "Réseaux",
  contenu: COURS,
  nombre: 8,
  ...c,
});

describe("validation des questions de l'IA", () => {
  it("garde les questions correctes", () =>
    expect(nettoyerQuestions([bonne(0), bonne(1)])).toHaveLength(2));
  it("rejette les réponses en double, les index faux et les textes vides", () => {
    const mauvaises = [
      { ...bonne(1), choix: ["A", "A", "B", "C"] },
      { ...bonne(2), bonne: 4 },
      { ...bonne(3), bonne: -1 },
      { ...bonne(4), q: "" },
      { ...bonne(5), choix: ["A", "B", "C"] },
      { ...bonne(6), choix: ["A", "B", "C", ""] },
      { ...bonne(7), bonne: "0" },
      null,
      "x",
    ];
    expect(nettoyerQuestions(mauvaises)).toHaveLength(0);
  });
  it("accepte un objet { questions: [...] } et des noms de champs voisins", () => {
    const r = nettoyerQuestions({
      questions: [
        {
          question: "Quelle est la capitale de la France ?",
          reponses: ["Paris", "Lyon", "Nice", "Lille"],
          bonne: 0,
        },
      ],
    });
    expect(r[0]).toMatchObject({
      q: "Quelle est la capitale de la France ?",
      bonne: 0,
      difficulte: 2,
    });
  });
  it("ramène la difficulté entre 1 et 3 et supprime les doublons", () => {
    const r = nettoyerQuestions([
      { ...bonne(1), difficulte: 9 },
      { ...bonne(1), difficulte: 0 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.difficulte).toBe(3);
  });
  it("limite le nombre de questions", () =>
    expect(
      nettoyerQuestions(
        Array.from({ length: 30 }, (_, i) => bonne(i)),
        10,
      ),
    ).toHaveLength(10));
  it("extrait le JSON entouré de texte ou de ```json", () => {
    expect(extraireJson("```json\n[1,2]\n```")).toEqual([1, 2]);
    expect(extraireJson('Voici : [{"a":1}] fin')).toEqual([{ a: 1 }]);
    expect(extraireJson("rien du tout")).toBeNull();
  });
});

describe("fonction generer-quiz (avec une fausse IA)", () => {
  it("renvoie des questions valides", async () => {
    const d = deps();
    const r = await traiter(corps(), d);
    expect(r.ok && r.questions.length).toBe(8);
    expect(d.appels).toBe(1);
  });
  it("n'envoie jamais la clé dans la réponse, mais l'utilise dans l'en-tête de la requête", async () => {
    let entete = "";
    const d = deps({
      fetchFn: async (_u, init) => {
        entete = init.headers["x-goog-api-key"] ?? "";
        return reponseIA([bonne(1), bonne(2), bonne(3), bonne(4), bonne(5)]);
      },
    });
    const r = await traiter(corps(), d);
    expect(entete).toBe("cle-secrete");
    expect(JSON.stringify(r)).not.toContain("cle-secrete");
  });
  it("refuse sans connexion", async () =>
    expect(await traiter(corps(), deps({ utilisateurId: null }))).toMatchObject({
      ok: false,
      code: "non-connecte",
    }));
  it("refuse quelqu'un qui n'est ni l'auteur ni admin", async () =>
    expect(await traiter(corps(), deps({ peutGenerer: async () => false }))).toMatchObject({
      ok: false,
      code: "interdit",
    }));
  it("refuse un cours trop court", async () =>
    expect(await traiter(corps({ contenu: "Trop court" }), deps())).toMatchObject({
      ok: false,
      code: "entree-invalide",
    }));
  it("signale une clé manquante", async () =>
    expect(await traiter(corps(), deps({ cleApi: undefined }))).toMatchObject({
      ok: false,
      code: "cle-manquante",
    }));
  it("tronque un cours énorme avant de l'envoyer", async () => {
    let envoye = 0;
    const d = deps({
      fetchFn: async (_u, init) => {
        envoye = init.body.length;
        return reponseIA(Array.from({ length: 8 }, (_, i) => bonne(i)));
      },
    });
    await traiter(corps({ contenu: COURS.repeat(2000) }), d);
    expect(envoye).toBeLessThan(20000);
  });
  it("réessaie une fois si l'IA répond n'importe quoi, puis réussit", async () => {
    let n = 0;
    const d = deps({
      fetchFn: async () => {
        n++;
        return n === 1
          ? reponseIA("Désolé, je ne peux pas.")
          : reponseIA(Array.from({ length: 8 }, (_, i) => bonne(i)));
      },
    });
    expect(await traiter(corps(), d)).toMatchObject({ ok: true });
    expect(n).toBe(2);
  });
  it("abandonne proprement si l'IA reste invalide", async () => {
    const d = deps({ fetchFn: async () => reponseIA([{ q: "x" }]) });
    expect(await traiter(corps(), d)).toMatchObject({ ok: false, code: "reponse-invalide" });
  });
  it("traduit les erreurs de l'IA en messages clairs", async () => {
    const err = (status: number, message = "") =>
      deps({
        fetchFn: async () => ({ ok: false, status, json: async () => ({ error: { message } }) }),
      });
    const a = await traiter(corps(), err(429));
    expect(a).toMatchObject({ ok: false, code: "ia-indisponible" });
    expect(!a.ok && a.message).toContain("limite");
    const b = await traiter(corps(), err(403, "API key not valid"));
    expect(!b.ok && b.message).toContain("API key not valid");
    expect(await traiter(corps(), err(500))).toMatchObject({ ok: false, code: "ia-indisponible" });
  });
  it("gère une panne réseau", async () =>
    expect(
      await traiter(
        corps(),
        deps({
          fetchFn: async () => {
            throw new Error("réseau");
          },
        }),
      ),
    ).toMatchObject({ ok: false, code: "ia-indisponible" }));
  it("limite à 8 demandes par 10 minutes et par personne", async () => {
    const d = deps();
    for (let i = 0; i < 8; i++) expect(await traiter(corps(), d)).toMatchObject({ ok: true });
    expect(await traiter(corps(), d)).toMatchObject({ ok: false, code: "trop-de-demandes" });
    expect(await traiter(corps(), { ...d, utilisateurId: "u2" })).toMatchObject({ ok: true }); // une autre personne n'est pas bloquée
    expect(
      await traiter(corps(), { ...d, maintenant: () => 1_700_000_000_000 + 11 * 60 * 1000 }),
    ).toMatchObject({ ok: true }); // après 10 minutes
  });
  it("limite à 100 demandes par jour pour toute l'école", async () => {
    const d = deps({ maxParDix: 1000, maxParJour: 5 });
    for (let i = 0; i < 5; i++) await traiter(corps(), d);
    expect(await traiter(corps(), d)).toMatchObject({ ok: false, code: "trop-de-demandes" });
  });
});
