import type { BodyLayout } from '../scene/layout';
import type { ScreenPoint } from '../scene/spaceScene';

export interface HudCallbacks {
  onSelect(worldId: string): void;
  onAutopilot(on: boolean): void;
  onFlyAgain(): void;
}

export interface HudStats {
  title: string;
  /** Shows the "real rockets are slower" note under the pretend speed. */
  showNote: boolean;
  distance: string;
  light: string;
  speed: string;
}

const EDGE_MARGIN = 64;

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
  private readonly pickerButtons = new Map<string, HTMLButtonElement>();
  private readonly els: Record<string, HTMLElement>;
  private readonly whereButton: HTMLButtonElement;
  private targetId: string | null = null;
  private pointerShown = false;
  private lastTitle = '';
  private width = 1;
  private height = 1;

  constructor(
    root: HTMLElement,
    private readonly layouts: BodyLayout[],
    private readonly callbacks: HudCallbacks,
  ) {
    const overlay = document.createElement('div');
    overlay.className = 'hud';
    overlay.innerHTML = `
      <p class="visually-hidden" role="status" aria-live="polite" data-el="announce"></p>
      <section class="card stats">
        <p class="stats-title" data-el="title">Where to, pilot?</p>
        <p class="stats-line" data-el="distance">Tap "Where to?" and pick a world.</p>
        <p class="stats-line" data-el="light"></p>
        <p class="stats-line" data-el="speed"></p>
        <p class="stats-note" data-el="note" hidden>Real rockets are much slower!</p>
      </section>
      <button class="big-button where-button" data-testid="where-button" type="button" aria-expanded="false">Where to?</button>
      <div class="card picker" data-el="picker" hidden>
        <p class="picker-title">Pick a place to fly to</p>
        <div class="picker-grid" data-el="grid"></div>
      </div>
      <button class="big-button autopilot-button" data-testid="autopilot-button" data-el="autopilot" type="button" hidden>Autopilot: fly me there!</button>
      <div class="pointer" data-el="pointer" hidden><span class="pointer-arrow"></span><span class="pointer-name" data-el="pointer-name"></span></div>
      <div class="tags" data-el="tags" aria-hidden="true"></div>
      <div class="landed" data-el="landed" data-testid="landed" hidden>
        <div class="card landed-card" role="dialog" aria-labelledby="landed-title">
          <h2 id="landed-title" data-el="landed-title">You landed!</h2>
          <p>Great flying! Fact cards and missions are coming soon.</p>
          <button class="big-button" data-testid="fly-again" data-el="fly-again" type="button">Fly again</button>
        </div>
      </div>`;
    root.appendChild(overlay);

    this.els = {};
    overlay.querySelectorAll<HTMLElement>('[data-el]').forEach((el) => (this.els[el.dataset.el!] = el));
    this.whereButton = overlay.querySelector<HTMLButtonElement>('.where-button')!;

    this.onPress(this.whereButton, () => this.togglePicker());
    this.onPress(this.els.autopilot, () => this.callbacks.onAutopilot(this.els.autopilot.getAttribute('aria-pressed') !== 'true'));
    this.onPress(this.els['fly-again'], () => this.callbacks.onFlyAgain());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && !this.els.picker.hidden) this.closePicker();
    });

    for (const layout of layouts) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'world-button';
      button.dataset.world = layout.world.id;
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = layout.world.color;
      const name = document.createElement('span');
      name.className = 'world-name';
      name.textContent = layout.world.name;
      const here = document.createElement('small');
      here.textContent = "you're here";
      name.appendChild(here);
      button.append(dot, name);
      this.onPress(button, () => {
        this.closePicker(false);
        this.callbacks.onSelect(layout.world.id);
      });
      this.els.grid.appendChild(button);
      this.pickerButtons.set(layout.world.id, button);

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

  /** Marks the world you are at (it cannot be picked) and the one you are heading to. */
  setPlaces(currentId: string | null, targetId: string | null): void {
    this.targetId = targetId;
    for (const [id, button] of this.pickerButtons) {
      button.disabled = id === currentId;
      button.classList.toggle('is-here', id === currentId);
      button.classList.toggle('is-target', id === targetId);
    }
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
    this.els.note.hidden = !stats.showNote;
    // Screen readers hear when the destination changes, not every number that ticks by.
    if (stats.title !== this.lastTitle) {
      this.lastTitle = stats.title;
      this.els.announce.textContent = stats.title;
    }
  }

  showLanded(worldName: string): void {
    this.els['landed-title'].textContent = `You landed on ${worldName}!`;
    this.els.landed.hidden = false;
    this.els.autopilot.hidden = true;
    this.els['fly-again'].focus();
  }

  hideLanded(): void {
    this.els.landed.hidden = true;
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

  private togglePicker(): void {
    if (this.els.picker.hidden) {
      this.els.picker.hidden = false;
      this.whereButton.setAttribute('aria-expanded', 'true');
      this.els.grid.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    } else {
      this.closePicker();
    }
  }

  private closePicker(returnFocus = true): void {
    this.els.picker.hidden = true;
    this.whereButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) this.whereButton.focus();
  }
}
