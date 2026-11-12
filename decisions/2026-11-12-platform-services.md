# Platform services: settings store, audio manager skeleton, input manager

Date: 2026-11-12. Decided by the Plan agent for issue #41 and built by the Implement agent. Items 9 and 10 were small changes made during the build. A person can overrule any line at PR review. The code is in `src/core/settings.ts`, `src/platform/settingsStore.ts`, `src/platform/audio.ts` and `src/platform/input/`. The interfaces are in `docs/TECHNICAL_ARCHITECTURE.md` section 4.15.

## What was decided
1. **`Settings` stays in Logic, the store goes in Platform.** The type, the defaults, `loadSettings`, `saveSettings` and the new `normaliseSettings` stay in `src/core/settings.ts`. `createSettingsStore` (the 4.15 `SettingsStore`) is in `src/platform/settingsStore.ts`, which re-exports `Settings`. This is because `ui/settingsPanel.ts` reads `Settings`, and UI may not import Platform. It is the same split as `SaveData` (core) and `SaveStore` (platform).
2. **Settings record version 2.** `rocketpals.settings` now holds `{ version: 2, textSize, reducedMotion, volume, assist, boost }`.
   - A version 1 record loads with its two values and the new defaults.
   - Each field, and each volume channel, falls back on its own.
   - A bad value passed to `set` keeps the current value.
   - Only the five named fields are written.
   - An old tab left open from before this update that saves over the record drops the three new fields back to their defaults. This is accepted: it affects settings only, never progress, and nothing in the game sets them yet.
3. **Defaults:** volume `{ effects: 0.8, music: 0.5, voice: 1 }`, `assist: 'full'` (GAME_DESIGN section 13, "Full (default)") and `boost: 'hold'` (today's behaviour). The docs give no volume numbers. Voice at 1 matches today's read-aloud, and music is quieter so it never covers speech.
4. **Boost toggle is left to #56.** `boost: 'toggle'` is stored and kept but not used. #56 adds the control that sets it and the toggle behaviour. Doing it here would be dead code that no player could reach.
5. **Howler loads on the first tap or key.** `createAudioManager` takes its loader as a parameter (default `() => import('howler')`), so Vite puts Howler in its own chunk (`howler-*.js`, about 36 kB) and tests inject a fake. `unlockOnFirstGesture(audio, window)` calls `unlock()` on the first `pointerdown` or `keydown`. Plays asked for before the load finishes are dropped, not queued. A failed load logs one `console.warn` and leaves the game silent. `Howl` is read from the module or its `default`, because Howler is a CommonJS file. There are no sounds yet (#34).
6. **The action table** follows VISUAL_DESIGN "Keyboard": `boost` Space, `starMap` M, `menu` and `back` Escape (the screen picks which one it listens to), `confirm` Enter and NumpadEnter, and `listen` no key.
   - An action fires on key down only. It does not fire on a repeat, with Ctrl, Meta or Alt held, while a panel covers the game, or for Space on a focused button.
   - Dispatch never calls `preventDefault` or `stopPropagation`, so the panels' own Escape, Enter and Tab handling is untouched.
   - The BOOST button press also fires `boost`.
   - Nothing subscribes yet.
7. **`setSources` replaces `suspendTouchControls`.**
   - `setSources(['keyboard'])` hides the stick and BOOST, and `setSources(['keyboard', 'touchStick'])` shows them again if they are wanted.
   - Every call lets go of everything held, as the old suspend did.
   - `'pointerDrag'` and `'gamepad'` are accepted and ignored until #56 and Phase 2.
8. **An internal `ManagedSource`.** The 4.15 `InputSource` is unchanged. Each of the manager's own sources also has `kind`, `isSteering()`, `release()` and `setEnabled()`, which the manager needs to keep today's autopilot-cancel and suspend behaviour. `active` means "switched on by `setSources`".
9. **The manager owns the release on blur and hidden tab (build change).** The plan put this in the keyboard source, but the old code also let go of the stick and BOOST then. Putting it in the manager keeps that.
10. **`createInputManager` takes the touch elements, not a parent (build change).** `buildTouchControls(stage)` makes the same HTML as before (same classes and test ids), and the manager takes the result. The unit tests can then pass fake elements built on Node's `EventTarget`, so no DOM test library (a new dependency) is needed.
11. **`ScreenContext.controls: InputController` becomes `input: InputManager`,** the 4.11 name. `src/flight/input.ts` is deleted, and its `LAYERS` entry is removed from the architecture test.

## Why
- The 2.0 screens (Star Map, Mission Control, sounds, new controls) need these services behind small interfaces. Today's flying, settings and read-aloud must not change. The old rules (keyboard over stick on each axis, the dead zone, one finger per control, modifiers left alone, Space on a button, blocked while a panel is open, release on blur) were moved rather than rewritten. Each one has a unit test, and the existing browser tests pass unchanged.

## Alternatives
- **`Settings` and the store both in `platform/`:** the settings panel would break the layer rules.
- **Honour `boost: 'toggle'` now:** #56 owns it, and here it would be unreachable.
- **Add `happy-dom` or `jsdom` for DOM unit tests:** a new dependency, which is a gate. Injected `EventTarget`s cover the logic, and Playwright covers the DOM.
- **Keep `suspendTouchControls` as an extra method:** `setSources` says the same thing through the 4.15 interface.
- **Wrap `src/flight/input.ts` instead of moving it:** this would leave a Platform file in a Logic folder (architecture section 10: a file moves when a PR changes it).
- **Queue plays made before Howler loads:** a sound heard a second late is worse than no sound, and every sound has a visual partner.
