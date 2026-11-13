import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioManager, unlockOnFirstGesture, type AudioManager, type HowlerModule, type SoundDef } from '../src/platform/audio';

const SOUNDS: SoundDef[] = [
  { id: 'dot-found', file: 'sound/dot', channel: 'effects', volume: 0.5, caption: 'Ding!' },
  { id: 'theme', file: 'sound/theme', channel: 'music', volume: 1, caption: 'Music' },
];

/** A pretend Howler that records every sound made and played. */
function fakeHowler() {
  const made: { src: string[]; volume: number }[] = [];
  const played: { src: string; volume: number }[] = [];
  class FakeHowl {
    private vol: number;
    constructor(private readonly options: { src: string[]; volume?: number }) {
      this.vol = options.volume ?? 1;
      made.push({ src: options.src, volume: this.vol });
    }
    volume(v: number) {
      this.vol = v;
      return this;
    }
    play() {
      played.push({ src: this.options.src[0], volume: this.vol });
      return 1;
    }
  }
  const mod = { Howl: FakeHowl } as unknown as HowlerModule;
  const load = vi.fn(() => Promise.resolve(mod));
  return { made, played, load };
}

const volumes = { effects: 0.8, music: 0.5, voice: 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));

function unlocked(): Promise<{ audio: AudioManager; fake: ReturnType<typeof fakeHowler> }> {
  const fake = fakeHowler();
  const audio = createAudioManager({ load: fake.load, sounds: SOUNDS, url: (id) => `/${id}.mp3`, volumes });
  audio.unlock();
  return settle().then(() => ({ audio, fake }));
}

afterEach(() => vi.restoreAllMocks());

describe('createAudioManager', () => {
  it('loads nothing before unlock()', () => {
    const fake = fakeHowler();
    createAudioManager({ load: fake.load, sounds: SOUNDS, volumes });
    expect(fake.load).not.toHaveBeenCalled();
  });

  it('plays nothing before unlock(), and does not play it later', async () => {
    const fake = fakeHowler();
    const audio = createAudioManager({ load: fake.load, sounds: SOUNDS, volumes });
    audio.play('dot-found');
    expect(fake.made).toEqual([]);
    audio.unlock();
    await settle();
    expect(fake.played).toEqual([]);
  });

  it('drops a play asked for while Howler is still loading', async () => {
    const fake = fakeHowler();
    const audio = createAudioManager({ load: fake.load, sounds: SOUNDS, volumes });
    audio.unlock();
    audio.play('dot-found'); // the load has not finished yet
    await settle();
    expect(fake.played).toEqual([]);
  });

  it('loads once, however often unlock() is called', async () => {
    const fake = fakeHowler();
    const audio = createAudioManager({ load: fake.load, sounds: SOUNDS, volumes });
    audio.unlock();
    audio.unlock();
    await settle();
    audio.unlock();
    expect(fake.load).toHaveBeenCalledTimes(1);
  });

  it('plays a sound at its own volume times its channel volume', async () => {
    const { audio, fake } = await unlocked();
    audio.play('dot-found');
    expect(fake.played).toEqual([{ src: '/sound/dot.mp3', volume: 0.5 * 0.8 }]);
  });

  it('makes one Howl per sound and reuses it', async () => {
    const { audio, fake } = await unlocked();
    audio.play('dot-found');
    audio.play('dot-found');
    expect(fake.made).toHaveLength(1);
    expect(fake.played).toHaveLength(2);
  });

  it('uses the new channel volume after setVolume', async () => {
    const { audio, fake } = await unlocked();
    audio.play('dot-found');
    audio.setVolume('effects', 0.5);
    audio.play('dot-found');
    expect(fake.played.map((p) => p.volume)).toEqual([0.4, 0.25]);
  });

  it('plays nothing on a channel at volume 0, or for an unknown sound', async () => {
    const { audio, fake } = await unlocked();
    audio.setVolume('effects', 0);
    audio.play('dot-found');
    audio.play('no-such-sound');
    expect(fake.played).toEqual([]);
    expect(fake.made).toEqual([]);
  });

  it('keeps volumes between 0 and 1', async () => {
    const { audio, fake } = await unlocked();
    audio.setVolume('effects', 7);
    audio.play('dot-found');
    audio.setVolume('effects', -2);
    audio.play('dot-found');
    audio.setVolume('effects', NaN);
    audio.play('dot-found');
    expect(fake.played.map((p) => p.volume)).toEqual([0.5]);
  });

  it('stays silent, warns once and never throws when Howler cannot load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const load = vi.fn(() => Promise.reject(new Error('offline')));
    const audio = createAudioManager({ load, sounds: SOUNDS, volumes });
    audio.unlock();
    await settle();
    audio.unlock();
    await settle();
    expect(() => audio.play('dot-found')).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('Sound is off');
  });

  it('reads Howl from the default export too (CommonJS)', async () => {
    const fake = fakeHowler();
    const wrapped = () => fake.load().then((mod) => ({ default: mod }) as unknown as HowlerModule);
    const audio = createAudioManager({ load: wrapped, sounds: SOUNDS, volumes });
    audio.unlock();
    await settle();
    audio.play('theme');
    expect(fake.played).toEqual([{ src: 'sound/theme', volume: 0.5 }]);
  });

  it('accepts music() and does nothing with it yet', async () => {
    const { audio, fake } = await unlocked();
    expect(() => {
      audio.music('theme');
      audio.music(null);
    }).not.toThrow();
    expect(fake.played).toEqual([]);
  });
});

describe('unlockOnFirstGesture', () => {
  it('unlocks on the first key, once, and stops listening', () => {
    const target = new EventTarget();
    const unlock = vi.fn();
    unlockOnFirstGesture({ unlock }, target);
    target.dispatchEvent(new Event('keydown'));
    target.dispatchEvent(new Event('keydown'));
    target.dispatchEvent(new Event('pointerdown'));
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('unlocks on the first tap', () => {
    const target = new EventTarget();
    const unlock = vi.fn();
    unlockOnFirstGesture({ unlock }, target);
    target.dispatchEvent(new Event('pointerdown'));
    target.dispatchEvent(new Event('keydown'));
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled before any gesture', () => {
    const target = new EventTarget();
    const unlock = vi.fn();
    const cancel = unlockOnFirstGesture({ unlock }, target);
    cancel();
    target.dispatchEvent(new Event('keydown'));
    expect(unlock).not.toHaveBeenCalled();
  });
});
