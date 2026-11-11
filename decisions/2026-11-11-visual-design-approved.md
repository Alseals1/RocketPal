# Rocket Pal 2.0 visual design system approved

Date: 2026-11-11. Decided by the product owner, who approved all eight recommendations in `docs/VISUAL_DESIGN.md` section 13.

## What was decided
1. Fredoka (titles) and Lexend (everything else), both SIL Open Font License, self-hosted in `public/fonts/`, about 90 KB.
2. Gold is only for the one main action on a screen.
3. Panels with text use a 0.75 glass fill; full-screen sheets use a strong fill and a scrim, never blur.
4. The Star Map is an HTML orrery over the live 3D scene.
5. In the Hangar, tapping an item equips it.
6. One menu button opens Mission Control, which holds Settings; the gear button goes.
7. The photo credit is one line plus an info button that opens the full credit.
8. Boost is gold on glass instead of orange.

## Why
Measured contrast (section 4.1), the Chromebook performance budget (section 11), and the evaluation of today's screens (section 1): one accent per meaning, the universe as the hero, readable glass, no expensive full-screen blur, and fewer controls on screen.

## Alternatives
In each section of `docs/VISUAL_DESIGN.md`. The main ones: web fonts from a font CDN (rejected: the game sends nothing to other servers), a 3D Star Map (rejected: harder to make accessible and costlier), lighter glass (rejected: fails contrast over bright photos).
