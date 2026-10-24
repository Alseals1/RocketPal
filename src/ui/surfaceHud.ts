import type { Mission } from '../data/missions';
import type { QuizQuestionData } from '../data/quizzes';
import type { Hotspot, Surface } from '../data/surfaces';
import type { Speaker } from '../audio/speech';
import type { ScreenPoint } from '../scene/spaceScene';
import { keepTabInside } from './focus';
import { QuizPanel } from './quizPanel';
import { setStars } from './stars';

export interface SurfaceCallbacks {
  onBack(): void;
  /** A dot that is off the screen got keyboard focus: swing the view round to it. */
  onTurnTo(azimuth: number, elevation: number): void;
  /** The kid found enough dots to finish the mission. The game saves it and calls `setProgress`. */
  onMissionComplete(): void;
  /** The kid finished the quiz. The game saves it and returns the stars they now have on this world. */
  onQuizFinished(perfect: boolean): number;
}

/** A mission and quiz for this world (left out if their data could not be loaded: the landing still works without them). */
export interface MissionExtras {
  mission: Mission;
  questions: QuizQuestionData[];
}

/** What the kid has earned on this world so far. */
export interface WorldProgressView {
  missionDone: boolean;
  stars: number;
}

interface SpotState {
  shown: boolean;
}

/** How Orbit looks. The pictures are rendered from the Blender model and only decorate: Orbit's words are in the speech bubble. */
type OrbitMood = 'neutral' | 'happy' | 'thinking';
const ORBIT_FACES = (['neutral', 'happy', 'thinking'] as const)
  .map((mood) => `<img class="mood-${mood}" src="/images/orbit-${mood}.png" alt="" width="64" height="64" draggable="false" decoding="async">`)
  .join('');

/** The layer on top of a surface picture: glowing dots, Orbit, the fact card, and the credit for the photo. */
export class SurfaceHud {
  private readonly root: HTMLElement;
  private readonly els: Record<string, HTMLElement> = {};
  private readonly spotButtons = new Map<string, HTMLButtonElement>();
  private readonly spotState = new Map<string, SpotState>();
  private readonly found = new Set<string>();
  private openedBy: HTMLButtonElement | null = null;
  private focusReturns = false;
  private current: Hotspot | null = null;
  private listenButton!: HTMLButtonElement;
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly quizPanel?: QuizPanel;
  private missionDone = false;
  /** The mission was finished by the card that is open right now: Orbit says so when it closes. */
  private missionJustDone = false;
  private quizOpenedByKeyboard = false;

