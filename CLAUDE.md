# Rocket Pals

A 3D browser game that teaches kids aged 8-10 about the solar system. The player flies a small rocket between the Sun, eight planets, and the Moon, lands, learns facts, completes short missions, and answers quizzes. See `plans/` for per-feature plans.

## Git and branch rules (non-negotiable)

- **Never push to `main`.** Never commit to `main`. Never force-push. Only a human promotes `dev` to `main`.
- **`dev` is the integration branch.** All work reaches `dev` only through a reviewed pull request.
- Every feature uses its own branch cut from the latest `dev`, named `feature/<short-name>`.
- Never commit directly to `dev` or `main`. Always work on a feature branch.
- After a feature branch is merged into `dev`, **delete the feature branch** (remote and local).

## Feature workflow (follow in order, every time)

1. **Plan.** Before writing code, write a plan for the feature in `plans/<feature-name>.md` (goal, approach, files touched, risks, how it will be tested, which skills/tools you will use). Commit the plan with the feature.
2. **Build.** Implement on `feature/<short-name>`, cut from `dev`.
3. **Test.** Test the feature before finishing it and again before opening the PR (see Testing below). Do not open a PR with failing or missing tests.
4. **Push and open a PR.** Push the feature branch and open a pull request with `dev` as the base. Never target `main`. Describe what changed and how it was tested.
5. **PR review.** Run the `pr-reviewer` agent (`.claude/agents/pr-reviewer.md`) on the PR. It reviews the change and either approves it or leaves comments.
6. **Fix and re-review.** If the reviewer leaves comments, fix every one of them in the feature branch, re-test, push, and run `pr-reviewer` again on the updated PR. Repeat until the reviewer approves. Do not argue past a comment: fix it, or explain concisely in the PR why it should not change and let the reviewer decide.
7. **Merge.** Only when the reviewer has approved, merge the feature branch into `dev`, then delete the feature branch.

The loop is: plan -> build -> test -> push feature branch -> PR review -> (fix -> test -> PR review)* -> approved -> merge into `dev`.

## Testing

- Every feature needs automated tests (Vitest for logic such as scoring, quiz, save/load, and data validation) and a browser check (a Playwright smoke test that the game loads, the feature works, and there are no console errors).
- Also do a real play-through of the feature in the browser and note the result in the PR. For 3D and flight features, check controls on keyboard and touch layout, and check frame rate.
- Run the full suite and the build (`npm test`, `npm run build`) before every push. Fix failures before continuing.
- Test every feature before making a PR. Never finish a feature untested.

## Use the skills available in the app

Before starting any task, check which skills and tools are available in this app and **use the ones that fit the job** instead of improvising. Examples: frontend or design skills for UI, testing and debugging skills for tests and bugs, code review skills for PR checks, documentation skills for docs, and the Blender MCP tools for 3D assets. Name the skills you used in the feature plan and in the PR description.

This project already has these skills installed in `.agents/skills/` (listed in `skills-lock.json`). Use them for the matching job:

- `tdd`: write tests first for game logic (scoring, quizzes, save/load, data validation).
- `frontend-design`: for menus, HUD, fact cards, journal, and any kid-facing UI.
- `animation-performance`: for UI and in-game animation, so it stays smooth on a Chromebook.
- `grill-me`: use it while writing a feature plan to pressure-test the idea and surface gaps before building.

## Tech stack

- Three.js + TypeScript + Vite, static site, no backend, no accounts.
- HTML/CSS overlay for UI, Howler.js for audio, browser speech synthesis for read-aloud.
- Progress in localStorage only.
- Content lives in `public/data/*.json` (planets, quizzes, missions) so it is editable without code. Each fact set has a `lastChecked` date; verify numbers against NASA before shipping.
- Models as compressed glTF in `public/models`. Textures at most 2048px, loaded lazily.

## Product rules

- Audience: ages 8-10. Short sentences, friendly tone, nothing scary.
- Healthy engagement only: collection, rewards, cliffhangers, ranks, surprises. **Never add** ads, purchases, loot boxes, countdown timers, streak penalties, push notifications, leaderboards, or any data collection.
- Wrong answers never end a mission. Kids can always retry.
- Accessibility: keyboard and touch, large targets, colorblind-safe palette, adjustable text size, read-aloud on every fact card, reduced-motion option.
- Performance: 30+ fps on a school Chromebook, under 15 MB to first play, automatic low-quality mode.

## Assets

- Original models (ship, rover, astronaut, the robot guide) are built in Blender and exported as glTF. Check whether Blender MCP tools are available. If they are, build and review the models yourself.
- If Blender access is missing, use placeholder shapes, list what is needed in `ASSETS.md` (name, purpose, polygon budget, target path, style notes), and tell the user to take that list to their Claude desktop chat where Blender is connected.
- Record the source and license of every texture, model, and sound in `CREDITS.md`.

## Working style

- Keep code simple and well organized. Ask the user when something is ambiguous.
- After each feature, tell the user how to try it and list any assets or decisions you need.
