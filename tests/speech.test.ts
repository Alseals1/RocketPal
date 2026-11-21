import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpeaker } from '../src/audio/speech';

/** A pretend utterance: records what it was given, and lets the test fire its events. */
class FakeUtterance {
  lang = '';
  rate = 1;
  volume = 1;
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}

function fakeSynth() {
  const spoken: FakeUtterance[] = [];
  const synth = {
    getVoices: () => [{ lang: 'en-US', localService: true }],
    speak: vi.fn((u: FakeUtterance) => {
      spoken.push(u);
      u.onstart?.();
    }),
    cancel: vi.fn(),
  };
  return { synth: synth as unknown as SpeechSynthesis, spoken };
}

beforeEach(() => vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance));
afterEach(() => vi.unstubAllGlobals());

describe('createSpeaker', () => {
  it('reads at full volume until told otherwise, then at the reading voice volume', () => {
    const { synth, spoken } = fakeSynth();
    const speaker = createSpeaker(synth);
    speaker.speak('one');
    speaker.setVolume(0.25);
    speaker.speak('two');
    speaker.setVolume(7);
    speaker.speak('three');
    speaker.setVolume(Number.NaN);
    speaker.speak('four');
    expect(spoken.map((u) => u.volume)).toEqual([1, 0.25, 1, 1]);
  });

  it('a new reading ends the old one once, so its button goes back to Listen', () => {
    const { synth, spoken } = fakeSynth();
    const speaker = createSpeaker(synth);
    const firstEnd = vi.fn();
    const secondEnd = vi.fn();
    speaker.speak('Orbit', firstEnd);
    speaker.speak('Mission', secondEnd);
    expect(firstEnd).toHaveBeenCalledTimes(1);
    expect(secondEnd).not.toHaveBeenCalled();
    expect(speaker.isSpeaking()).toBe(true);

    // The cancelled reading's late "ended" must not end the new one, nor call the old callback again.
    spoken[0].onend?.();
    expect(firstEnd).toHaveBeenCalledTimes(1);
    expect(secondEnd).not.toHaveBeenCalled();
    expect(speaker.isSpeaking()).toBe(true);

    spoken[1].onend?.();
    expect(secondEnd).toHaveBeenCalledTimes(1);
    expect(speaker.isSpeaking()).toBe(false);
  });

  it('stop ends the current reading once', () => {
    const { synth } = fakeSynth();
    const speaker = createSpeaker(synth);
    const end = vi.fn();
    speaker.speak('hello', end);
    speaker.stop();
    speaker.stop();
    expect(end).toHaveBeenCalledTimes(1);
    expect(speaker.isSpeaking()).toBe(false);
  });

  it('with no voice at all, says it is not supported and calls onEnd at once', () => {
    const speaker = createSpeaker(undefined);
    const end = vi.fn();
    expect(speaker.isSupported()).toBe(false);
    speaker.speak('hello', end);
    expect(end).toHaveBeenCalledTimes(1);
  });
});
