import type { Apparence, Direction } from "./apparence";

/**
 * Protocole temps réel d'une salle (zone). Indépendant de Supabase : il parle à un « transport »
 * (un canal de diffusion), ce qui permet de le tester avec 20 joueurs simulés.
 *
 * Principe pour rester sous les limites de l'offre gratuite :
 *  - on n'envoie PAS la position à chaque case, seulement quand la direction / l'état de marche change ;
 *  - les autres joueurs calculent eux-mêmes la trajectoire entre deux messages ;
 *  - un battement régulier recale les positions (rapide en marchant, lent à l'arrêt) ;
 *  - aucune présence Supabase par salle : on s'annonce avec un « hello », les autres répondent.
 */
export type Etat = { x: number; y: number; dir: Direction; marche: boolean; run: boolean };
export type Statut = { t: string; fin: number } | null;
export type Fiche = { id: string; pseudo: string; niveau: number; apparence: Apparence };
export type Distant = Fiche & { e: Etat; statut: Statut; vu: number; ver: number };

export type Msg =
  | { k: "hello"; rep: boolean; f: Fiche; e: Etat; s: Statut }
  | { k: "mv" | "hb"; id: string; e: Etat }
  | { k: "bye"; id: string }
  | { k: "chat"; id: string; t: string }
  | { k: "statut"; id: string; s: Statut };

export type Transport = { envoyer: (m: Msg) => void };

export const DUREE_BULLE = 4000;
export const DUREE_STATUT = 5 * 60 * 1000;
export const MAX_CHAT = 60;
export const MAX_STATUT = 80;
const DELAI_CHAT = 1200;
const OUBLI = 15000; // un joueur silencieux depuis 15 s est considéré parti
const BATTEMENT_MARCHE = 1200; // ms
const BATTEMENT_ARRET = 5000;

export class SalleClient {
  autres = new Map<string, Distant>();
  bulles = new Map<string, { t: string; fin: number }>();
  statutMoi: Statut = null;
  private dernierChat = -Infinity;
  private dernierBattement = 0;
  private derniereDemande = 0;
  private ver = 0;

  constructor(
    private moi: Fiche,
    private transport: Transport,
    private lireEtat: () => Etat,
    private maintenant: () => number,
    private surChangement: () => void,
  ) {}

  /** À appeler une fois le canal ouvert. */
  demarrer(statut: Statut = null) {
    this.statutMoi = statut;
    this.transport.envoyer({
      k: "hello",
      rep: false,
      f: this.moi,
      e: this.lireEtat(),
      s: this.statutActif(),
    });
  }

  private statutActif(): Statut {
    return this.statutMoi && this.statutMoi.fin > this.maintenant() ? this.statutMoi : null;
  }

  recevoir(m: Msg) {
    const now = this.maintenant();
    switch (m.k) {
      case "hello": {
        if (m.f.id === this.moi.id) return;
        this.autres.set(m.f.id, { ...m.f, e: m.e, statut: m.s, vu: now, ver: ++this.ver });
        if (!m.rep)
          this.transport.envoyer({
            k: "hello",
            rep: true,
            f: this.moi,
            e: this.lireEtat(),
            s: this.statutActif(),
          });
        this.surChangement();
        break;
      }
      case "mv":
      case "hb": {
        const d = this.autres.get(m.id);
        if (!d) {
          // Message d'un joueur inconnu (hello manqué) : on se présente une fois, il répondra
          if (m.id !== this.moi.id && now - this.derniereDemande > 3000) {
            this.derniereDemande = now;
            this.transport.envoyer({
              k: "hello",
              rep: false,
              f: this.moi,
              e: this.lireEtat(),
              s: this.statutActif(),
            });
          }
          return;
        }
        d.e = m.e;
        d.vu = now;
        d.ver = ++this.ver;
        break;
      }
      case "bye":
        if (this.autres.delete(m.id)) this.surChangement();
        break;
      case "chat":
        if (m.id === this.moi.id || typeof m.t !== "string") return;
        this.bulles.set(m.id, { t: m.t.slice(0, MAX_CHAT), fin: now + DUREE_BULLE });
        this.surChangement();
        break;
      case "statut": {
        const d = this.autres.get(m.id);
        if (!d) return;
        d.statut =
          m.s && typeof m.s.t === "string"
            ? { t: m.s.t.slice(0, MAX_STATUT), fin: Math.min(m.s.fin, now + DUREE_STATUT + 5000) }
            : null;
        this.surChangement();
        break;
      }
    }
  }

  /** Mon état de marche a changé (direction, départ, arrêt, course). */
  envoyerEtat(e: Etat) {
    this.dernierBattement = this.maintenant();
    this.transport.envoyer({ k: "mv", id: this.moi.id, e });
  }

  /** À appeler régulièrement (ex. toutes les 250 ms) : battement, oubli des absents, expiration des bulles et statuts. */
  tic() {
    const now = this.maintenant();
    const e = this.lireEtat();
    if (now - this.dernierBattement >= (e.marche ? BATTEMENT_MARCHE : BATTEMENT_ARRET)) {
      this.dernierBattement = now;
      this.transport.envoyer({ k: "hb", id: this.moi.id, e });
    }
    let change = false;
    for (const [id, d] of this.autres)
      if (now - d.vu > OUBLI) {
        this.autres.delete(id);
        change = true;
      }
    for (const [id, b] of this.bulles)
      if (b.fin <= now) {
        this.bulles.delete(id);
        change = true;
      }
    for (const d of this.autres.values())
      if (d.statut && d.statut.fin <= now) {
        d.statut = null;
        change = true;
      }
    if (this.statutMoi && this.statutMoi.fin <= now) {
      this.statutMoi = null;
      change = true;
    }
    if (change) this.surChangement();
  }

  /** Bulle de discussion (4 s). Limite : 1 message par 1,2 s. */
  dire(texte: string): boolean {
    const t = texte.trim().slice(0, MAX_CHAT),
      now = this.maintenant();
    if (!t || now - this.dernierChat < DELAI_CHAT) return false;
    this.dernierChat = now;
    this.bulles.set(this.moi.id, { t, fin: now + DUREE_BULLE });
    this.transport.envoyer({ k: "chat", id: this.moi.id, t });
    this.surChangement();
    return true;
  }

  /** Message affiché au-dessus de la tête pendant 5 minutes, ou jusqu'à ce qu'on le retire (texte vide). */
  definirStatut(texte: string) {
    const t = texte.trim().slice(0, MAX_STATUT);
    this.statutMoi = t ? { t, fin: this.maintenant() + DUREE_STATUT } : null;
    this.transport.envoyer({ k: "statut", id: this.moi.id, s: this.statutMoi });
    this.surChangement();
  }

  quitter() {
    this.transport.envoyer({ k: "bye", id: this.moi.id });
  }

  /** Textes affichés (bulles et statuts) par identifiant, y compris pour moi. */
  textes() {
    const now = this.maintenant();
    const bulles: Record<string, string> = {},
      statuts: Record<string, string> = {};
    for (const [id, b] of this.bulles) if (b.fin > now) bulles[id] = b.t;
    for (const [id, d] of this.autres) if (d.statut && d.statut.fin > now) statuts[id] = d.statut.t;
    if (this.statutMoi && this.statutMoi.fin > now) statuts[this.moi.id] = this.statutMoi.t;
    return { bulles, statuts };
  }
}
