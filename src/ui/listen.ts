/**
 * Listen: reads a text aloud from any button (docs/GAME_DESIGN.md section 15, "Listen everywhere"). One tap reads,
 * a second tap stops. Starting another Listen stops this one, and this button goes back to "Listen" (the speaker calls
 * its `onEnd`). With no reading voice on the computer, a text button says so and is disabled, and an icon button hides.
 *
 * The reward screen (#46), the Journal (#53) and the patch board (#54) use this for their Listen buttons too.
 * See decisions/2026-11-21-sound-effects-and-listen.md.
 */
import type { Speaker } from '../core/speaker';

export interface ListenOptions {
  /** For an icon button: its name for screen readers while it is not reading ("Listen to Orbit"). */
  iconLabel?: string;
}

export interface ListenBinding {
  /** Gives the voice a fresh try (after an earlier failure) and redraws the button. */
  refresh(): void;
  /** Stops listening to the button, and stops reading if this button started it. */
  dispose(): void;
}

/** The class that hides an icon Listen button when the computer has no voice (see style.css). */
export const NO_VOICE_CLASS = 'is-no-voice';

export function bindListen(button: HTMLButtonElement, speaker: Speaker, text: () => string, { iconLabel }: ListenOptions = {}): ListenBinding {
  /** True while the reading this button started is going on. */
  let mine = false;
  const hiddenLabel = button.querySelector<HTMLElement>('.rp-visually-hidden');

  const draw = () => {
    const supported = speaker.isSupported();
    if (iconLabel !== undefined) {
      button.classList.toggle(NO_VOICE_CLASS, !supported);
      const name = mine ? 'Stop reading' : iconLabel;
      if (hiddenLabel) hiddenLabel.textContent = name;
      else button.setAttribute('aria-label', name);
      button.setAttribute('aria-pressed', String(mine));
      return;
    }
    button.disabled = !supported;
    if (!supported) {
      button.textContent = 'No voice on this computer';
      button.removeAttribute('aria-pressed');
      return;
    }
    button.textContent = mine ? 'Stop' : 'Listen';
    button.setAttribute('aria-pressed', String(mine));
  };

  const onClick = () => {
    if (mine) {
      speaker.stop(); // its onEnd below puts the button back
      return;
    }
    const words = text().trim();
    if (!words) return;
    mine = true;
    draw();
    speaker.speak(words, () => {
      mine = false;
      draw();
    });
  };

  button.addEventListener('click', onClick);
  draw();
  return {
    refresh() {
      speaker.reset();
      draw();
    },
    dispose() {
      button.removeEventListener('click', onClick);
      if (mine) speaker.stop();
    },
  };
}
