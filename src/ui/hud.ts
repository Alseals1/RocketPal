import type { BodyLayout } from '../scene/layout';
import type { ScreenPoint } from '../scene/spaceScene';
import type { ArrivalWording } from '../data/surfaces';
import type { Speaker } from '../core/speaker';
import { createButton } from './components/button';
import { focusGameArea, keepTabInside } from './focus';
import { bindListen } from './listen';

export interface HudCallbacks {
  /** The Star Map button was pressed. */
  onStarMap(opener: HTMLButtonElement): void;
  onAutopilot(on: boolean): void;
  onFlyAgain(): void;
  /** True while Mission Control is open on top of the HUD: the landing card then leaves the keys to it. */
  isCovered?(): boolean;
}

export interface HudStats {
  title: string;
  /** The line under the pretend speed that says the rocket is pretend. Empty hides it. */
  speedNote: string;
  /** A real spacecraft to compare with. Empty hides it. */
  comparison: string;
  distance: string;
  light: string;
  speed: string;
}

const EDGE_MARGIN = 64;

/** What the stats card says while no world is picked. */
export const PICK_A_WORLD = 'Tap "Star Map" and pick a world.';

interface TagState {
  shown: boolean;
  isTarget: boolean;
}

/**
 * The HTML/CSS layer on top of the 3D view.
 *
 * `updateTags` runs every frame, so it follows two rules: it never reads layout (the screen size is
 * handed in through `setViewport`), and it only writes to the page when something actually changed.
 * Moving things around uses `transform` only.
 */
export class Hud {
  private readonly tags = new Map<string, HTMLElement>();
  private readonly tagState = new Map<string, TagState>();
  private readonly els: Record<string, HTMLElement>;
  private readonly starMapButton: HTMLButtonElement;
  private readonly landedListen: { refresh(): void };
  private targetId: string | null = null;
  private pointerShown = false;
  private lastTitle = '';
  private width = 1;
  private height = 1;

  constructor(
    private readonly root: HTMLElement,
    private readonly layouts: BodyLayout[],
    private readonly callbacks: HudCallbacks,
    private readonly speaker: Speaker,
  ) {
    const overlay = document.createElement('div');
    overlay.className = 'hud';
    overlay.innerHTML = `
      <p class="visually-hidden" role="status" aria-live="polite" data-el="announce"></p>
      <section class="card stats">
        <p class="stats-title" data-el="title">Where to, pilot?</p>
        <p class="stats-line" data-el="distance">${PICK_A_WORLD}</p>
        <p class="stats-line" data-el="light"></p>
        <p class="stats-line" data-el="speed"></p>
        <p class="stats-note" data-el="note" hidden></p>
        <p class="stats-note stats-compare" data-el="compare" hidden></p>
      </section>
      <button class="big-button autopilot-button" data-testid="autopilot-button" data-el="autopilot" type="button" hidden>Autopilot: fly me there!</button>
      <div class="pointer" data-el="pointer" hidden><span class="pointer-arrow"></span><span class="pointer-name" data-el="pointer-name"></span></div>
      <div class="tags" data-el="tags" aria-hidden="true"></div>
      <div class="landed" data-el="landed" data-testid="landed" hidden>
        <div class="card landed-card" role="dialog" aria-labelledby="landed-title">
          <h2 id="landed-title" data-el="landed-title">You landed!</h2>
          <p data-el="landed-text">Great flying! Fact cards and missions are coming soon.</p>
          <div class="landed-actions">
            <button class="big-button secondary" data-testid="landed-listen" data-el="landed-listen" type="button"></button>
            <button class="big-button" data-testid="fly-again" data-el="fly-again" type="button">Fly again</button>
          </div>
        </div>
      </div>`;
    root.appendChild(overlay);

    this.els = {};
    overlay.querySelectorAll<HTMLElement>('[data-el]').forEach((el) => (this.els[el.dataset.el!] = el));
    // The Star Map button (7.2): top right, the one main action while no world is picked. It opens the Star Map.
    this.starMapButton = createButton({ kind: 'primary', label: 'Star Map' });
    this.starMapButton.classList.add('star-map-button');
    this.starMapButton.dataset.testid = 'star-map-button';
    this.starMapButton.setAttribute('aria-haspopup', 'dialog');
    this.starMapButton.setAttribute('aria-expanded', 'false');
    overlay.querySelector('.stats')!.after(this.starMapButton);
    this.onPress(this.starMapButton, () => this.callbacks.onStarMap(this.starMapButton));
    this.onPress(this.els.autopilot, () => this.callbacks.onAutopilot(this.els.autopilot.getAttribute('aria-pressed') !== 'true'));
    this.onPress(this.els['fly-again'], () => this.callbacks.onFlyAgain());
    // Listen reads the card's title and words (#34).
    this.landedListen = bindListen(this.els['landed-listen'] as HTMLButtonElement, speaker, () =>
      `${this.els['landed-title'].textContent ?? ''} ${this.els['landed-text'].textContent ?? ''}`,
    );
    window.addEventListener('keydown', (e) => {
      // The landing card is a dialog: Tab stays on it and Escape does what "Fly again" does. Not while Mission Control is on top.
      if (!this.els.landed.hidden && !this.callbacks.isCovered?.()) {
        if (e.code === 'Escape') this.callbacks.onFlyAgain();
        else if (e.key === 'Tab') keepTabInside(this.els.landed, e);
      }
    });

    for (const layout of layouts) {
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.textContent = layout.world.name;
      this.els.tags.appendChild(tag);
      this.tags.set(layout.world.id, tag);
      this.tagState.set(layout.world.id, { shown: false, isTarget: false });
    }
  }

