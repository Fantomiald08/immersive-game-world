<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Isitech World — règles d'architecture
- All UI text is French; game runs on keyboard and mobile touch joystick.
- No secret keys in the browser: sensitive calls go through createServerFn, keys live in secrets.
- RLS on every table; profiles.xp/niveau are not client-writable (column grants) — only a SECURITY DEFINER SQL function may change them.
- Game code is split into scenes under src/game/scenes (one file per scene: Hall, Classe, Serveur, Cafeteria) with logic separated from rendering components in src/components/game.
- Characters are layered pixel SVG sprites (src/components/game/Personnage.tsx) driven by an Apparence JSON; NPCs reuse the same system.
- Decor objects are data (position, type, collision) so rooms are easy to extend.
- Game pages live under src/routes/_authenticated; /connexion is the public auth page.
- Player positions use Realtime broadcast/presence only, never stored in the database.
- XP only changes through the public.ajouter_xp RPC (capped per call); combat quizzes are generated client-side from course text (src/game/quiz.ts) — no AI key needed.
