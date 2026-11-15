/**
 * Génération de quiz par IA (Google Gemini). Fichier SANS dépendance : il est utilisé
 *  - par la fonction serveur (index.ts, Deno), qui garde la clé API secrète ;
 *  - par le jeu (pour valider les questions) et par les tests.
 * Les questions de l'IA sont toujours validées strictement avant d'être renvoyées.
 */
export type Difficulte = 1 | 2 | 3;
export type QuestionQuiz = {
  q: string;
  choix: [string, string, string, string];
  bonne: 0 | 1 | 2 | 3;
  explication: string;
  difficulte: Difficulte;
};

const txt = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Garde uniquement les questions bien formées : 4 réponses distinctes, une seule bonne, textes non vides. */
export function nettoyerQuestions(brut: unknown, max = 20): QuestionQuiz[] {
  const liste = Array.isArray(brut)
    ? brut
    : brut && typeof brut === "object" && Array.isArray((brut as { questions?: unknown }).questions)
      ? (brut as { questions: unknown[] }).questions
      : [];
  const vus = new Set<string>();
  const r: QuestionQuiz[] = [];
  for (const it of liste) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const q = txt(o["q"] ?? o["question"] ?? o["enonce"], 300);
    const choixBrut = Array.isArray(o["choix"])
      ? o["choix"]
      : Array.isArray(o["reponses"])
        ? o["reponses"]
        : [];
    const choix = choixBrut.map((c) => txt(c, 150));
    const bonne = typeof o["bonne"] === "number" ? o["bonne"] : Number.NaN;
    if (q.length < 8 || choix.length !== 4 || choix.some((c) => !c)) continue;
    if (new Set(choix.map((c) => c.toLowerCase())).size !== 4) continue;
    if (!Number.isInteger(bonne) || bonne < 0 || bonne > 3) continue;
    if (vus.has(q.toLowerCase())) continue;
    vus.add(q.toLowerCase());
    const d = typeof o["difficulte"] === "number" ? Math.round(o["difficulte"]) : 2;
    r.push({
      q,
      choix: choix as QuestionQuiz["choix"],
      bonne: bonne as QuestionQuiz["bonne"],
      explication: txt(o["explication"], 400),
      difficulte: (d <= 1 ? 1 : d >= 3 ? 3 : 2) as Difficulte,
    });
    if (r.length >= max) break;
  }
  return r;
}

/** L'IA renvoie parfois le JSON entouré de texte ou de ```json : on le récupère proprement. */
export function extraireJson(texte: string): unknown {
  const t = texte
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(t);
  } catch {
    /* on cherche le premier tableau ou objet */
  }
  const debut = Math.min(...["[", "{"].map((c) => (t.indexOf(c) === -1 ? Infinity : t.indexOf(c))));
  const fin = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
  if (!Number.isFinite(debut) || fin <= debut) return null;
  try {
    return JSON.parse(t.slice(debut, fin + 1));
  } catch {
    return null;
  }
}

export const SYSTEME =
  "Tu es un professeur de BTS SIO option SISR (systèmes et réseaux). Tu écris des quiz à choix multiples en français, fiables et pédagogiques. Tu t'appuies UNIQUEMENT sur le contenu du cours fourni. Tu n'inventes aucun fait. Chaque question a exactement 4 réponses plausibles et une seule bonne.";

export function construirePrompt(e: {
  titre: string;
  categorie: string;
  contenu: string;
  nombre: number;
  difficulte: string;
}): string {
  const niveau =
    e.difficulte === "facile"
      ? "faciles (vocabulaire, définitions)"
      : e.difficulte === "difficile"
        ? "difficiles (cas pratiques, comparaisons, raisonnement)"
        : e.difficulte === "normal"
          ? "de difficulté moyenne"
          : "de difficultés variées (un tiers faciles, un tiers moyennes, un tiers difficiles)";
  return `Cours : « ${e.titre} » (catégorie : ${e.categorie}).

--- DÉBUT DU COURS ---
${e.contenu}
--- FIN DU COURS ---

Écris ${e.nombre} questions ${niveau}, à partir de ce cours uniquement.
Règles :
- 4 réponses par question, distinctes, plausibles ; une seule est correcte ;
- varie la position de la bonne réponse (index 0 à 3) ;
- "difficulte" : 1 (facile), 2 (moyenne) ou 3 (difficile) ;
- "explication" : une ou deux phrases qui justifient la bonne réponse ;
- ne pose pas deux fois la même question ; pas de question sur des détails absents du cours.
Réponds uniquement avec un tableau JSON : [{"q":"...","choix":["...","...","...","..."],"bonne":0,"explication":"...","difficulte":2}]`;
}

const SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      q: { type: "STRING" },
      choix: { type: "ARRAY", items: { type: "STRING" } },
      bonne: { type: "INTEGER" },
      explication: { type: "STRING" },
      difficulte: { type: "INTEGER" },
    },
    required: ["q", "choix", "bonne", "explication", "difficulte"],
  },
};

/* ───────────── Traitement d'une demande ───────────── */
export type CodeErreur =
  | "non-connecte"
  | "interdit"
  | "entree-invalide"
  | "trop-de-demandes"
  | "cle-manquante"
  | "ia-indisponible"
  | "reponse-invalide";
export type Sortie =
  | { ok: true; questions: QuestionQuiz[]; modele: string }
  | { ok: false; code: CodeErreur; message: string };

export type Limites = { parUtilisateur: Map<string, number[]>; jour: { date: string; n: number } };
export const nouvellesLimites = (): Limites => ({
  parUtilisateur: new Map(),
  jour: { date: "", n: 0 },
});

