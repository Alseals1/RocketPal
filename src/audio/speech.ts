/** Reads text aloud with the voice that is built into the browser. Nothing is sent anywhere. */
export interface Speaker {
  /** False on a computer or browser with no reading voice. */
  isSupported(): boolean;
  isSpeaking(): boolean;
  /** Starts reading. Anything already being read stops first. `onEnd` runs when it finishes or is stopped. */
  speak(text: string, onEnd?: () => void): void;
  stop(): void;
}

/** Voices can arrive a moment after the page opens. After this long with none, we say there is no voice. */
const VOICE_GRACE_MS = 3000;

export function createSpeaker(synth: SpeechSynthesis | undefined = typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis): Speaker {
  let speaking = false;
  let finish: (() => void) | undefined;
  /** Which reading is current. A late "I was cancelled" message from an older reading must not stop the new one. */
  let current = 0;
  const created = Date.now();

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
    isSupported: () =>
      Boolean(synth) &&
      typeof SpeechSynthesisUtterance !== 'undefined' &&
      ((synth?.getVoices().length ?? 0) > 0 || Date.now() - created < VOICE_GRACE_MS),
    isSpeaking: () => speaking,
    speak(text, onEnd) {
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
        onEnd?.();
        return;
      }
      current++;
      const mine = current;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
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
      const finished = () => {
        if (mine === current) done();
      };
      utterance.onend = finished;
      utterance.onerror = finished;
      try {
        synth.speak(utterance);
      } catch {
        done(); // it could not start: put the button back instead of leaving it stuck on "Stop"
      }
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
