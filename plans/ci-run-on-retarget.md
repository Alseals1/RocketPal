# Plan: CI runs on re-targeted pull requests

- **Goal:** a stacked pull request re-targeted to `dev` gets a CI run, so G.O.A.T.'s autopilot can wait for it before merging.
- **Approach:** add `types: [opened, synchronize, reopened, edited, ready_for_review]` to the `pull_request` trigger in `.github/workflows/ci.yml`.
- **Files:** `.github/workflows/ci.yml`, `README.md` (Continuous integration), `docs/PROGRESS.md`, `decisions/2026-11-13-ci-on-retarget.md`.
- **Risks:** extra runs when a pull request's title or description is edited; `cancel-in-progress` keeps that cheap.
- **Testing:** the workflow file is checked by GitHub when this pull request opens (its own CI run must start and pass). After merge: the next stack part that is re-targeted to `dev` shows a "Tests and build" check.
- **Skills and tools:** none needed beyond the GitHub CLI.
