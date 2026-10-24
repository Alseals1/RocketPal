# Missions and quiz: how stars, saving and wrong answers work

**Decided by:** the main agent (routine product decisions inside the rules in `CLAUDE.md`). The user chose to build missions and quiz next and confirmed the three test seams.

## What
* **Mission:** find 3 dots on the world (Mars, Earth). It is counted per visit, then remembered as done.
* **Quiz:** 3 questions, 3 answers each, built only from facts already on that world's dots. A wrong answer greys that answer out (dashed border, a cross and the words "not quite", not only a colour) and nothing else happens; tries are unlimited. A right answer shows a one-line reason from the fact card.
* **Stars (max 3 per world):** 1 for the mission, 1 for finishing the quiz, 1 bonus for a perfect quiz (three right on the first try). Stars only go up. Replaying badly never takes anything away; a perfect replay still earns the bonus.
* **Saving:** `rocketpals.progress` in localStorage: per world, three yes/no flags (`missionDone`, `quizDone`, `perfectQuiz`) and a version number. Nothing else is stored, nothing is sent. Unknown keys are dropped; odd world names (like `__proto__`) are ignored; if the browser will not store, everything still works for that visit.
* **Dots found** are not saved (a visit starts fresh); the Space Journal feature will decide whether to remember them.

## Why
* 2 of 3 stars come from finishing, so a kid who needs retries is never short-changed; the third is a bonus, not a penalty. This follows the rule "wrong answers never end a mission; healthy engagement only (collection, rewards)". No timers, streaks, leaderboards or counts of mistakes.
* Flags instead of a star count means stars cannot decrease by construction, which is easier to test and to trust than "max(old, new)" arithmetic.
* A word and a mark on wrong answers keeps feedback readable for colour-blind kids.
* Facts for the questions come from the dots (already read from NASA and dated); the data check proves each right answer is backed by a phrase that is word for word in its dot, and that no wrong option repeats it.

## Alternatives
* Stars per correct answer (0 to 3): rejected, it makes mistakes feel like losses.
* Locking the next world until the quiz is passed: rejected, wrong answers must never block anything.
* Timed or limited tries: forbidden by the product rules.
* Saving found dots now: rejected for scope; belongs with the Space Journal.

## Not decided here (left for the user or later features)
* A "start over" button for a shared school computer (progress is per browser, so a classmate sees the same stars). Deleting a child's progress is a data decision, so it is raised in the PR, not built.
* Badges, journal entries, ranks, stars shown in the world picker, missions for the other eight worlds.

## Cost
Two small JSON files, five small modules, one card. No new downloads beyond a few KB of text.
