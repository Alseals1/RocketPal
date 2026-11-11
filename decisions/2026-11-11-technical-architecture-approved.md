# Rocket Pal 2.0 technical architecture and roadmap approved

Date: 2026-11-11. Decided by the product owner, who approved all ten recommendations: the nine in `docs/TECHNICAL_ARCHITECTURE.md` section 12 and the roadmap change in `docs/DEVELOPMENT_ROADMAP.md`.

## What was decided
1. No backend; saves stay in `localStorage`.
2. Progression (XP, rank, stars, missions, chapters, patches, unlocks, Journal pages) is derived from saved facts, never stored.
3. One `Condition` language for missions, patches and unlocks.
4. One `GameEvent` stream: screens publish; progression, sound and rewards subscribe.
5. Layer import rules, enforced by `tests/architecture.test.ts`.
6. Rocket upgrades are gear with capabilities and can never reach the flight settings.
7. Every activity is a screen that ends with events.
8. Howler loads after the first tap; sounds and cues are data.
9. Repeat counters merge by the higher value, so two windows replaying at once may lose a few repeat XP; nothing else can be lost.
10. Design tokens and components (M3) come before the new screens; the full restyle of the older screens stays in M8.

## Why
See each section of `docs/TECHNICAL_ARCHITECTURE.md`: they keep rendering, rules and UI apart, make content data instead of code, keep saves safe across windows and versions, and let 2.0 grow without a rewrite.

## Alternatives
A backend with accounts (rejected: no feature needs it, and it brings children's data), stored XP and unlocks (rejected: they drift and are hard to merge), a UI framework or state library (rejected: a new dependency the game does not need).
