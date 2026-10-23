import {
  MOTION_CHOICES,
  TEXT_SIZES,
  effectiveReducedMotion,
  textScale,
  type MotionChoice,
  type Settings,
  type TextSize,
} from '../core/settings';

const TEXT_SIZE_LABELS: Record<TextSize, string> = { normal: 'Normal', big: 'Big', huge: 'Extra big' };
const MOTION_LABELS: Record<MotionChoice, string> = { system: 'Same as my computer', on: 'On', off: 'Off' };

/** Makes the page match the settings: text size and reduced motion. Safe to call again and again. */
export function applySettingsToPage(settings: Settings, systemPrefersReduced: boolean): boolean {
  const reduced = effectiveReducedMotion(settings.reducedMotion, systemPrefersReduced);
  document.documentElement.style.setProperty('--ui-scale', String(textScale(settings.textSize)));
  document.documentElement.dataset.reducedMotion = String(reduced);
  return reduced;
}

/** The Settings button and its panel. Every change is handed to `onChange` straight away. */
/** Puts keyboard focus on the (non-button) game area. Exported for the other panels. */
export function focusGameArea(area: HTMLElement): void {
  area.tabIndex = -1;
  area.focus({ preventScroll: true });
}

export class SettingsPanel {
  private readonly panel: HTMLElement;
  private readonly button: HTMLButtonElement;
  private settings: Settings;

  constructor(
    private readonly parent: HTMLElement,
    initial: Settings,
    private readonly onChange: (settings: Settings) => void,
  ) {
    this.settings = { ...initial };

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'big-button settings-button';
    this.button.dataset.testid = 'settings-button';
    this.button.setAttribute('aria-label', 'Settings');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.innerHTML = `
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6a7.3 7.3 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.7 7.7 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.3.4.5.4h4c.2 0 .5-.2.5-.4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6L19.4 13ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"/>
      </svg>`;

    this.panel = document.createElement('div');
    this.panel.className = 'settings-overlay';
    this.panel.hidden = true;
    this.panel.innerHTML = `
      <div class="card settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title" data-testid="settings-panel">
        <h2 id="settings-title">Settings</h2>
        <div class="setting-group" role="radiogroup" aria-labelledby="text-size-label">
          <p id="text-size-label" class="setting-label">Text size</p>
          <div class="choices" data-group="textSize"></div>
        </div>
        <div class="setting-group" role="radiogroup" aria-labelledby="motion-label">
          <p id="motion-label" class="setting-label">Reduce motion</p>
          <p class="setting-help">Less spinning and shaking, for people who find it too much.</p>
          <div class="choices" data-group="reducedMotion"></div>
        </div>
        <button class="big-button" type="button" data-testid="settings-done">Done</button>
      </div>`;

    this.fill('textSize', TEXT_SIZES, TEXT_SIZE_LABELS);
    this.fill('reducedMotion', MOTION_CHOICES, MOTION_LABELS);
    this.refresh();

    parent.append(this.button, this.panel);
    this.button.addEventListener('click', (e) => {
      this.panel.hidden ? this.open() : this.close();
      if (e.detail > 0) this.button.blur();
    });
    this.panel.querySelector('[data-testid="settings-done"]')!.addEventListener('click', () => this.close());
    this.panel.addEventListener('click', (e) => {
      if (e.target === this.panel) this.close(); // tapping outside the card
    });
    window.addEventListener('keydown', (e) => {
      if (this.panel.hidden) return;
      if (e.code === 'Escape') this.close();
      else if (e.code === 'Tab') this.keepTabInside(e);
    });
  }

  /** While the panel is open, Tab and Shift+Tab go round the panel's own buttons, not the game behind it. */
  private keepTabInside(e: KeyboardEvent): void {
    const buttons = [...this.panel.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.tabIndex >= 0);
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const inside = this.panel.contains(document.activeElement);
    if (!inside || (e.shiftKey && document.activeElement === first)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private open(): void {
    this.panel.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    this.panel.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }

  /**
   * Focus is not handed back to the gear button: Space is the boost key, and Space on a focused
   * button would press it again instead of boosting. It goes to the game area instead, so the next
   * Tab starts from the top of the page.
   */
  private close(): void {
    this.panel.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    focusGameArea(this.parent);
  }

  private fill<K extends keyof Settings>(key: K, values: Settings[K][], labels: Record<string, string>): void {
    const group = this.panel.querySelector(`[data-group="${key}"]`)!;
    for (const value of values) {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'choice';
      choice.setAttribute('role', 'radio');
      choice.dataset.key = key;
      choice.dataset.value = value;
      choice.textContent = labels[value];
      choice.addEventListener('click', (e) => {
        this.select(key, value);
        if (e.detail > 0) choice.blur();
      });
      group.appendChild(choice);
    }
    // Arrow keys move through the choices and pick them, like any radio group (the arrows do not steer the rocket while you do this).
    group.addEventListener('keydown', (event) => {
      const e = event as KeyboardEvent;
      const radios = [...group.querySelectorAll<HTMLButtonElement>('.choice')];
      const at = radios.indexOf(document.activeElement as HTMLButtonElement);
      if (at < 0) return;
      const move: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      let next: number;
      if (e.code in move) next = (at + move[e.code] + radios.length) % radios.length;
      else if (e.code === 'Home') next = 0;
      else if (e.code === 'End') next = radios.length - 1;
      else return;
      e.preventDefault();
      e.stopPropagation();
      radios[next].focus();
      this.select(key, radios[next].dataset.value as Settings[K]);
    });
  }

  private select<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings = { ...this.settings, [key]: value };
    this.refresh();
    this.onChange({ ...this.settings });
  }

  private refresh(): void {
    this.panel.querySelectorAll<HTMLElement>('.choice').forEach((choice) => {
      const key = choice.dataset.key as keyof Settings;
      const selected = this.settings[key] === choice.dataset.value;
      choice.setAttribute('aria-checked', String(selected));
      choice.tabIndex = selected ? 0 : -1;
    });
  }
}
