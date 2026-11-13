# CI runs when a pull request is re-targeted to dev

Date: 2026-11-13. Approved by the product owner (CI settings are theirs to approve).

## What was decided

`.github/workflows/ci.yml` runs on `pull_request` types `opened, synchronize, reopened, edited, ready_for_review` (the default three, plus `edited` and `ready_for_review`).

## Why

- G.O.A.T.'s autopilot merges stacked pull requests one part at a time and re-targets each upper part to `dev` once the part below is merged. A base change is an `edited` event, which the default types leave out, so those parts reached `dev` with no pull-request CI run (#39: PRs #75, #76, #77).
- The autopilot now waits for a pull request's checks before it merges, and holds it for a person after 30 minutes with none. Without `edited`, every re-targeted part would be held.
- `ready_for_review` tests a draft again when it is marked ready.

## Alternatives

- Close and reopen each re-targeted pull request to start CI: works without a workflow change, but noisy and surprising on GitHub.
- Merge stacks without per-part CI and rely on the `push` run on `dev`: a broken part would land on `dev` before anyone knew.

## Cost

`edited` also fires when a title or description changes. Such a run is a normal CI run; `cancel-in-progress` stops the older run of the same pull request.
