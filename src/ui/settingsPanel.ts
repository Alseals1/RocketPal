import {
  EFFECT_LEVELS,
  MOTION_CHOICES,
  TEXT_SIZES,
  VOICE_LEVELS,
  effectiveReducedMotion,
  nearestLevel,
  textScale,
  type MotionChoice,
  type Settings,
  type TextSize,
} from '../core/settings';
import { nextRadioIndex } from './components/radioKeys';

const TEXT_SIZE_LABELS: Record<TextSize, string> = { normal: 'Normal', big: 'Big', huge: 'Extra big' };
const MOTION_LABELS: Record<MotionChoice, string> = { system: 'Same as my computer', on: 'On', off: 'Off' };
const LEVEL_LABELS: Record<number, string> = { 0: 'Off', 0.25: 'Quiet', 0.5: 'Medium', 1: 'Loud' };
/** The volume channels this panel shows, with their levels. Music comes with Phase 2. */
const VOLUME_GROUPS = { effects: EFFECT_LEVELS, voice: VOICE_LEVELS } as const;
type VolumeGroup = keyof typeof VOLUME_GROUPS;
/**
 * The settings this panel shows, as each group's `data-group`: two settings, and two volume channels
 * (`volume.effects`, `volume.voice`). The others (music, assist, boost) pass through unchanged.
 */
type PanelKey = 'textSize' | 'reducedMotion' | `volume.${VolumeGroup}`;

/** Makes the page match the settings: text size and reduced motion. Safe to call again and again. */
export function applySettingsToPage(settings: Settings, systemPrefersReduced: boolean): boolean {
  const reduced = effectiveReducedMotion(settings.reducedMotion, systemPrefersReduced);
  document.documentElement.style.setProperty('--ui-scale', String(textScale(settings.textSize)));
  document.documentElement.dataset.reducedMotion = String(reduced);
  return reduced;
}

/**
 * The Settings tab of Mission Control: the four groups, each a radio group. Every change is handed to `onChange`
 * straight away; Done calls `onDone` (Mission Control closes).
 */
export class SettingsTab {
  readonly element: HTMLElement;
  private settings: Settings;

  constructor(
    initial: Settings,
    private readonly onChange: (settings: Settings) => void,
    onDone: () => void,
  ) {
    this.settings = { ...initial, volume: { ...initial.volume } };

    this.element = document.createElement('div');
    this.element.className = 'settings-tab';
    this.element.dataset.testid = 'settings-panel';
    this.element.innerHTML = `
      <div class="settings-tab__groups">
        <div class="setting-group" role="radiogroup" aria-labelledby="text-size-label">
          <p id="text-size-label" class="setting-label">Text size</p>
          <div class="choices" data-group="textSize"></div>
        </div>
        <div class="setting-group" role="radiogroup" aria-labelledby="motion-label">
          <p id="motion-label" class="setting-label">Reduce motion</p>
          <p class="setting-help">Less spinning and shaking, for people who find it too much.</p>
          <div class="choices" data-group="reducedMotion"></div>
        </div>
        <div class="setting-group" role="radiogroup" aria-labelledby="effects-label">
          <p id="effects-label" class="setting-label">Sound effects</p>
          <div class="choices" data-group="volume.effects"></div>
        </div>
        <div class="setting-group" role="radiogroup" aria-labelledby="voice-label">
          <p id="voice-label" class="setting-label">Reading voice</p>
          <p class="setting-help">How loud Listen reads.</p>
          <div class="choices" data-group="volume.voice"></div>
        </div>
      </div>
        <div class="settings-actions">
          <button class="big-button" type="button" data-testid="settings-done">Done</button>
        </div>`;

    this.fill('textSize', TEXT_SIZES, TEXT_SIZE_LABELS);
    this.fill('reducedMotion', MOTION_CHOICES, MOTION_LABELS);
    for (const channel of Object.keys(VOLUME_GROUPS) as VolumeGroup[]) {
      const levels = VOLUME_GROUPS[channel].map(String);
      this.fill(`volume.${channel}`, levels, LEVEL_LABELS);
    }
    this.refresh();
    this.element.querySelector('[data-testid="settings-done"]')!.addEventListener('click', onDone);
  }

  private fill(key: PanelKey, values: readonly string[], labels: Record<string, string>): void {
    const group = this.element.querySelector(`[data-group="${key}"]`)!;
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
      const next = nextRadioIndex(at, e.code, radios.length);
      if (next === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      radios[next].focus();
      this.select(key, radios[next].dataset.value!);
    });
  }

  private select(key: PanelKey, value: string): void {
    const s = this.settings;
    if (key === 'textSize') this.settings = { ...s, textSize: value as TextSize };
    else if (key === 'reducedMotion') this.settings = { ...s, reducedMotion: value as MotionChoice };
    else this.settings = { ...s, volume: { ...s.volume, [key.slice('volume.'.length)]: Number(value) } };
    this.refresh();
    this.onChange({ ...this.settings, volume: { ...this.settings.volume } });
  }

  /** The value a group shows as picked. A stored volume that is not one of the levels shows the nearest one. */
  private shown(key: PanelKey): string {
    if (key === 'textSize' || key === 'reducedMotion') return this.settings[key];
    const channel = key.slice('volume.'.length) as VolumeGroup;
    return String(nearestLevel(VOLUME_GROUPS[channel], this.settings.volume[channel]));
  }

  private refresh(): void {
    this.element.querySelectorAll<HTMLElement>('.choice').forEach((choice) => {
      const key = choice.dataset.key as PanelKey;
      const selected = this.shown(key) === choice.dataset.value;
      choice.setAttribute('aria-checked', String(selected));
      choice.tabIndex = selected ? 0 : -1;
    });
  }
}
