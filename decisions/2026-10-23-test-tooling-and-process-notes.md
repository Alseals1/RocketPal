# Test tooling and process notes (for review)

**Decided by:** the main agent. The first item may count as "installing software", so it is listed here for the user to review.

## `@types/node` added as a dev dependency
Types only (nothing is shipped to players). Needed so a unit test can check that the picture files named in `surfaces.json` exist on disk. Alternative: do that check in the browser test instead. `npx playwright install chromium` was also run earlier in the session to get a test browser; it is a dev tool and not part of the game.

## A debug-only "dock here now" shortcut
With `?debug=1` the page offers `window.rocketPals.dockAt(id)`, which docks at a world immediately through the normal landing code. It lets most browser tests skip a 15 second flight; one test still flies there on autopilot. It reads or saves nothing and is only reachable with `?debug=1`.

## Every new test is checked by breaking the code
For each fix, the code was broken on purpose to make sure a test fails. Several first attempts did not compile (an unused variable) and proved nothing; they were redone. One test was found to pass for the wrong reason (it measured an element with no transition) and was rewritten.

## PR #6 was squash-merged
A stray commit of the user's `KICKOFF_PROMPT.md` appeared on that branch during a review round (author: the same git identity; cause unknown). Branches cannot be force-pushed, so a squash merge kept it out of `dev`'s history. The file was untracked and left on disk.

## `KICKOFF_PROMPT.md` went missing and was restored
During the review of PR #7 the user's untracked `KICKOFF_PROMPT.md` disappeared from the project folder. Neither the main agent nor the reviewer ran anything that deletes it; the cause is unknown. It was restored byte for byte (7,278 bytes) from git history (commit `b6ba55f`), with its original timestamp. Nothing was deleted by anyone on purpose. From now on, commits stage files by name instead of `git add -A`, so the user's unfinished files (`CLAUDE.md`, `.claude/agents/`, `decisions/README.md`) can never be swept into a PR by accident.
