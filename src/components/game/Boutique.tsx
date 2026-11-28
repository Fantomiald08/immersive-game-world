import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Fenetre } from "./Fenetre";
import { CATALOGUE, CATEGORIES, motifRefusAchat, NOM_MONNAIE, type ArticleBoutique, type CategorieArticle } from "@/game/boutique";
import { acheterArticle, equiperArticle, useBoutique } from "@/game/boutique-data";

type Message = { texte: string; erreur: boolean } | null;

/** Message d'erreur lisible, qu'il vienne du serveur ou d'un contrôle local. */
const messageErreur = (e: unknown): string => (e instanceof Error ? e.message : "L'opération a échoué, réessaie.");

/** Boutique : badges, titres, couleurs de pseudo, animaux et tenues, achetables avec des ISICoins. */
export function Boutique({ uid, onFermer }: { uid: string; onFermer: () => void }) {
  const qc = useQueryClient();
  const etat = useBoutique(uid);
  const [categorie, setCategorie] = useState<CategorieArticle>("badge");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);

  /** Une seule opération à la fois : le double clic est bloqué par enCours. */
  const executer = async (id: string, action: () => Promise<string>) => {
    if (enCours) return;
    setEnCours(id);
    setMessage(null);
    try {
      const texte = await action();
      setMessage({ texte, erreur: false });
      await qc.invalidateQueries({ queryKey: ["boutique", uid] });
      await qc.invalidateQueries({ queryKey: ["equipements", uid] });
      await qc.invalidateQueries({ queryKey: ["mon-profil"] });
    } catch (e) {
      setMessage({ texte: messageErreur(e), erreur: true });
    } finally {
      setEnCours(null);
    }
  };

  const acheter = (a: ArticleBoutique) => {
    const refus = motifRefusAchat({
      solde: etat.data?.solde ?? 0,
      prix: a.prix,
      possede: etat.data?.possedes.includes(a.id) ?? false,
    });
    if (refus) {
      setMessage({ texte: refus, erreur: true });
      return;
    }
    void executer(a.id, async () => {
      const nouveau = await acheterArticle(a.id);
      return `« ${a.nom} » acheté. Il te reste ${nouveau} ${NOM_MONNAIE}.`;
    });
  };

  const equiper = (a: ArticleBoutique) =>
    void executer(a.id, async () => {
      await equiperArticle(a.categorie, a.id);
      return `« ${a.nom} » équipé.`;
    });

  const retirer = (a: ArticleBoutique) =>
    void executer(a.id, async () => {
      await equiperArticle(a.categorie, null);
      return `« ${a.nom} » retiré.`;
    });

  const cat = CATEGORIES.find((c) => c.id === categorie)!;
  const articles = CATALOGUE.filter((a) => a.categorie === categorie);

  return (
    <Fenetre titre="🛍 Boutique ISITECH" onFermer={onFermer} large>
      {etat.isLoading && <p>Chargement de ta boutique…</p>}
      {etat.isError && <p role="alert" className="text-destructive">{messageErreur(etat.error)}</p>}
      {etat.data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-pixel text-xs text-accent" aria-label="Solde">
              {etat.data.solde} {NOM_MONNAIE}
            </span>
            <span className="text-sm text-muted-foreground">Cosmétiques uniquement : rien n'améliore ta progression.</span>
          </div>
          <div role="tablist" className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={categorie === c.id}
                className={`pixel-btn !px-2 !py-1 !text-[9px] ${categorie === c.id ? "!bg-accent" : ""}`}
                onClick={() => setCategorie(c.id)}
              >
                {c.libelle}
              </button>
            ))}
          </div>
          {message && (
            <p role="status" className={message.erreur ? "text-destructive" : "text-primary"}>
              {message.texte}
            </p>
          )}
          <ul className="space-y-2">
            {articles.map((a) => {
              const possede = etat.data!.possedes.includes(a.id);
              const equipe = etat.data!.equipes[a.categorie] === a.id;
              const occupe = enCours === a.id;
              return (
                <li key={a.id} className="pixel-box flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {a.categorie === "badge" && <span aria-hidden>{a.valeur}</span>}
                      {a.categorie === "couleur" && (
                        <span aria-hidden className="inline-block h-4 w-4 rounded-full" style={{ background: a.valeur }} />
                      )}
                      <strong>{a.nom}</strong>
                      {equipe && <span className="text-xs text-accent">équipé</span>}
                      {!equipe && possede && <span className="text-xs text-muted-foreground">possédé</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">{a.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!possede && (
                      <button className="pixel-btn !px-2 !py-1 !text-[9px]" disabled={occupe || enCours !== null} onClick={() => acheter(a)}>
                        {occupe ? "…" : `Acheter ${a.prix}`}
                      </button>
                    )}
                    {possede && cat.equipable && !equipe && (
                      <button className="pixel-btn !px-2 !py-1 !text-[9px]" disabled={occupe || enCours !== null} onClick={() => equiper(a)}>
                        Équiper
                      </button>
                    )}
                    {equipe && (
                      <button className="pixel-btn !px-2 !py-1 !text-[9px]" disabled={occupe || enCours !== null} onClick={() => retirer(a)}>
                        Retirer
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Fenetre>
  );
}
