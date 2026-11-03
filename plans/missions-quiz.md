# Feature: missions-quiz

Branch: `feature/missions-quiz` (cut from `dev`). Phase 3, first slice: after landing, a short **mission**, then a **3-question quiz**, then **stars** that are remembered. Earth and Mars only (they are the two worlds with a landing picture); the other worlds follow with their landings.

## Goal
A kid lands on Earth or Mars, finds three glowing dots (the mission), hears Orbit say "Mission complete!", takes a friendly 3-question quiz about what they just read, and earns stars that are still there next time they open the game. Done = it works by keyboard, touch and mouse; wrong answers never stop anything; nothing is lost or taken away; nothing leaves the computer.

## Decisions made with the user
* "Yes, move to the missions and quiz feature next" (2026-10-23).
* Earlier standing rules (CLAUDE.md): wrong answers never end a mission and kids can retry; no timers, streak penalties, leaderboards, ads, purchases or data collection; progress in localStorage only; read-aloud on every card.
* **Test seams confirmed by the user (2026-10-23):** quiz logic and star rules, saving and loading progress, and checking `quizzes.json` / `missions.json` (including that each right answer is backed by its dot's words). The screens are tested in the browser only.

## Design (decided by the main agent; logged in `decisions/`)
**Mission** (one per world, in `public/data/missions.json`): "Find 3 things on Mars" / "Find 3 things at the space station". It counts the dots the kid finds on this visit (the existing "Found x of y"). When the third is found Orbit says the mission is done, a big **Quiz time** button appears, and the kid can keep exploring first. The quiz can be taken any time after the mission.

**Quiz** (one per world, in `public/data/quizzes.json`): 3 questions, 3 answers each, shown as a card like the fact card (same look, same Listen button, same focus rules). Every question is built only from facts already on that world's dots (read from NASA and dated), and says which dot it came from.
* Pick a wrong answer: it softly greys out with "Not quite, try another!" (a word and a mark, not only a colour), Orbit encourages, nothing is lost, and the other answers stay open. There is no limit on tries.
* Pick the right answer: a tick, a one-sentence "because" taken from the fact card, then Next.
* After the last question: a result card with the stars, Orbit's teaser for the next world (a friendly cliffhanger), **Play again** and **Back to space**.

**Stars** (max 3 per world, "collect", never "lose"):
* 1 star: mission complete.
* 1 star: quiz finished (every question answered right, however many tries).
* 1 bonus star: all three right on the first try. It is a bonus, not a penalty: kids who need retries still get 2 stars, and replaying the quiz can still earn the bonus. Stars never go down.
* The landing screen's title card shows the stars ("Stars: 2 of 3" with filled and empty stars); a screen reader hears the words.

**Saving** (`rocketpals.progress` in localStorage): per world three yes/no flags (mission done, quiz done, perfect quiz). Stars are worked out from the flags, so they can only go up. Anything missing or wrong falls back to "not done", field by field (same pattern as `settings.ts`). If the browser will not save (private mode, school rules), everything still works for the visit and nothing breaks. No other data is stored and nothing is sent anywhere.

**Not in this feature** (kept out on purpose): badges and the Space Journal, pilot ranks, the world picker showing stars, missions and quizzes for the other eight worlds, a "start over" button, sound, mini-games. Listed as follow-ups in `plans/00-roadmap.md`.

## Approach / files
* `src/quiz/quiz.ts` (pure): a quiz run (current question, check an answer, wrong answers recorded, finished, first-try count) and `starsFor(...)`.
* `src/core/progress.ts` (pure): defaults, load with per-field fallback, save that never throws, `recordMission`, `recordQuiz` (flags only turn on), `starsFor(world)`.
* `src/data/missions.ts`, `src/data/quizzes.ts` (+ JSON files): loaders and validators (exactly 3 questions, 3 options, exactly one correct, short reading-level limits, each question points at a real dot of that world, https sources, real dates, teaser and mission text limits).
* `src/ui/quizPanel.ts`: the quiz and result card (focus trap, Listen, Escape closes back to the landing screen, big targets, `aria-live` feedback). `src/ui/surfaceHud.ts`: mission line, Quiz-time button, stars on the title card. `src/game.ts`: loads the data, owns progress, wires callbacks. `src/style.css`: styles.
* Read-aloud works on the question and on the "because" line.

## Skills / tools
`tdd` (the seams below), `frontend-design` (quiz card, answer buttons, stars, result card), `animation-performance` (no animation beyond what exists; star pop only if reduced motion is off and it is `transform`/`opacity`), Playwright, Chrome for a real look. `grill-me` is not loadable in this session (confirmed), so gaps are listed by hand below.

## Gaps looked for (by hand)
* **A question with a wrong or arguable answer**: built only from the dated dot facts; validator ties each question to a dot; every question and answer read against the NASA wording before shipping, and the sources are in the data.
* **Reading level (ages 8-10)**: short sentences, limits enforced by the validator (question 20 words, answers 8, because 25).
* **Wrong answers feel bad**: soft wording, no sound, no red, no count of mistakes shown, no way to run out of tries.
* **Stars feeling like a penalty**: 2 of 3 stars are guaranteed by finishing; the third is a bonus; nothing is removed.
* **Guessing by elimination**: allowed on purpose (kids can always retry); the "because" line is shown on the right answer so they still read the fact.
* **Storage unavailable / corrupted**: per-field fallbacks; tested.
* **Shared school computer**: progress is per browser, so a classmate sees the same stars; there is no "start over" button yet (a follow-up, called out in the PR).
* **Leaving mid-quiz or mid-load**: Back to space closes the quiz; nothing is saved until a flag is earned; a quiz picture race (leave while loading) behaves as before.
* **Focus and keys**: the quiz card traps Tab like the fact card; game keys are blocked while it is open; Escape closes it; focus goes back to the Quiz-time button.
* **Small screens and the biggest text**: card scrolls instead of clipping; targets at least 56 px; checked at 320 x 568 and 390 x 844 with huge text.

## Risks
* The mission and quiz add real new UI on the landing screen, which already has a crowded layout on small phones (title card, Orbit, Back, gear, dots). The Quiz-time button needs a place that does not collide; checked by the existing overlap tests plus new ones.
* More text for kids to read: kept short on purpose.
* Unmeasured on a Chromebook, as always.

## Testing
* **Vitest (the three agreed seams):** (1) quiz logic and star rules: a wrong answer never ends the run, the run finishes only when every question is right, the first-try bonus is awarded only for three first-try answers, stars never go down when replaying badly; (2) saving and loading progress: defaults, per-field fallback for garbage, flags only turn on, a storage that throws, version field; (3) `quizzes.json` and `missions.json` validation: counts, one correct answer, limits, every question points at a real dot, sources and dates, and a check that every question's right answer actually appears in (or follows from) the text of the dot it names.
* **Playwright:** full flow on Mars and on Earth (find 3, mission done, quiz, a wrong answer then the right one, result card, stars saved, reload keeps them, replay keeps them), by keyboard and by touch layout, Listen on the quiz card, nothing leaves the page (no network requests beyond the game's own files), storage blocked still plays, leaving mid-quiz, huge text on small phones, no console errors, repeat runs under load.
* A real play-through in Chrome, with notes in the PR.

## What building and looking changed (added while building)
* **A real bug found by the new tests**: the shared Tab-trap (`keepTabInside`) counted *hidden* buttons (such as Next before an answer is picked) as the first and last button, so from the last visible button Tab escaped the card into the game behind it. It now only counts buttons that are on screen. This also fixes the same latent problem for any dialog with hidden buttons.
* **The title card is crowded**: the mission line and stars make it taller, and it already collapsed on a narrow screen with huge text. Fixes: "Found" and "Stars" share one row; the mission line is smaller and says only the mission title once done (a check mark replaces "Mission:"); on narrow screens (under 700 px) the title card now spans the full width under the buttons for every landing (it did for the Earth window only); on short wide screens (a phone held sideways, 520 px tall or less) the card may reach nearly to Back, the credit and Orbit's bubble are a little smaller, and the Quiz time button sits beside Orbit's words instead of under them. Earth's mission is titled "Find 3 things on the station" so it fits on one line.
* **Helpers shared**: the word, sentence and date checks the data validators use now live in `src/data/text.ts` (planets and surfaces use them too; their tests pass unchanged).
* **No "find during loading" case**: dots and Orbit's bubble are hidden while the picture loads (from the Orbit work), so nothing can be found behind the loading screen.
* **Reading the quiz with the right words**: question and answers are read together; after a right answer Listen reads the reason.
* **Layout limits that stay**: on a 667 x 375 landscape phone with the biggest text, the Earth card was already too tall for the screen (not part of this feature); 844 x 390 and 420 x 900 are tested.
* Test strength: 7 deliberate breakages of the screens are each caught (mission at two finds, bonus never recorded, progress never saved, Tab trap with hidden buttons, Quiz button over loading, no stars shown, Escape not closing); 8 for the data checks; 5 for saving; 3 for the quiz logic. A first attempt at two of them did not compile and proved nothing; they were redone.
