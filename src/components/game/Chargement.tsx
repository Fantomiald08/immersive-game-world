/** Écran de chargement dans le style du jeu : petit anneau de pixels + texte clignotant. */
export function Chargement({
  texte = "Chargement…",
  detail,
  plein = false,
}: {
  texte?: string;
  detail?: string;
  /** Plein écran (par-dessus le jeu) ou simple bloc centré. */
  plein?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`grid place-items-center bg-background p-6 text-center ${plein ? "fixed inset-0 z-[5000]" : "min-h-[60vh]"}`}
    >
      <div className="space-y-4">
        <div className="anim-spin-steps relative mx-auto h-12 w-12" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 h-2.5 w-2.5 bg-primary"
              style={{
                transform: `rotate(${i * 45}deg) translate(0, -18px) translate(-50%, -50%)`,
                opacity: 0.2 + (i / 8) * 0.8,
              }}
            />
          ))}
        </div>
        <p className="anim-blink font-pixel text-xs text-primary">{texte}</p>
        {detail && <p className="text-lg text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}
