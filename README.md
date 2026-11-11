# Rocket Pals

A 3D browser game that teaches kids aged 8-10 about the solar system. Fly a small rocket between the Sun, the eight planets, and the Moon; land, learn facts, finish missions, and answer quizzes.

Three.js + TypeScript + Vite. Static site, no backend, no accounts. Progress is saved in `localStorage` only.

## Run it

```sh
npm install
npm run dev          # play at http://localhost:5173
npm test             # unit tests (Vitest)
npm run build        # type-check + production build into dist/
npm run test:e2e     # browser tests (Playwright; first run: npx playwright install chromium)
npm run size-report  # after test:e2e: bundle size and first-play download size
```

Use Node 24 (`.nvmrc`).

**Browser-test port.** `npm run test:e2e` builds the game and serves it on a port picked from the checkout's folder (somewhere from 4200 to 4999), so two checkouts or worktrees can run the browser tests at the same time without testing each other's build. It never reuses a server that is already running: if the port is taken, the run stops with an "already used" error. To pick the port yourself, set `E2E_PORT` (a whole number from 1024 to 65535):

```sh
E2E_PORT=4300 npm run test:e2e
```

## Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request into `dev` and every push to `dev`. The check is called **Tests and build**. It runs, in order:

1. `npm ci`
2. `npm test` (unit tests)
3. `npm run build` (type check and production build)
4. `npm run test:e2e` (browser tests in Chromium; in CI each test gets 60 seconds and one retry, because the 3D scene is drawn in software)
5. `npm run size-report`

The **job summary** (open the run, then "Summary") shows the code bundle size, the whole `dist/` size, and the first-play download size against the 15 MB budget. A browser test fails if first play reaches 15 MB, or if the page fetches anything from another site.

When a run fails, the Playwright report and test results are uploaded as the **playwright-report** artifact (kept 14 days) at the bottom of the run's summary page.

npm packages and the Playwright browser are cached between runs. The check should be required before merging into `dev` (a repo setting a person turns on).

## How to play

| | Keyboard | Touch | Tap or click only |
| --- | --- | --- | --- |
| Steer left / right | A / D or Left / Right arrows | Drag the stick left / right | |
| Nose up / down | W / S or Up / Down arrows | Drag the stick up / down | |
| Boost | Space | Hold the BOOST button | |
| Pick a destination | **Where to?** button | **Where to?** button | **Where to?** button |
| Fly there for me | | | **Autopilot** button (steering by hand takes over again) |

The rocket always drifts forward and levels itself out when you let go. Pick a destination and it gently pulls you in, slows you down, and docks. The card in the corner shows the *real* distance, how long light would take, and a "pretend speed" (the scene is shrunk so trips take seconds).

**Settings** (the gear button under **Where to?**): text size (Normal, Big, Extra big) and **Reduce motion** (Same as my computer, On, Off). They apply straight away and are remembered in this browser only (nothing is sent anywhere). If the browser will not save anything, the game still works; the choices just are not remembered.

**Landing:** when the rocket docks at a world that has a real NASA photograph (Mars and Earth for now), you see it. At **Mars** you stand inside a 360 degree panorama; at **Earth** you look out of a space station window at one wide astronaut photo (a drawn window frame surrounds it, and the screen says so). Drag or swipe to look around (arrow keys or WASD also work), tap the glowing dots to read short facts, press **Listen** to hear a card read aloud, and press **Back to space** to lift off. Other worlds still show a plain "You landed" card until their pictures are added (`ASSETS.md`).

Making a Mars-style 360 degree picture: `node tools/make-panorama.mjs <NASA photo.jpg> public/textures/surfaces <name>` turns a NASA panorama into the two sphere pictures the game loads (see the comments at the top of the script; the numbers in it describe the Mars photo). The facts for each dot live in `public/data/surfaces.json` and each carries the NASA page it was checked against.

Page options (add to the address, for example `http://localhost:5173/?quality=low`):

* `?quality=low` or `?quality=high` forces a quality level. Without it the game starts at the right level for the computer and switches to low by itself if it runs slowly.
* `?touch=1` shows the touch controls on a computer.
* `?debug=1` adds a read-only `window.rocketPals` object used by the browser tests.

Project rules, branch workflow, and product rules are in `CLAUDE.md`. The roadmap, progress and design docs are in `docs/`. Per-feature plans are in `plans/`. Game content (planets, quizzes, missions) lives in `public/data/*.json` so it can be edited without code.

## Connecting the Blender MCP to Claude Code (macOS)

The Blender MCP has two halves. You already have the first one working:

1. **Blender add-on** (Blender Lab "MCP" extension) running inside Blender. It listens on `127.0.0.1:9876`. Verified here: something named `Blender` is listening on that port.
2. **MCP server** that Claude launches over stdio. Claude desktop runs it from the installed extension (`manifest.json` says `command: uv`, `args: run blender-mcp`). Claude Code needs its own entry for this.

### Command (verified to start and answer an MCP `initialize` request)

`uv` is not installed on this Mac, but the Claude desktop extension already ships a ready-made virtualenv with the `blender-mcp` launcher, so no `uv` is needed. In Terminal:

```sh
claude mcp add --scope user blender -- "$HOME/Library/Application Support/Claude/Claude Extensions/ant.dir.gh.blender.blender-mcp/.venv/bin/blender-mcp"
```

Then **quit and restart Claude Code** in the project folder (new MCP tools only load at start), keep Blender open with the add-on running, and run `claude mcp list` - `blender` should show as connected. Ask Claude "list the Blender tools" to confirm.

If you would rather use `uv` like the desktop app does (needs `brew install uv` first):

```sh
claude mcp add --scope user blender -- uv run --directory "$HOME/Library/Application Support/Claude/Claude Extensions/ant.dir.gh.blender.blender-mcp" blender-mcp
```

### Troubleshooting

* `claude mcp list` should show `blender` as connected. Blender must be open with the Blender Lab MCP add-on running (it listens on `127.0.0.1:9876`). If you changed the add-on's port, set `BLENDER_MCP_PORT` (and `BLENDER_MCP_HOST` if needed) with `claude mcp add ... -e BLENDER_MCP_PORT=<port>`.
* The path above is inside the Claude desktop extension folder. If the desktop app updates the extension and `blender` stops connecting, run the `claude mcp add` command again.
* The official README (https://projects.blender.org/lab/blender_mcp) blocks automated fetches, so this command is based on the installed extension's `manifest.json`, `pyproject.toml`, and code. Search results for "blender-mcp" mostly describe a different, community project (`uvx blender-mcp`); do not use that one.