export type Deps = {
  cleApi: string | undefined;
  modele: string;
  utilisateurId: string | null;
  peutGenerer: (utilisateurId: string, coursId: string) => Promise<boolean>;
  fetchFn: (
    url: string,
    init: { method: string; headers: Record<string, string>; body: string },
  ) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  maintenant: () => number;
  limites: Limites;
  maxParDix?: number;
  maxParJour?: number;
};
type DepsComplet = Deps;

const MAX_CONTENU = 12000;

export async function traiter(corps: unknown, d: DepsComplet): Promise<Sortie> {
  if (!d.utilisateurId)
    return { ok: false, code: "non-connecte", message: "Connecte-toi pour générer un quiz." };
  const b = (corps && typeof corps === "object" ? corps : {}) as Record<string, unknown>;
  const coursId = txt(b["coursId"], 80),
    titre = txt(b["titre"], 120),
    categorie = txt(b["categorie"], 60) || "Cours";
  const contenu = typeof b["contenu"] === "string" ? b["contenu"].trim() : "";
  const nombre = Math.max(
    3,
    Math.min(15, Math.round(typeof b["nombre"] === "number" ? b["nombre"] : 8)),
  );
  const difficulte = ["facile", "normal", "difficile", "mixte"].includes(String(b["difficulte"]))
    ? String(b["difficulte"])
    : "mixte";
  if (!coursId || !titre)
    return { ok: false, code: "entree-invalide", message: "Il manque le cours ou son titre." };
  if (contenu.length < 80)
    return {
      ok: false,
      code: "entree-invalide",
      message:
        "Le texte du cours est trop court (80 caractères minimum). Colle le texte du cours pour que l'IA puisse écrire des questions.",
    };

  if (!(await d.peutGenerer(d.utilisateurId, coursId)))
    return {
      ok: false,
      code: "interdit",
      message: "Seuls l'auteur du cours et les admins peuvent générer un quiz.",
    };

  // Limites : 8 demandes par 10 minutes et par personne, 100 par jour pour l'école
  const now = d.maintenant();
  const recents = (d.limites.parUtilisateur.get(d.utilisateurId) ?? []).filter(
    (t) => now - t < 10 * 60 * 1000,
  );
  const jour = new Date(now).toISOString().slice(0, 10);
  if (d.limites.jour.date !== jour) d.limites.jour = { date: jour, n: 0 };
  if (recents.length >= (d.maxParDix ?? 8))
    return {
      ok: false,
      code: "trop-de-demandes",
      message: "Trop de demandes d'un coup. Attends quelques minutes.",
    };
  if (d.limites.jour.n >= (d.maxParJour ?? 100))
    return {
      ok: false,
      code: "trop-de-demandes",
      message: "La limite de génération du jour est atteinte pour toute l'école.",
    };
  if (!d.cleApi)
    return {
      ok: false,
      code: "cle-manquante",
      message: "La clé de l'IA n'est pas configurée (secret GEMINI_API_KEY manquant).",
    };
  d.limites.parUtilisateur.set(d.utilisateurId, [...recents, now]);
  d.limites.jour.n++;

  const prompt = construirePrompt({
    titre,
    categorie,
    contenu: contenu.slice(0, MAX_CONTENU),
    nombre,
    difficulte,
  });
  let derniereErreur = "";
  for (let essai = 0; essai < 2; essai++) {
    let rep;
    try {
      rep = await d.fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(d.modele)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": d.cleApi },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEME }] },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text:
                      essai === 0
                        ? prompt
                        : `${prompt}\n\nATTENTION : ta réponse précédente était invalide. Réponds uniquement par le tableau JSON demandé, 4 réponses distinctes par question.`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: "application/json",
              responseSchema: SCHEMA,
              maxOutputTokens: 6000,
            },
          }),
        },
      );
    } catch {
      return {
        ok: false,
        code: "ia-indisponible",
        message: "Impossible de joindre l'IA pour le moment.",
      };
    }

    const data = (await rep.json().catch(() => null)) as Record<string, unknown> | null;
    if (!rep.ok) {
      const detail = txt((data?.["error"] as { message?: unknown } | undefined)?.message, 200);
      if (rep.status === 429)
        return {
          ok: false,
          code: "ia-indisponible",
          message:
            "L'IA a atteint sa limite gratuite (par minute ou par jour). Réessaie un peu plus tard.",
        };
      if (rep.status === 400 || rep.status === 401 || rep.status === 403 || rep.status === 404)
        return {
          ok: false,
          code: "ia-indisponible",
          message:
            `L'IA a refusé la demande (${rep.status}). Vérifie la clé et le nom du modèle (GEMINI_MODEL). ${detail}`.trim(),
        };
      return {
        ok: false,
        code: "ia-indisponible",
        message: `L'IA est indisponible (${rep.status}). ${detail}`.trim(),
      };
    }
    const parts =
      (
        data?.["candidates"] as
          Array<{ content?: { parts?: Array<{ text?: unknown }> } }> | undefined
      )?.[0]?.content?.parts ?? [];
    const texte = parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("");
    const questions = nettoyerQuestions(extraireJson(texte), nombre);
    if (questions.length >= Math.max(1, Math.ceil(nombre / 2)))
      return { ok: true, questions, modele: d.modele };
    derniereErreur = texte ? "Les questions reçues étaient mal formées." : "L'IA n'a rien renvoyé.";
  }
  return { ok: false, code: "reponse-invalide", message: `${derniereErreur} Réessaie.` };
}
