# Feature: followups

Branch: `feature/followups` (cut from `dev`). Small clean-ups left over from the Mars landing and earlier reviews.

## Goal
Close the open review notes so nothing is carried around forever, and record the user's licensing decision.

## What
1. **Licensing decision recorded.** On 2026-10-23 the user answered the licensing question ("Yes, use the NASA photos"). `decisions/2026-10-23-landing-uses-real-nasa-panoramas.md` and `CREDITS.md` now say so. The recommendation to ask NASA before anything goes to `main` stays as an open item for a human.
2. **Listen button heals itself.** After one false alarm ("No voice on this computer"), the button stayed disabled for the whole visit. Now each time a fact card opens, the speaker gets a fresh try. (From the PR #7 review.) The delay between cancel and speak was considered and not added: a quick tap on Listen for a second card while one is reading is the only exposed case, and a fresh try per card covers it.
3. **A flaky flying test fixed.** `e2e/fly.spec.ts` "keyboard steers, pitches, and boosts" used fixed waits and failed once in 248 runs under load. It now holds each key until the ship has really responded. (From the PR #7 review, found by repeat-testing.)
4. **Content carry-overs** (from the PR #5 review): the Neptune hook says "over 2,000 km/h" the way NASA does ("more than 1,200 mph (2,000 km/h)"), and `planets.json` `source` lists the specific NASA pages the numbers and hooks came from.

## Skills / tools
`tdd` (the speech fix is test-first in the browser suite), Playwright with repeat runs to prove the flaky test is fixed, NASA pages re-read for item 4.

## Risks
Tiny. The speech change is the only logic: a reset per card must not hide a genuinely missing voice (it still says "No voice on this computer" after 2.5 seconds on each card; a test covers that).

## Testing
New browser test for the speech reset (red first); `fly.spec.ts` repeated 16 times over with 8 workers; full `npm test`, build, and `npm run test:e2e`.