  constructor(
    parent: HTMLElement,
    private readonly surface: Surface,
    private readonly callbacks: SurfaceCallbacks,
    private readonly speaker: Speaker,
    private readonly extras?: MissionExtras,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'surface-hud';
    this.root.hidden = true;
    this.root.classList.toggle('is-window', surface.kind === 'window');
    this.root.innerHTML = `
      ${surface.kind === 'window' ? '<div class="window-frame" aria-hidden="true"></div>' : ''}
      <div class="surface-loading" data-el="loading" role="status">Landing on ${this.escape(surface.title.split(',')[0])}...</div>
      <section class="card surface-title">
        <p class="stats-title" data-el="title"></p>
        <p class="stats-line mission-line" data-el="mission" data-testid="mission" hidden></p>
        <div class="stats-row">
          <p class="stats-line" data-el="found" data-testid="found"></p>
          <p class="stats-line" data-el="starsLine" hidden>Stars: <span class="stars" data-el="stars" data-testid="stars"></span></p>
        </div>
        <p class="photo-credit" data-el="credit" data-testid="photo-credit"></p>
      </section>
      <button class="big-button back-button" data-testid="back-to-space" type="button">Back to space</button>
      <div class="orbit">
        <div class="orbit-face" data-el="face" data-mood="thinking" aria-hidden="true">${ORBIT_FACES}</div>
        <div class="orbit-talk">
          <p class="orbit-bubble" data-el="orbit" data-testid="orbit" role="status" aria-live="polite"></p>
          <button class="big-button quiz-button" type="button" data-el="quizButton" data-testid="quiz-time" hidden>Quiz time</button>
        </div>
      </div>
      <div class="spots" data-el="spots"></div>
      <div class="fact-overlay" data-el="overlay" hidden>
        <div class="card fact-card" role="dialog" aria-modal="true" aria-labelledby="fact-title" data-testid="fact-card">
          <h2 id="fact-title" data-el="fact-title"></h2>
          <p class="fact-text" data-el="fact-text"></p>
          <p class="fact-source" data-el="fact-source"></p>
          <div class="fact-actions">
            <button class="big-button" type="button" data-testid="listen" data-el="listen"></button>
            <button class="big-button secondary" type="button" data-testid="close-card" data-el="close">Got it</button>
          </div>
        </div>
      </div>`;
    parent.appendChild(this.root);
    this.root.querySelectorAll<HTMLElement>('[data-el]').forEach((el) => (this.els[el.dataset.el!] = el));

    this.els.title.textContent = surface.title;
    this.els.credit.textContent = `Photo: ${surface.credit}. ${surface.creditNote}`;
    this.listenButton = this.els.listen as HTMLButtonElement;
    this.setListenLabel(false);

    this.root.querySelector('[data-testid="back-to-space"]')!.addEventListener('click', () => this.callbacks.onBack());
    this.listenButton.addEventListener('click', () => this.toggleListening());
    this.els.close.addEventListener('click', () => this.closeCard());
    this.els.overlay.addEventListener('click', (e) => {
      if (e.target === this.els.overlay) this.closeCard();
    });
    this.onKeyDown = (e) => {
      if (this.els.overlay.hidden) return;
      if (e.code === 'Escape') this.closeCard();
      else if (e.code === 'Tab') keepTabInside(this.els.overlay, e);
    };
    window.addEventListener('keydown', this.onKeyDown);

    if (extras) {
      this.quizPanel = new QuizPanel(this.root, extras.questions, extras.mission.teaser, this.speaker, {
        onFinished: (perfect) => this.callbacks.onQuizFinished(perfect),
        onBackToSpace: () => this.callbacks.onBack(),
        onClosed: () => {
          if (this.quizOpenedByKeyboard) this.els.quizButton.focus();
          else (document.activeElement as HTMLElement | null)?.blur();
        },
      });
      this.els.quizButton.addEventListener('click', (e) => {
        this.quizOpenedByKeyboard = e.detail === 0;
        this.quizPanel!.open();
      });
      this.els.mission.hidden = false;
      this.els.starsLine.hidden = false;
      this.setProgress({ missionDone: false, stars: 0 });
    }

    for (const spot of surface.hotspots) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'spot';
      button.dataset.testid = `spot-${spot.id}`;
      button.setAttribute('aria-label', `${spot.label}: tap to learn more`);
      button.innerHTML = '<span class="spot-ring"></span><span class="spot-tick" aria-hidden="true"></span>';
      button.addEventListener('click', (e) => this.openCard(spot, button, e.detail === 0));
      button.addEventListener('focus', () => {
        // A dot you reached with the Tab key may be round the back of you: bring it into view.
        if (!this.spotState.get(spot.id)!.shown) this.callbacks.onTurnTo(spot.azimuth, spot.elevation);
      });
      this.els.spots.appendChild(button);
      this.spotButtons.set(spot.id, button);
      this.spotState.set(spot.id, { shown: false });
    }
    this.reset();
  }

  /** A fact card or the quiz is open (so the game's own keys wait). */
  get isCardOpen(): boolean {
    return !this.els.overlay.hidden || (this.quizPanel?.isOpen ?? false);
  }

  get foundCount(): number {
    return this.found.size;
  }

  /** Starts a visit from scratch (nothing found yet). */
  reset(): void {
    this.found.clear();
    this.missionJustDone = false;
    for (const [id, button] of this.spotButtons) {
      button.classList.remove('is-found');
      const spot = this.surface.hotspots.find((h) => h.id === id)!;
      button.setAttribute('aria-label', `${spot.label}: tap to learn more`);
    }
    this.updateProgress();
    this.say(this.surface.orbitHint);
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.closeCard(false);
    this.quizPanel?.close();
    this.root.hidden = true;
    this.root.classList.remove('is-loading'); // leaving mid-load must not leave the next visit's dots and bubble hidden
  }

  /** Removes this view from the page for good (used when another world's view takes over). */
  destroy(): void {
    this.hide();
    this.quizPanel?.destroy();
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  /** Shows what the kid has earned on this world: the mission, the Quiz time button and the stars. */
  setProgress({ missionDone, stars }: WorldProgressView): void {
    if (!this.extras) return;
    this.missionDone = missionDone;
    this.els.mission.textContent = missionDone ? `\u2713 ${this.extras.mission.title}` : `Mission: ${this.extras.mission.title}`;
    this.els.quizButton.hidden = !missionDone;
    setStars(this.els.stars, stars);
  }

  setLoading(loading: boolean): void {
    this.els.loading.hidden = !loading;
    this.root.classList.toggle('is-loading', loading); // the dots and Orbit's bubble wait (see the style sheet)
    // Orbit thinks while the picture loads, then is calm again (a visit starts with nothing found).
    this.setMood(loading ? 'thinking' : 'neutral');
  }

  /** Moves the dots to match where the picture is. Called every frame: only `transform` and `opacity` are written. */
  update(project: (azimuth: number, elevation: number) => ScreenPoint): void {
    for (const spot of this.surface.hotspots) {
      const button = this.spotButtons.get(spot.id)!;
      const state = this.spotState.get(spot.id)!;
      const point = project(spot.azimuth, spot.elevation);
      if (point.onScreen !== state.shown) {
        state.shown = point.onScreen;
        button.style.opacity = point.onScreen ? '1' : '0';
        button.style.pointerEvents = point.onScreen ? 'auto' : 'none';
      }
      if (point.onScreen) button.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
    }
  }

  private openCard(spot: Hotspot, button: HTMLButtonElement, byKeyboard: boolean): void {
    this.current = spot;
    this.openedBy = button;
    this.focusReturns = byKeyboard;
    this.els['fact-title'].textContent = spot.title;
    this.els['fact-text'].textContent = spot.text;
    // The facts come from NASA's website and we checked them; NASA did not review anything here.
    this.els['fact-source'].textContent = `Facts from NASA's website. Checked ${friendlyDate(spot.lastChecked)}.`;
    this.els.overlay.hidden = false;
    this.speaker.reset(); // one false alarm earlier must not hide Listen on every later card
    this.setListenLabel(false);
    this.found.add(spot.id);
    this.setMood('happy'); // a find makes Orbit happy for the rest of the visit
    if (this.extras && !this.missionDone && this.found.size >= this.extras.mission.findCount) {
      this.missionJustDone = true;
      this.callbacks.onMissionComplete();
    }
    button.classList.add('is-found');
    button.setAttribute('aria-label', `${spot.label}: found. Tap to read again`);
    this.updateProgress();
    this.listenButton.focus();
  }

  private closeCard(returnFocus = true): void {
    if (this.els.overlay.hidden) return;
    this.speaker.stop();
    this.els.overlay.hidden = true;
    this.current = null;
    const total = this.surface.hotspots.length;
    if (this.missionJustDone && this.extras) {
      this.missionJustDone = false;
      this.say(this.extras.mission.done);
    } else {
      this.say(
        this.found.size >= total
          ? 'You found everything here! Great exploring, space pal!'
          : `Nice find! ${total - this.found.size} more to discover.`,
      );
    }
    if (returnFocus && this.focusReturns) this.openedBy?.focus();
    else (document.activeElement as HTMLElement | null)?.blur();
  }

  private toggleListening(): void {
    if (!this.current) return;
    if (this.speaker.isSpeaking()) {
      this.speaker.stop();
      this.setListenLabel(false);
      return;
    }
    const spot = this.current;
    this.setListenLabel(true);
    this.speaker.speak(`${spot.title}. ${spot.text}`, () => this.setListenLabel(false));
  }

  private setListenLabel(speaking: boolean): void {
    if (!this.speaker.isSupported()) {
      this.listenButton.textContent = 'No voice on this computer';
      this.listenButton.disabled = true;
      return;
    }
    this.listenButton.disabled = false;
    this.listenButton.textContent = speaking ? 'Stop' : 'Listen';
    this.listenButton.setAttribute('aria-pressed', String(speaking));
  }

  private updateProgress(): void {
    this.els.found.textContent = `Found ${this.found.size} of ${this.surface.hotspots.length}`;
  }

  private setMood(mood: OrbitMood): void {
    this.els.face.dataset.mood = mood;
  }

  private say(text: string): void {
    this.els.orbit.textContent = text;
  }

  private escape(text: string): string {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }
}

/** "2026-10-23" becomes "October 23, 2026", which is easier to read than a computer date. */
function friendlyDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
