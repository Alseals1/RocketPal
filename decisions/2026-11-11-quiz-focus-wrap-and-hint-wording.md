# Quiz fixes: wrap focus, reword the hint, test the DOM in Playwright

Date: 2026-11-11. Decided by the Implement agent for issue #26 (the two quiz bugs from the PR #14 review), following the approved plan.

## What was decided
1. **Shift+Tab leaving the quiz:** `keepTabInside` (`src/ui/focus.ts`) now also wraps when focus is inside the dialog but not on one of its buttons (the quiz heading has `tabindex="-1"`). Shift+Tab goes to the last button, Tab to the first.
2. **Stale "Yes! That is right!":** `showQuestion()` clears `pendingFeedback`, so a line still waiting for its animation frame never lands on the next question.
3. **Hint wording:** the wrong-answer hint ends with "You can look at it after the quiz." The quiz still restarts at question 1 when closed.
4. **Listen after a wrong answer** reads the hint, then the question and answers, and stops any reading in progress (as a right answer already does).
5. **"Right answer is the longest"** is judged by characters, not words. Two Earth wrong options were lengthened to pass it: `earth-aurora` ("Fireflies flying high up in space") and `earth-air` ("Dust and smoke from big fires"). No fact, right answer or `lastChecked` changed.
6. **The two DOM bugs are tested in Playwright**, not Vitest.

## Why
- The gap was in the shared helper, so fixing it there covers any later dialog that focuses a heading. The fact card and settings panel contain only buttons, so they behave as before.
- Clearing one field is the smallest fix for the stale line.
- A reworded hint is small and clear. Remembering the quiz place would change tested behaviour (Escape restarts the quiz) and the perfect-run rule.
- Vitest runs in Node with no DOM. jsdom would be a new dependency, which needs a person's decision.

## Alternatives
- `inert` on everything behind the quiz: every close path (Not now, Escape, Keep exploring, Back to space, screen close, destroy) would have to undo it or the game stays unclickable.
- A special case in `QuizPanel`'s keydown handler: leaves the gap in the shared helper.
- Cancelling the `requestAnimationFrame` id: more state for the same result.
- Remembering the quiz place for the visit: rejected above.
- Adding jsdom or happy-dom to Vitest: a new dependency.

## Note
A future dialog with a link or an input would have Tab from it jump to the first button, because of decision 1. The doc comment on `keepTabInside` says so.
