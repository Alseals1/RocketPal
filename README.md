# Rocket Pals

A 3D browser game that teaches kids aged 8-10 about the solar system. Fly a small rocket between the Sun, the eight planets, and the Moon; land, learn facts, finish missions, and answer quizzes.

Three.js + TypeScript + Vite. Static site, no backend, no accounts. Progress is saved in `localStorage` only.

## Run it

```sh
npm install
npm run dev          # play at http://localhost:5173
npm test             # unit tests (Vitest)
npm run build        # type-check + production build into dist/
npm run test:e2e     # browser smoke test (Playwright; first run: npx playwright install chromium)
```

Project rules, branch workflow, and product rules are in `CLAUDE.md`. Per-feature plans are in `plans/`. Game content (planets, quizzes, missions) lives in `public/data/*.json` so it can be edited without code.

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

### What is verified and what is not

* Verified: the server binary starts, speaks MCP over stdio, reports `blender-mcp`; the server code defaults to port 9876 and reads `BLENDER_MCP_HOST` / `BLENDER_MCP_PORT` if you ever change the add-on's port; Blender is listening on 9876 now.
* **Not verified:** that the tools can actually drive your open Blender scene from Claude Code (that needs the restart above). The path contains the extension's install location; if the Claude desktop app updates the extension the folder may change, so re-run `claude mcp add` if `blender` stops connecting.
* **Not verified:** the official README at https://projects.blender.org/lab/blender_mcp (it returned HTTP 403 to automated fetches), so the command is based on the installed extension's `manifest.json`, `pyproject.toml`, and code rather than that page. Search results for "blender-mcp" mostly describe a different, community project (`uvx blender-mcp`); do not use that one.
