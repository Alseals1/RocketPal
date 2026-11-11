# Rocket Pal 2.0: rules for action, challenges and rewards

Date: 2026-11-11. Decided by the product owner (the user), who chose the recommendations below. They fit the 2.0 brief (fun, education, action, customization) inside the existing product rules in `CLAUDE.md`.

## What was decided

1. **Timed challenges are stopwatches, never countdowns.** A challenge can show how long you took and "beat your best time". Time running long never ends a run, loses anything, or shows a warning. There are still no countdown timers.
2. **Action never ends a run with a failure.** Hitting an asteroid or an obstacle bounces the rocket and costs a few seconds. The run continues and the mission is never lost. This is the same rule as quizzes: wrong answers never end a mission.
3. **Every reward is earned, and you know how you earn it.** Upgrades, rocket trims, outfits and equipment unlock with stars or by finishing a named mission. Nothing is random (no loot boxes, no mystery rewards) and nothing costs real money. Stars and unlocks only ever go up.
4. **Glassmorphism, with a plain fallback.** The new look uses frosted glass panels. Background blur is costly on a school Chromebook, so the low-quality mode and reduced motion use a plain translucent panel without blur. The look must still reach 30+ fps on a Chromebook, measured on a real one before it ships.

## Why
* The brief asks for timed challenges and action, and the rules ban countdown timers and failure that ends a mission. A personal-best stopwatch and a bounce-and-continue collision keep the excitement without pressure or losing.
* Earned, visible rewards are "collection and rewards", which the rules allow. Random rewards are loot boxes, which they ban.
* Blur over a moving 3D picture is one of the most expensive effects for a weak graphics chip. The game already switches to low quality by itself, so the fallback goes there.

## Alternatives
* Real countdown timers in some mini-games: rejected, it would mean changing a product rule for ages 8-10.
* Crashing ends the mini-game ("try again"): rejected, it is losing.
* A random "space crate" after a mission: rejected, it is a loot box.
* Glass everywhere with no fallback: rejected until measured on a Chromebook.
