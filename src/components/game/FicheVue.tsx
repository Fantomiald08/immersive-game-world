import type { FicheRevision } from "@/game/fiche";

/** Fiche de révision d'un cours : résumé, notions clés, pièges et points à retenir. Imprimable. */
export function FicheVue({ fiche }: { fiche: FicheRevision }) {
  const section = (titre: string, items: string[]) =>
    items.length > 0 && (
      <section className="space-y-1">
        <h5 className="font-bold text-[#1d3f73]">{titre}</h5>
        <ul className="list-disc space-y-1 pl-5">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>
    );
  return (
    <article className="space-y-3 rounded border-2 border-[#9fc2e8] bg-white p-3 text-sm text-[#1a1a1a]">
      <header className="flex items-start justify-between gap-2">
        <h4 className="text-base font-bold">📘 {fiche.titre}</h4>
        <button
          type="button"
          onClick={() => window.print()}
          className="shrink-0 rounded border border-[#9fc2e8] px-2 py-1 text-xs hover:bg-[#eef5ff]"
        >
          🖨 Imprimer
        </button>
      </header>
      {section("Résumé", fiche.resume)}
      {fiche.notions.length > 0 && (
        <section className="space-y-1">
          <h5 className="font-bold text-[#1d3f73]">Notions clés</h5>
          <dl className="space-y-2">
            {fiche.notions.map((n, i) => (
              <div key={i}>
                <dt className="font-semibold">{n.titre}</dt>
                <dd className="pl-3">{n.texte}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {section("Pièges classiques", fiche.pieges)}
      {section("À retenir absolument", fiche.aRetenir)}
    </article>
  );
}
