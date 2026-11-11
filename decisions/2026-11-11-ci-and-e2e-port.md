# CI on every PR into dev, and a browser-test port per checkout

Date: 2026-11-11. Decided by the Implement agent for issue #27, following the approved plan. The product owner chose how to handle the five tests CI found failing (option A on #27).

## What was decided
1. **Port per checkout.** `e2e/port.ts` hashes the checkout folder (the folder of `playwright.config.ts`, FNV-1a) into a port from 4200 to 4999. `E2E_PORT` overrides it; any value that is not a whole number from 1024 to 65535 stops the run with an error naming the variable. The same port is used for the build server and the tests.
2. **`reuseExistingServer: false`.** A port that is already taken fails the run ("already used") instead of testing whatever is there.
3. **One CI job, `Tests and build`** (`.github/workflows/ci.yml`), on PRs into `dev` and pushes to `dev`: `npm ci`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run size-report`. npm and the Playwright browser are cached. The Playwright report is uploaded when a run fails (14 days). Actions are pinned to their latest major tags (checkout v7, setup-node v7, cache v6, upload-artifact v7). Node 24 comes from `.nvmrc`.
4. **CI-only Playwright settings:** 2 workers, 1 retry, 60 s per test, `forbidOnly`, the `github`, `list` and `html` reporters. Local runs are unchanged apart from the port.
5. **First play is measured in the browser.** `e2e/first-play-size.spec.ts` opens `/?quality=high`, adds up the uncompressed bytes of every same-origin response until nothing has been in flight for 3 s, fails at 15,000,000 bytes or more, and fails if anything is fetched from another site. `tools/size-report.ts` (plain TypeScript run by Node 24, no new dependency) writes the sizes to the job summary and always exits 0. Today: 758 kB of 15 MB.
6. **The six slow Earth-window tests run in CI.** They passed in every CI run on PR #60 and 30 of 30 times locally with CI settings.
7. **The five tests CI found failing are marked, not hidden** (`e2e/known-issues.ts`):
   - Four title-overlap layout tests: `test.fail()` on Linux. Linux and ChromeOS have no Trebuchet MS, and the wider fallback font makes the title card cover a button. Swapping the font on a Mac reproduces exactly these four failures. This is likely a real bug on Chromebooks. When the layout is fixed, the tests pass, Playwright reports "expected to fail", and the mark has to come off.
   - The Orbit second-landing test: `test.fixme()` in CI only. The cached photo loads before a slow runner sees "loading". The game is fine; the test is timing-dependent. It still runs locally.
8. **Red proof by a commit and its revert** on the PR branch. The red run: https://github.com/Alseals1/RocketPal/actions/runs/43083804944 (only the proof test failed; the report artifact was uploaded).

## Why
- Hashing the config's folder gives a stable port wherever the command is started. Turning off reuse is what makes a clash visible: with reuse on, Playwright reuses whatever answers and `--strictPort` never runs.
- What the page fetches is the real first-play cost. Summing `dist/` would count landing photos that only load on landing (about 4 MB more, growing with every photo). Playwright's `networkidle` fired before the rocket model was requested under software WebGL, so the spec waits for its own quiet window. The number is uncompressed, so it is an honest upper bound.
- `test.fail()` keeps the layout tests running and makes CI notice the fix. Skipping them would hide the bug. Fixing the layout or self-hosting a font is UI work, or a licence decision, outside this issue.

## Alternatives
- Hashing `process.cwd()`: changes when Playwright is started from a subfolder.
- `reuseExistingServer: !process.env.CI`: local runs would still silently test another checkout's build.
- A static list of first-play files: goes stale without anyone noticing.
- `size-limit` or a bundle-analyzer package: a new dependency for about 80 lines of Node.
- A throwaway branch and PR for the red run: agents cannot close PRs or delete branches.
- Skipping the five failing tests, fixing them here, or leaving CI red (options B, C and D on #27).

## Follow-ups for a person
- Require the `Tests and build` check on `dev` (repo settings).
- Add two issues: (1) the title card overlaps the buttons when Trebuchet MS is missing (Chromebook); (2) make the Orbit second-landing test independent of timing.
- Three "every dot can be found" tests (2560 x 1080, 1920 x 700, ultra-wide mouse) flaked once in CI, timing out on the 5 s wait for the look to stop turning. They passed on retry. Worth watching.
- On a private repo, each run uses about 5-7 minutes of the account's Actions minutes.
