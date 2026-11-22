import type { Screen, ScreenId } from './screens';

/**
 * Runs the screens: one is active and gets every frame. `go` enters the next screen while the active one keeps going
 * (so space keeps drawing while a picture loads), and leaves the old one only once the new one has entered.
 *
 * - A failed `enter` leaves the new screen, keeps the old one, and rejects.
 * - A screen that is still entering when `go` is called again (Back while "Landing on Mars...") is left at once and
 *   never becomes active, even if its `enter` finishes later. A late failure of such a screen is swallowed.
 * - While paused (Mission Control is open) no screen gets frames. The active screen hears `pause()` and `resume()`, and
 *   a screen that becomes active while paused is paused at once, so it never gets a frame under Mission Control.
 */
export class ScreenManager {
  private readonly screens = new Map<ScreenId, Screen>();
  private active: Screen;
  private entering?: Screen;
  /** Counts calls to `go`. A call that is no longer the newest stops at its next step. */
  private ticket = 0;
  private isPaused = false;

  constructor(screens: Screen[], first: ScreenId) {
    for (const screen of screens) this.screens.set(screen.id, screen);
    this.active = this.screen(first);
  }

  /** The screen that gets the frames now. */
  get activeId(): ScreenId {
    return this.active.id;
  }

  /** The screen the player is on: the one entering if there is one (it counts from the start), else the active one. */
  get currentId(): ScreenId {
    return (this.entering ?? this.active).id;
  }

  /** True while the game is paused (Mission Control is open): no screen gets frames. */
  get paused(): boolean {
    return this.isPaused;
  }

  /** Pauses or resumes the active screen. Asking for what is already so does nothing. */
  setPaused(on: boolean): void {
    if (on === this.isPaused) return;
    this.isPaused = on;
    if (on) this.active.pause();
    else this.active.resume();
  }

  async go<P>(id: ScreenId, params: P): Promise<void> {
    const next = this.screen(id);
    const ticket = ++this.ticket;
    const abandoned = this.entering;
    this.entering = undefined;
    if (abandoned) {
      await abandoned.leave();
      if (ticket !== this.ticket) return; // a newer call has taken over
    }
    const prev = this.active;
    if (next === prev) {
      await prev.leave(); // going to the screen you are on starts it again
      if (ticket !== this.ticket) return;
    }

    this.entering = next;
    try {
      await next.enter(params);
    } catch (error) {
      if (ticket !== this.ticket) return; // already abandoned and left: nothing to do
      this.entering = undefined;
      await next.leave();
      throw error;
    }
    if (ticket !== this.ticket) return; // abandoned while entering: it was left already

    this.entering = undefined;
    this.active = next;
    if (this.isPaused) next.pause(); // it finished loading under Mission Control: it starts paused
    if (prev !== next) await prev.leave();
  }

  update(dt: number, now: number): void {
    if (this.isPaused) return;
    this.active.update(dt, now);
  }

  /** Every screen hears about a new size, active or not, so a screen that comes back already fits. */
  resize(width: number, height: number): void {
    for (const screen of this.screens.values()) screen.resize(width, height);
  }

  private screen(id: ScreenId): Screen {
    const screen = this.screens.get(id);
    if (!screen) throw new Error(`No screen called "${id}".`);
    return screen;
  }
}
