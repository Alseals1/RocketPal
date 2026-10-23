# Panels do not hand focus back to their button, and they stop the game keys

**Decided by:** the main agent, after a reviewer finding and a real-browser check.

## What
When the settings panel, the destination picker or a fact card closes, keyboard focus goes to the game area, not back to the button that opened it (a fact card opened by keyboard does return to its glowing dot, because Space is not "boost" while standing on a world). While the settings panel or a fact card is open, the game ignores steering, boost and look keys.

## Why
Space is the boost key. A focused button "presses" on Space, so returning focus to the gear or "Where to?" made Space reopen the panel instead of boosting. Panels are modal for keyboard users: Tab stays inside, Escape closes.

## Alternatives
- Return focus to the opener (the usual accessibility advice). Rejected for the flight screens because of the Space conflict; kept where there is no conflict.
- Pause the game while a panel is open. Not done yet: it belongs with the later menu work.

## Checked
Browser tests cover every way of closing; one behaviour (the first Tab after closing lands on the top of the page) was also confirmed by hand in real Chrome.
