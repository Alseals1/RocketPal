/** Reads text aloud with the voice that is built into the browser. Nothing is sent anywhere. */
import type { Speaker } from '../core/speaker';

export type { Speaker } from '../core/speaker';

/** If reading has not begun this long after we asked, the computer has no working voice. */
const START_TIMEOUT_MS = 2500;

export function createSpeaker(synth: SpeechSynthesis | undefined = typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis): Speaker {
  let speaking = false;
  let finish: (() => void) | undefined;
  /** Which reading is current. A late "I was cancelled" message from an older reading must not stop the new one. */
  let current = 0;
  /** Set once a reading failed to start: this computer cannot read aloud, so stop offering. */
  let broken = false;
  let volume = 1;

  /** A clear English voice if there is one; otherwise the browser's default. */
  const pickVoice = (): SpeechSynthesisVoice | undefined => {
    const voices = synth?.getVoices() ?? [];
    return voices.find((v) => v.lang.toLowerCase().startsWith('en') && v.localService) ?? voices.find((v) => v.lang.toLowerCase().startsWith('en'));
  };

  const done = () => {
    speaking = false;
    const callback = finish;
    finish = undefined;
    callback?.();
  };

  return {
    isSupported: () => Boolean(synth) && typeof SpeechSynthesisUtterance !== 'undefined' && !broken,
    isSpeaking: () => speaking,
    speak(text, onEnd) {
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
        onEnd?.();
        return;
      }
      // Whatever was being read stops, and its button is told so (two Listen buttons never both show "Stop").
      if (speaking) done();
      current++;
      const mine = current;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.volume = volume;
      utterance.rate = 0.95; // a little slower than normal, for young readers
      const voice = pickVoice();
      if (voice) {
        try {
          utterance.voice = voice;
        } catch {
          // The browser would not take that voice: the default one is fine.
        }
      }
      speaking = true;
      finish = onEnd;
      let started = false;
      utterance.onstart = () => {
        if (mine === current) started = true;
      };
      const finished = () => {
        if (mine === current) done();
      };
      utterance.onend = finished;
      utterance.onerror = finished;
      // Some computers list no voices and never speak. Rather than guess from the voice list, watch whether it really starts.
      setTimeout(() => {
        if (mine === current && speaking && !started) {
          broken = true;
          synth.cancel();
          done();
        }
      }, START_TIMEOUT_MS);
      try {
        synth.speak(utterance);
      } catch {
        done(); // it could not start: put the button back instead of leaving it stuck on "Stop"
      }
    },
    reset() {
      broken = false;
    },
    setVolume(v) {
      volume = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
    },
    stop() {
      if (!synth) return;
      const wasSpeaking = speaking;
      current++; // whatever was being read is over, whatever its late messages say
      synth.cancel();
      if (wasSpeaking) done();
    },
  };
}
