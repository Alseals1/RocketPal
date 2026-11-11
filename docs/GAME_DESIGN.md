# Rocket Pals: game design

What the game is and the rules every feature follows. The product rules in `CLAUDE.md` always win. Decisions that change this design go in `decisions/` and are summarized here.

## The game

A 3D browser game for kids aged 8-10. The player flies a small rocket between the Sun, the eight planets and the Moon, lands, explores real NASA pictures, learns facts, finishes missions and answers quizzes. Orbit, a friendly robot, is the guide.

## The four pillars (Rocket Pal 2.0)

| Pillar | What it means here | Today | Planned |
| --- | --- | --- | --- |
| **Fun** | Exploration, discoveries, rewards that feel good | Free flight between 10 worlds, glowing fact dots to find, stars | Mini-games, surprises, the Space Journal and badges |
| **Education** | Real astronomy, planetary science, space exploration, basic physics | Real distances and light-time on the HUD, NASA photos, facts checked against NASA and dated, quizzes built only from those facts | Landings and quizzes for all 10 worlds; physics shown through play (speed, gravity, orbits) |
| **Action** | Piloting, obstacle avoidance, rescue missions, asteroids, timed challenges | 3D flight with assists, autopilot | An asteroid course first, then rescue missions |
| **Customization** | Rocket looks, astronaut outfits, equipment, upgrades, collectibles | None (the ship has one recolourable `Trim` material) | A hangar to unlock rocket trims with stars, then outfits and equipment |

## The core loop

Pick a world → fly there (the HUD shows the real distance) → land → look around and find the glowing dots → finish the mission ("Find 3 things") → take the quiz → earn stars → spend stars on unlocks → pick the next world (Orbit teases it).

## Rules for every feature

From `CLAUDE.md` and `decisions/2026-11-11-rocket-pal-2-game-rules.md`:

* **Nothing ends in failure.** Wrong answers never end a mission and kids can always retry. In action games, bumping into something bounces the rocket and costs a few seconds; the run goes on.
* **No countdowns.** A timed challenge is a stopwatch with "beat your best time". Running long never loses anything or shows a warning.
* **Rewards are earned and visible.** Every unlock says what earns it (stars, or finishing a named mission). Nothing is random, nothing costs money, and stars and unlocks only go up.
* **Healthy engagement only.** Collection, rewards, friendly cliffhangers, ranks and surprises are fine. Never ads, purchases, loot boxes, countdown timers, streak penalties, push notifications, leaderboards or data collection.
* **Stars.** On each world: 1 star for the mission, 1 for finishing the quiz, and a bonus star for getting every answer right first time. Two of three come from finishing, so a kid who needs retries is never short-changed.
* **Facts are real.** Every fact comes from a NASA page, carries a `lastChecked` date, and is read again against NASA before shipping. Quiz answers must be backed by a fact the kid can find.
* **Words for ages 8-10.** Short sentences, friendly tone, nothing scary.
* **Everyone can play.** Keyboard and touch, large targets, a colourblind-safe palette, adjustable text size, read-aloud on every fact card, a reduced-motion option.

## Open design questions

* Which mini-games come after the asteroid course, and how they tie to a world's facts.
* What a rescue mission is (who or what is rescued, where).
* What can be customized first beyond rocket trims; outfits need the astronaut model (`ASSETS.md`).
* The order of the remaining eight worlds after the Moon.
* Whether found dots are remembered between visits (they count per visit today).
