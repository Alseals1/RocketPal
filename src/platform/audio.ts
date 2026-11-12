/**
 * Sound effects and music (docs/TECHNICAL_ARCHITECTURE.md 4.15 and 5.12). Platform layer: the only file that loads
 * Howler. Howler is fetched with a dynamic `import()` on the first tap or key, so it is not in the first download,
 * and no sound can play before the browser allows it.
 *
 * This is the skeleton: there are no sound files yet (#34 adds them, with `sounds.json` and the cue table).
 * See decisions/2026-11-12-platform-services.md.
 */
import type { AssetId, SoundId } from '../data/ids';
import type { VolumeSettings } from '../core/settings';

export type Channel = 'effects' | 'music' | 'voice';
export interface SoundDef {
  id: SoundId;
  file: AssetId;
  channel: Channel;
  volume: number;
  caption: string;
}
export interface AudioManager {
  /** Silently does nothing before the first tap, or when muted. */
  play(id: SoundId): void;
  /** Phase 2. */
  music(id: SoundId | null): void;
  setVolume(channel: Channel, v: number): void;
  /** Called on the first tap or key. */
  unlock(): void;
}

/** The parts of a Howl we use. */
interface HowlLike {
  volume(v: number): unknown;
  play(): unknown;
}
type HowlConstructor = new (options: { src: string[]; volume?: number; preload?: boolean }) => HowlLike;
/** What `import('howler')` gives: `Howl` at the top, or under `default` when the bundler wraps the CommonJS file. */
export type HowlerModule = { Howl?: HowlConstructor; default?: { Howl?: HowlConstructor } };

export interface AudioOptions {
  /** Loads Howler. Tests pass a fake. */
  load?: () => Promise<HowlerModule>;
  sounds?: readonly SoundDef[];
  /** From an asset id to the URL of its file. */
  url?: (file: AssetId) => string;
  volumes: VolumeSettings;
}

const loadHowler = () => import('howler') as unknown as Promise<HowlerModule>;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export function createAudioManager({ load = loadHowler, sounds = [], url = (file) => file, volumes }: AudioOptions): AudioManager {
  const defs = new Map(sounds.map((s) => [s.id, s]));
  const volume: Record<Channel, number> = {
    effects: clamp01(volumes.effects),
    music: clamp01(volumes.music),
    voice: clamp01(volumes.voice),
  };
  const howls = new Map<SoundId, HowlLike>();
  let Howl: HowlConstructor | undefined;
  let started = false;

  return {
    unlock() {
      if (started) return;
      started = true;
      load()
        .then((mod) => {
          const found = mod.Howl ?? mod.default?.Howl;
          if (!found) throw new Error('the sound player has no Howl');
          Howl = found;
        })
        .catch((error: unknown) => console.warn('Sound is off: the sound player could not load.', error));
    },
    play(id) {
      if (!Howl) return; // not unlocked yet, still loading, or the load failed: plays made now are dropped
      const def = defs.get(id);
      if (!def) return;
      const v = def.volume * volume[def.channel];
      if (v <= 0) return;
      let howl = howls.get(id);
      if (!howl) {
        howl = new Howl({ src: [url(def.file)] });
        howls.set(id, howl);
      }
      howl.volume(v);
      howl.play();
    },
    music() {
      // Phase 2: music. The id is accepted so callers can be written now.
    },
    setVolume(channel, v) {
      volume[channel] = clamp01(v);
    },
  };
}

/** Calls `unlock()` on the first tap or key anywhere on `target`, then stops listening. Returns a cancel. */
export function unlockOnFirstGesture(audio: Pick<AudioManager, 'unlock'>, target: EventTarget): () => void {
  const options = { capture: true, passive: true } as const;
  const stop = () => {
    target.removeEventListener('pointerdown', first, options);
    target.removeEventListener('keydown', first, options);
  };
  function first() {
    stop();
    audio.unlock();
  }
  target.addEventListener('pointerdown', first, options);
  target.addEventListener('keydown', first, options);
  return stop;
}
