# Feature: project-setup

Branch: `feature/project-setup` (cut from `dev`).

## Goal
A runnable, testable, buildable empty shell so every later feature has the same foundation. Done = `npm test`, `npm run build`, and the Playwright smoke test all pass, and the page loads with no console errors.

## Approach
* Vite + TypeScript (strict), `three`, `howler` as dependencies. Vitest for unit tests, Playwright (Chromium) for browser checks.
* Scripts: `dev`, `build` (type-check then vite build), `preview`, `test` (Vitest), `test:e2e` (Playwright, serves the built site with `vite preview`).
* The page shows a title and a canvas placeholder only. No game code yet.
* Docs: `README.md` (how to run, how to connect Blender MCP), `ASSETS.md`, `CREDITS.md`.

## Files touched
`package.json`, `tsconfig.json`, `vite.config.ts`, `vitest` config (inside `vite.config.ts`), `playwright.config.ts`, `index.html`, `src/main.ts`, `src/style.css`, `tests/smoke.test.ts`, `e2e/smoke.spec.ts`, `README.md`, `ASSETS.md`, `CREDITS.md`, `plans/*`.

## Skills / tools
`tdd` (the single unit test is written first and seen failing), `frontend-design` is not needed yet (no UI). Playwright for the browser check.

## Risks
* Playwright browser download is large; it is a dev dependency only and does not affect the player's 15 MB budget.
* Vite's default output must stay small; verified in `npm run build` output.

## Testing
* Vitest: one test of a tiny `appTitle` constant module (proves the runner and TS path work; real logic tests arrive with the features).
* Playwright: page loads, title is "Rocket Pals", canvas container exists, zero console errors.
* Manual: `npm run dev` and `npm run build && npm run preview` open fine.
