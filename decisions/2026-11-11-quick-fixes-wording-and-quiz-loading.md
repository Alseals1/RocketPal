# Quick fixes: the speed lesson, "flying past", and dropping one bad quiz

Date: 2026-11-11. Decided by the Plan agent for issue #30 and approved at plan review; built by the Implement agent.

## What was decided
1. **The speed lesson says the rocket is pretend.** Under `Pretend speed: …` the stats card shows `N times faster than light! Only a pretend rocket can do that.` (N rounded, with a thousands comma), and under it `Real rockets are much slower: New Horizons took about 9 and a half years to reach Pluto.`
   - From 1 to 1.5 times light speed the first line reads `Faster than light! Only a pretend rocket can do that.` ("1 times faster" reads oddly).
   - At or below light speed it reads `Our rocket is pretend.` It never says "faster than light" when that is not true.
   - Both lines are hidden with no target and when docked. On phones and short screens (`max-width: 600px` or `max-height: 520px`) the New Horizons line is hidden too: with the biggest text it pushed the card into the Autopilot button at 420 x 900. This is the plan's fallback, applied to narrow screens as well as short ones because that is where it was measured. The logic is `pretendSpeedNote` and `REAL_ROCKET_COMPARISON` in `src/scale/readout.ts`.
2. **"Flying past" for the Sun and the giant planets only.** Docking at the Sun, Jupiter, Saturn, Uranus or Neptune shows `You are flying past <name>!` and `There is no solid ground to land on here. Fact cards and missions are coming soon.`, and the stats card says `Great flying!`. Mercury, Venus and the Moon keep "landed". The list is `arrivalWording` in `src/data/surfaces.ts`, using the same literals as `ArrivalDef.wording` (`docs/TECHNICAL_ARCHITECTURE.md` 4.9), so it moves into the arrival data later with no caller change.
3. **One bad quiz drops only itself.** `keepValidQuizzes` checks each quiz on its own with `validateQuizzes`, keeps the valid ones (the first one for a world, if a world has two), and `loadQuizzes` logs one `console.error` listing what was left out. A file that is unusable as a whole (not an object, no real `lastChecked`, `quizzes` not a list) still throws, and the game falls back to no quizzes as before. `validateQuizzes` stays strict, so the shipped-content test still fails on any problem.

## Why
- The pretend speed is about 19 times light speed on the way to Saturn, shown right under "Light needs 9.4 seconds". Kids could learn that rockets outrun light. Saying it plainly, with one real trip to compare, keeps the fun number and makes the lesson true.
- `GAME_DESIGN.md`: the words say "flying past", never "landed", on the Sun and the giant planets. Mercury, Venus and the Moon have solid ground (and real landers have touched down on all three), so "landed" is true there.
- One typo in one quiz removed every world's quiz. The general per-entry loader is #38; this is the small version for quizzes only.

## Facts checked (2026-11-11)
- New Horizons launched on 19 January 2006 and flew past Pluto on 14 July 2015 (9.49 years): https://science.nasa.gov/mission/new-horizons/
- The Sun: "The Sun doesn't have a solid surface like Earth and the other rocky planets and moons." https://science.nasa.gov/sun/facts/
- Jupiter: "As a gas giant, Jupiter doesn't have a true surface." https://science.nasa.gov/jupiter/facts/
- Saturn: "As a gas giant, Saturn doesn't have a true surface." https://science.nasa.gov/saturn/facts/
- Uranus: "As an ice giant, Uranus doesn't have a true surface." https://science.nasa.gov/uranus/facts/
- Neptune: "Neptune does not have a solid surface." https://science.nasa.gov/neptune/neptune-facts/

## Alternatives
- **"Flying past" for all 8 worlds without a photo:** wrong for Mercury, Venus and the Moon, and not what the approved design says.
- **A `hasSolidSurface` field in `planets.json` / `World`:** changes a shared type and the content schema for something that already has a planned home in `ArrivalDef`.
- **Deriving "no ground" from `kind` or size:** `kind` cannot tell Jupiter from Mars, and a size cut-off is a hidden rule.
- **Hiding the pretend speed number:** the issue asks for an honest lesson, not for removing it.
- **Relaxing `validateQuizzes`:** the shipped-content test relies on it failing on any problem.
