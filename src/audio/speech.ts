/** Reads text aloud with the voice that is built into the browser. Nothing is sent anywhere. */
export interface Speaker {
  /** False on a computer or browser with no reading voice. */
  isSupported(): boolean;
  isSpeaking(): boolean;
  /** Starts reading. Anything already being read stops first. `onEnd` runs when it finishes or is stopped. */
  speak(text: string, onEnd?: () => void): void;
  stop(): void;
}

export function createSpeaker(synth: SpeechSynthesis | undefined = typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis): Speaker {
  let speaking = false;
  let finish: (() => void) | undefined;

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
    isSupported: () => Boolean(synth) && typeof SpeechSynthesisUtterance !== 'undefined',
    isSpeaking: () => speaking,
    speak(text, onEnd) {
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
        onEnd?.();
        return;
      }
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.95; // a little slower than normal, for young readers
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      speaking = true;
      finish = onEnd;
      utterance.onend = done;
      utterance.onerror = done;
      synth.speak(utterance);
    },
    stop() {
      if (!synth) return;
      const wasSpeaking = speaking;
      synth.cancel();
      if (wasSpeaking) done();
    },
  };
}
