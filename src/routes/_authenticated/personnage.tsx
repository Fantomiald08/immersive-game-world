import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Personnage } from "@/components/game/Personnage";
import { aleatoire, LIBELLES, OPTIONS, type Apparence, type Direction } from "@/game/apparence";
import { majProfil, useMonProfil, useRafraichirProfil } from "@/game/profil";

export const Route = createFileRoute("/_authenticated/personnage")({
  head: () => ({
    meta: [
      { title: "Création de personnage — Isitech World" },
      { name: "description", content: "Personnalise ton personnage avant d'entrer dans l'école Isitech." },
      { property: "og:title", content: "Création de personnage — Isitech World" },
      { property: "og:description", content: "Coiffure, tenue, accessoires : crée ton élève Isitech." },
    ],
  }),
  component: Creation,
});

const DIRS: Direction[] = ["bas", "droite", "haut", "gauche"];

function Creation() {
  const { data: p } = useMonProfil();
  const refresh = useRafraichirProfil();
  const nav = useNavigate();
  const [a, setA] = useState<Apparence | null>(null);
  const [dir, setDir] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (p && !a) setA(p.apparence); }, [p, a]);
  if (!p || !a) return <div className="p-8 text-center font-pixel text-xs">Chargement…</div>;

  const set = <K extends keyof Apparence>(k: K, v: Apparence[K]) => setA({ ...a, [k]: v });
  const save = async () => {
    setBusy(true);
    await majProfil(p.id, { apparence: a, personnage_cree: true });
    await refresh(); setBusy(false);
    nav({ to: "/jeu" });
  };

  const Couleurs = ({ k }: { k: "peau" | "cheveux" | "yeux" | "hautCouleur" | "basCouleur" | "chaussures" }) => (
    <div className="flex flex-wrap gap-1">
      {OPTIONS[k].map((c) => (
        <button key={c} aria-label={c} onClick={() => set(k, c)} className={`h-7 w-7 border-4 ${a[k] === c ? "border-accent" : "border-border"}`} style={{ background: c }} />
      ))}
    </div>
  );
  const Choix = <K extends "coiffure" | "haut" | "bas" | "accessoire">({ k }: { k: K }) => (
    <div className="flex flex-wrap gap-1">
      {(OPTIONS[k] as readonly string[]).map((v) => (
        <button key={v} onClick={() => set(k, v as Apparence[K])} className={`border-4 px-2 ${a[k] === v ? "border-accent bg-secondary" : "border-border bg-muted"}`}>{LIBELLES[v]}</button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4 md:grid-cols-[280px_1fr]">
      <div className="pixel-box flex flex-col items-center gap-3 p-4">
        <h1 className="font-pixel text-xs text-accent">Ton personnage</h1>
        <div className="bg-[#f0ddb6] flex h-64 w-full items-center justify-center border-4 border-border">
          <Personnage a={a} dir={DIRS[dir] ?? "bas"} marche taille={180} pseudo={p.pseudo} niveau={p.niveau} />
        </div>
        <div className="flex gap-2">
          <button className="pixel-btn" onClick={() => setDir((d) => (d + 3) % 4)} aria-label="Tourner à gauche">⟲</button>
          <button className="pixel-btn" onClick={() => setDir((d) => (d + 1) % 4)} aria-label="Tourner à droite">⟳</button>
        </div>
        <button className="pixel-btn w-full bg-accent text-accent-foreground" onClick={() => setA(aleatoire())}>🎲 Aléatoire</button>
        <button className="pixel-btn w-full" disabled={busy} onClick={save}>{busy ? "…" : "✔ Valider"}</button>
      </div>
      <div className="pixel-box space-y-3 p-4">
        <Ligne t="Couleur de peau"><Couleurs k="peau" /></Ligne>
        <Ligne t="Coiffure"><Choix k="coiffure" /></Ligne>
        <Ligne t="Couleur de cheveux"><Couleurs k="cheveux" /></Ligne>
        <Ligne t="Yeux"><Couleurs k="yeux" /></Ligne>
        <Ligne t="Haut"><Choix k="haut" /><Couleurs k="hautCouleur" /></Ligne>
        <Ligne t="Bas"><Choix k="bas" /><Couleurs k="basCouleur" /></Ligne>
        <Ligne t="Chaussures"><Couleurs k="chaussures" /></Ligne>
        <Ligne t="Accessoire"><Choix k="accessoire" /></Ligne>
      </div>
    </div>
  );
}

function Ligne({ t, children }: { t: string; children: React.ReactNode }) {
  return <div className="space-y-1"><div className="font-pixel text-[10px] text-primary">{t}</div>{children}</div>;
}
