/** Reads text aloud with the voice that is built into the browser. Nothing is sent anywhere. */
export interface Speaker {
  /** False on a computer or browser with no reading voice. */
  isSupported(): boolean;
  isSpeaking(): boolean;
  /** Starts reading. Anything already being read stops first. `onEnd` runs when it finishes or is stopped. */
  speak(text: string, onEnd?: () => void): void;
  stop(): void;
  /** Forgets an earlier failure to start, so the next reading gets a fresh try. */
  reset(): void;
}

/** If reading has not begun this long after we asked, the computer has no working voice. */
const START_TIMEOUT_MS = 2500;

export function createSpeaker(synth: SpeechSynthesis | undefined = typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis): Speaker {
  let speaking = false;
  let finish: (() => void) | undefined;
  /** Which reading is current. A late "I was cancelled" message from an older reading must not stop the new one. */
  let current = 0;
  /** Set once a reading failed to start: this computer cannot read aloud, so stop offering. */
  let broken = false;

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
    stop() {
      if (!synth) return;
      const wasSpeaking = speaking;
      current++; // whatever was being read is over, whatever its late messages say
      synth.cancel();
      if (wasSpeaking) done();
    },
  };
}
