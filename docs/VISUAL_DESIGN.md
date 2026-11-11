# Rocket Pals: visual design

How the game looks today, and where 2.0 is taking it. The accessibility and performance rules in `CLAUDE.md` come first: a look that breaks them does not ship.

## Today

* **Panels:** solid dark navy cards with a sun-yellow border and rounded corners (flying HUD, landing title card, fact card, quiz card, settings).
* **Buttons:** chunky sun-yellow pills with a darker bottom edge, and outlined pills for second choices ("Got it", "Not now").
* **Type:** a rounded sans (`'Trebuchet MS', 'Arial Rounded MT Bold', ui-rounded, system-ui`), 18 px base, scaled by the text-size setting (`--ui-scale`).
* **Space:** generated planet textures, a point star field, soft glow sprites on high quality, the Blender rocket. Landings show real NASA photos.
* **Orbit:** three 2D portraits (neutral, happy, thinking) rendered from the Blender model.

Colour tokens (`src/style.css`, `:root`):

| Token | Value | Used for |
| --- | --- | --- |
| `--navy` | `#12163d` | Panel background |
| `--navy-soft` | `rgba(18, 22, 61, 0.86)` | Translucent panels |
| `--sun` | `#ffd166` | Borders, main buttons, titles |
| `--sun-deep` | `#e8a317` | Button bottom edge |
| `--sky` | `#7bdff2` | Links, sources, highlights |
| `--ink` | `#ffffff` | Text |
| page | `#03040c` | Behind the canvas |

`src/style.css` is one file of about 950 lines with only these few tokens. Sizes, radii and shadows are written out by hand in each rule.

## Direction for 2.0

Premium glassmorphism, cinematic 3D, a futuristic cockpit, and playful but sophisticated animation. It still has to feel friendly to an 8-year-old: bright, rounded, nothing scary.

* **Glass panels:** frosted translucent panels with a soft light edge and depth, over the moving scene. The sun-yellow stays as the accent, so the game keeps its identity.
* **Cockpit HUD:** the flying HUD becomes instruments around the edge of the screen (distance, light-time, speed, destination), leaving the middle clear for flying.
* **Cinematic space:** real planet textures (`ASSETS.md`), atmosphere glow, better lighting, camera moves on take-off and landing.
* **Animation:** short, springy movement on panels and buttons. Every animation has a reduced-motion version (no movement, or a fade).

## Rules for the new look

* **Performance first.** `backdrop-filter: blur()` over a WebGL canvas is one of the most expensive effects on a weak graphics chip. On low quality and with reduced motion, panels use a plain translucent fill (like `--navy-soft`) instead of blur. The quality level must be exposed to CSS for this (it is not today). Measure frame rate on a real Chromebook before shipping.
* **Contrast.** Text on glass must still meet WCAG AA contrast over the brightest thing behind it (the Sun, Saturn's rings, a bright NASA photo). Use a darker fill or a text backing where a panel can sit over bright scenery.
* **Colourblind-safe.** Never colour alone: right and wrong answers keep a word and a mark.
* **Big targets** for touch, and every control reachable by keyboard.
* **Text size.** Every panel works at Normal, Big and Extra big, including on small phones (the browser tests check this).

## Proposed: design tokens (#21)

Before restyling, replace the hand-written values in `src/style.css` with tokens: glass fill and edge, blur amount (0 on low quality), radii, shadows, spacing, type scale and motion durations. The new look is then applied one screen at a time, starting with the flying HUD, with the browser tests' layout checks proving nothing overlaps.
