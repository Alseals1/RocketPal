# Rocket Pals: Claude Code kickoff prompt

Paste everything below the line into Claude Code, started in this project folder.

---

You are building "Rocket Pals", a 3D browser game that teaches kids aged 8-10 about the solar system. The project folder is your current working directory, and the GitHub remote is https://github.com/Alseals1/RocketPal (branches: `main` and `dev`).

## Read this first, and follow it for the whole project
Before doing anything, read `CLAUDE.md` in the project root. It defines the rules you must follow every time:
- Never push to `main`. Never commit directly to `main` or `dev`. Only a human promotes `dev` to `main`.
- Every feature: plan (write `plans/<feature>.md` first) -> build on `feature/<name>` cut from `dev` -> test -> push the feature branch and open a PR into `dev` -> run the `pr-reviewer` agent (`.claude/agents/pr-reviewer.md`) -> fix every comment and re-review until approved -> merge into `dev` and delete the feature branch.
- Test every feature before opening a PR. Never finish a feature untested.
- Check the skills available in the app and use the ones that fit. This project has these in `.agents/skills/`: `tdd` (game logic tests), `frontend-design` (menus, HUD, fact cards), `animation-performance` (smooth animation on weak devices), and `grill-me` (use it to pressure-test each feature plan before building). Name the skills you used in each plan and PR.

If the repo is not initialized or the `dev` branch does not exist yet, tell me what is missing instead of pushing to `main`.

## Game summary
The player flies a small rocket through a 3D solar system, lands on each world, taps hotspots to read fact cards, completes a short mission, and answers a 3-question quiz. Stars, badges, and a Space Journal reward them. Worlds: the Sun, Mercury, Venus, Earth, the Moon, Mars, Jupiter, Saturn, Uranus, Neptune. A friendly robot guide named Orbit (placeholder name) explains each step in 1-2 short sentences.

## Tech stack
- Three.js + TypeScript + Vite, deployed as a static site (no backend, no accounts).
- HTML/CSS overlay for UI. Howler.js for audio. Browser speech synthesis for read-aloud.
- Progress saved in localStorage only. Planet facts, quizzes, and missions live in JSON under public/data so they are easy to edit.
- Models as compressed glTF in public/models. Textures capped at 2048px, loaded lazily.
- Tests: Vitest for logic, Playwright for a browser smoke test of each feature.

## Quality bar
- 30+ fps on a school Chromebook, under 15 MB to first play, and a low-quality mode that disables glow and shadows automatically on weak hardware.
- Keyboard (WASD/arrows, Space to boost), touch (virtual joystick and boost button), and tap/click-only access. Large targets, colorblind-safe palette, adjustable text size, read-aloud on every fact card, reduced-motion option.
- Assisted steering and docking so kids never fail to land.

## Core loop (about 5 minutes per world)
Pick a destination -> fly (distance/speed readout shows scale) -> land -> tap hotspots for fact cards -> mission -> 3-question quiz -> stars, badge, journal entry -> teaser for the next world.
Modes: guided Journey (Sun to Neptune) and Free Fly (unlocks after Earth).

## Engagement design (healthy, no dark patterns)
Journal with visible empty sticker slots, a cliffhanger teaser after each mission, pilot ranks (Cadet to Commander) and cosmetic ship upgrades earned with stars, random events (comets, shooting stars, Easter eggs), a gentle daily mission with no streak loss, personal-best scores with no leaderboards, and quiz answers that power up the ship. Do NOT add ads, purchases, loot boxes, timers, streak penalties, push notifications, leaderboards, or any data collection. Wrong answers never end a mission. Sessions end naturally at 10-15 minutes with a friendly goodbye screen.

## Mini-games (each under 2 minutes, one idea each)
Asteroid Dodge, Weigh Yourself (gravity), Build a Rocket, Size Lineup, Day and Year.

## Facts (approximate, verify against NASA before shipping)
Keep each world's diameter, orbit length, moon count, and hook in public/data/planets.json with a "lastChecked" date. Moon counts change, so mark them for verification.
- Sun: star with 99.8% of the system's mass. Mercury: smallest planet, 88-day year. Venus: hottest (~465 C), spins backward. Earth: only known life, 1 moon. Moon: about 1/6 gravity. Mars: red from iron oxide, tallest volcano Olympus Mons, 2 moons. Jupiter: Great Red Spot, 90+ moons. Saturn: rings, less dense than water, 270+ moons. Uranus: spins on its side. Neptune: winds over 2,000 km/h.

## Phases (each phase is one or more features that go through the full workflow in CLAUDE.md; finish and verify each before moving on)
1. Fly: solar system scene with all bodies, star field, ship controls on keyboard and touch.
2. Land and learn: landing, hotspots, fact cards from JSON, the Orbit guide. Earth and Mars fully playable end to end.
3. Play: missions, quizzes, stars, badges, Space Journal for all ten worlds.
4. Mini-games and sound: five mini-games, music, effects, read-aloud.
5. Polish and test: custom models, performance tuning, accessibility, playtest notes.

## Assets: what I need you to do
The ship, rover, astronaut, Orbit the robot, and props should be original stylized models built in Blender (bright, rounded, friendly) and exported as compressed glTF. Planet textures should come from NASA imagery or openly licensed sets, with the source and license of every file recorded in CREDITS.md.

At the very start, before writing game code:
1. Check whether you have access to a Blender MCP connection (look for Blender tools in your tool list). If you do, build the models yourself and review them with screenshots.
2. If you do NOT have Blender access, do not stop. Use simple placeholder shapes so the game stays playable, create ASSETS.md listing every asset still needed (name, purpose, polygon budget, target path under public/models or public/textures, style notes), and tell me clearly that I should take that list to my Claude desktop chat, where Blender is connected, so those assets can be built and saved into the project.
3. Also check whether you can download textures from the web. If not, use procedural placeholder textures and add the needed texture sources to ASSETS.md for me to supply.
4. Tell me step by step how to connect the Blender MCP to Claude Code on my Mac: the Blender add-on (the "MCP" extension from Blender Lab, v1.0.3) is already installed and running on port 9876 in my Blender 5.2; the part I need is the command that launches the blender-mcp server over stdio, which my Claude desktop app currently runs via uv. Give me the exact `claude mcp add` command if you can work it out from the blender_mcp repository README (https://projects.blender.org/lab/blender_mcp), and say plainly which part you are unsure about, rather than guessing.

## Working style
- Start by showing me a short plan and the project layout (also saved in `plans/`), then begin phase 1.
- After each feature is merged into `dev`, tell me how to try it and list any assets or decisions you need from me.
- Ask me when something is ambiguous. Keep the code simple and well organized, since a kid-friendly content team will edit the JSON files.
