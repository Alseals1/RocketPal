/**
 * Sound effects and music (docs/TECHNICAL_ARCHITECTURE.md 4.15 and 5.12). Platform layer: the only file that loads
 * Howler. Howler is fetched with a dynamic `import()` on the first tap or key, so it is not in the first download,
 * and no sound can play before the browser allows it.
 *
 * Since #34 the sounds come from `sounds.json` (`Content.sounds`), and every file is preloaded once Howler is in.
 * Game code never calls `play` for feedback: `src/app/sound.ts` does, from the cue table in `src/core/cues.ts`.
 * See decisions/2026-11-12-platform-services.md and decisions/2026-11-21-sound-effects-and-listen.md.
 */
import type { AssetId, SoundId } from '../data/ids';
import type { Channel, SoundDef } from '../data/sounds';
import type { VolumeSettings } from '../core/settings';

// The types live with the content that lists the sounds; they are re-exported here, as 4.15 names them.
export type { Channel, SoundDef } from '../data/sounds';
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
type HowlConstructor = new (options: { src: string[]; volume?: number; preload?: boolean; onloaderror?: (id: unknown, error: unknown) => void }) => HowlLike;
/** What `import('howler')` gives: `Howl` at the top, or under `default` when the bundler wraps the CommonJS file. */
export type HowlerModule = { Howl?: HowlConstructor; default?: { Howl?: HowlConstructor } };

export interface AudioOptions {
  /** Loads Howler. Tests pass a fake. */
  load?: () => Promise<HowlerModule>;
  sounds?: readonly SoundDef[];
  /** From an asset id to the URL of its file. */
  url?: (file: AssetId) => string;
  volumes: VolumeSettings;
  /** Called each time a sound really starts (for the debug handle): not before unlock, not at volume 0. */
  onPlayed?: (id: SoundId) => void;
}

const loadHowler = () => import('howler') as unknown as Promise<HowlerModule>;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export function createAudioManager({ load = loadHowler, sounds = [], url = (file) => file, volumes, onPlayed }: AudioOptions): AudioManager {
  const defs = new Map(sounds.map((s) => [s.id, s]));
  const volume: Record<Channel, number> = {
    effects: clamp01(volumes.effects),
    music: clamp01(volumes.music),
    voice: clamp01(volumes.voice),
  };
  const howls = new Map<SoundId, HowlLike>();
  /** Sounds whose file could not load: they stay silent instead of asking for the file again on every play. */
  const broken = new Set<SoundId>();
  let Howl: HowlConstructor | undefined;
  let started = false;
  let warnedFile = false;

  /** One Howl per sound, made once Howler is in. Each file is fetched straight away, so the first play is not late. */
  const preload = (make: HowlConstructor) => {
    for (const def of defs.values()) {
      howls.set(
        def.id,
        new make({
          src: [url(def.file)],
          preload: true,
          onloaderror: (_id, error) => {
            broken.add(def.id);
            if (warnedFile) return;
            warnedFile = true;
            console.warn('Sound is off: a sound file could not load.', error);
          },
        }),
      );
    }
  };

  return {
    unlock() {
      if (started) return;
      started = true;
      load()
        .then((mod) => {
          const found = mod.Howl ?? mod.default?.Howl;
          if (!found) throw new Error('the sound player has no Howl');
          Howl = found;
          preload(found);
        })
        .catch((error: unknown) => console.warn('Sound is off: the sound player could not load.', error));
    },
    play(id) {
      if (!Howl) return; // not unlocked yet, still loading, or the load failed: plays made now are dropped
      const def = defs.get(id);
      const howl = howls.get(id);
      if (!def || !howl || broken.has(id)) return;
      const v = def.volume * volume[def.channel];
      if (v <= 0) return;
      howl.volume(v);
      howl.play();
      onPlayed?.(id);
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
  // One signal removes both listeners together, whichever fires first.
  const stop = new AbortController();
  const options = { capture: true, passive: true, signal: stop.signal };
  const first = () => {
    stop.abort();
    audio.unlock();
  };
  target.addEventListener('pointerdown', first, options);
  target.addEventListener('keydown', first, options);
  return () => stop.abort();
}