  /** Call whenever the screen size changes, so the frame loop never has to measure it. */
  setViewport(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /** The world you are heading to: its tag is highlighted, the pointer names it, and the autopilot button shows. */
  setPlaces(targetId: string | null): void {
    this.targetId = targetId;
    this.els.autopilot.hidden = targetId === null || !this.els.landed.hidden;
    this.els['pointer-name'].textContent = this.layouts.find((l) => l.world.id === targetId)?.world.name ?? '';
  }

  setAutopilot(on: boolean): void {
    this.els.autopilot.setAttribute('aria-pressed', String(on));
    this.els.autopilot.textContent = on ? 'Autopilot on! Tap to steer yourself' : 'Autopilot: fly me there!';
  }

  setStats(stats: HudStats): void {
    this.els.title.textContent = stats.title;
    this.els.distance.textContent = stats.distance;
    this.els.light.textContent = stats.light;
    this.els.speed.textContent = stats.speed;
    this.els.note.textContent = stats.speedNote;
    this.els.note.hidden = stats.speedNote === '';
    this.els.compare.textContent = stats.comparison;
    this.els.compare.hidden = stats.comparison === '';
    // Screen readers hear when the destination changes, not every number that ticks by.
    if (stats.title !== this.lastTitle) {
      this.lastTitle = stats.title;
      this.els.announce.textContent = stats.title;
    }
  }

  /** The Sun and the giant planets have no ground, so there the card says "flying past" instead of "landed". */
  showLanded(worldName: string, wording: ArrivalWording): void {
    const flyingPast = wording === 'flyingPast';
    this.els['landed-title'].textContent = flyingPast ? `You are flying past ${worldName}!` : `You landed on ${worldName}!`;
    this.els['landed-text'].textContent = flyingPast
      ? 'There is no solid ground to land on here. Fact cards and missions are coming soon.'
      : 'Great flying! Fact cards and missions are coming soon.';
    this.els.landed.hidden = false;
    this.starMapButton.hidden = true; // the card's own buttons are the way on
    this.landedListen.refresh(); // one false alarm earlier must not leave "No voice" on every later card
    this.els.autopilot.hidden = true;
    // With settings open on top, focus stays in settings: the card is reached once settings closes.
    if (!this.callbacks.isCovered?.()) this.els['fly-again'].focus();
  }

  /** True while the plain landing card shows. */
  get isLandedOpen(): boolean {
    return !this.els.landed.hidden;
  }

  hideLanded(): void {
    if (!this.els.landed.hidden) this.speaker.stop(); // the card may still be reading
    const hadFocus = this.els.landed.contains(document.activeElement);
    this.els.landed.hidden = true;
    this.starMapButton.hidden = false;
    // Like the other panels: focus goes to the game area, so Space boosts and the next Tab starts at the top.
    if (hadFocus) focusGameArea(this.root);
  }

  /** Moves the name tags and the off-screen pointer. Called every frame. */
  updateTags(project: (layout: BodyLayout) => ScreenPoint, distanceTo: (layout: BodyLayout) => number): void {
    let pointerPoint: ScreenPoint | null = null;

    for (const layout of this.layouts) {
      const id = layout.world.id;
      const tag = this.tags.get(id)!;
      const state = this.tagState.get(id)!;
      const point = project(layout);
      const isTarget = id === this.targetId;
      if (isTarget) pointerPoint = point;

      const shown = point.onScreen && (distanceTo(layout) < 2500 || isTarget);
      if (shown !== state.shown) {
        state.shown = shown;
        tag.style.opacity = shown ? '1' : '0';
      }
      if (isTarget !== state.isTarget) {
        state.isTarget = isTarget;
        tag.classList.toggle('is-target', isTarget);
      }
      if (shown) {
        // The Moon sits next to Earth, so its tag goes underneath instead of on top of Earth's.
        tag.style.transform =
          layout.world.kind === 'moon'
            ? `translate(${point.x}px, ${point.y + 10}px) translate(-50%, 0)`
            : `translate(${point.x}px, ${point.y - 8}px) translate(-50%, -100%)`;
      }
    }

    const wantPointer = pointerPoint !== null && !pointerPoint.onScreen && Boolean(this.els.landed.hidden);
    if (wantPointer !== this.pointerShown) {
      this.pointerShown = wantPointer;
      this.els.pointer.hidden = !wantPointer;
    }
    if (wantPointer && pointerPoint) {
      const cx = this.width / 2;
      const cy = this.height / 2;
      const dx = pointerPoint.x - cx || 0.001;
      const dy = pointerPoint.y - cy || 0.001;
      const scale = Math.min((cx - EDGE_MARGIN) / Math.abs(dx), (cy - EDGE_MARGIN) / Math.abs(dy));
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      this.els.pointer.style.transform = `translate(${cx + dx * scale}px, ${cy + dy * scale}px) translate(-50%, -50%)`;
      (this.els.pointer.firstElementChild as HTMLElement).style.transform = `rotate(${angle}deg)`;
    }
  }

  /**
   * A click handler that lets go of the button afterwards when it was a mouse or finger press
   * (not the keyboard), so the Space bar goes back to boosting instead of pressing the button again.
   */
  private onPress(button: HTMLElement, handler: () => void): void {
    button.addEventListener('click', (e) => {
      handler();
      if (e.detail > 0) button.blur();
    });
  }
}
