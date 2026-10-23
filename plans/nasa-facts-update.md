# Feature: nasa-facts-update

Branch: `feature/nasa-facts-update` (cut from `dev`).

## Goal
Bring the science content in `public/data/planets.json` in line with NASA's current pages, so nothing a kid reads is out of date or stronger than NASA says.

## What NASA says (read 2026-10-23)
* Moon counts, from the NASA moons pages: Jupiter **115** (page updated 2026-09-21), Saturn **293** (as of August 2026), Uranus **29** (as of August 2026), Neptune **16**. The earlier numbers (95, 274, 28, 16) came from the planetary fact sheet dated 2025-03-18, which is older. Mars 2 and Earth 1 are unchanged.
* Mars hook: NASA calls Olympus Mons "the largest volcano in the solar system" (more than 25 miles / 40 km tall). It does not say "tallest", so the hook now says "biggest".
* Neptune hook: NASA calls it "our solar system's windiest world" with winds of 2,000 km/h; it does not say "fastest". The hook is reworded to match.
* Checked and unchanged: Venus hottest planet (467 C) and spins backward; Mercury smallest planet, 88-day year; Earth only place known with life, 1 moon; Moon gravity one-sixth of Earth's; Sun 99.8% of the mass; Jupiter biggest planet, Great Red Spot a storm bigger than Earth (about twice as wide); Saturn less dense than water ("could float in a bathtub"); Uranus tilted 97.77 degrees, spins on its side.

## Approach
Edit `planets.json` only (counts, two hooks, the `source` line). Moon counts stay `verify: true` because they keep changing. `lastChecked` stays 2026-10-23 (today).

## Skills / tools
NASA web pages (fetched directly). `tdd`: no new logic, the existing validator tests cover the file's shape.

## Risks
NASA's own pages disagree with each other in places (fact sheet versus moons pages); the newer moons pages were used and are named in `source`.

## Testing
`npm test` (the validator accepts the file), `npm run build`, `npm run test:e2e`, and a quick look at the picker in the browser is not needed (no UI change).
