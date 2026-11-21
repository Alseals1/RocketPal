/**
 * Plays the sound cues (docs/TECHNICAL_ARCHITECTURE.md 5.12). The only code that calls `audio.play` for feedback:
 * screens emit events, `src/core/cues.ts` says which sound goes with each, and this plays it.
 *
 * Recorded events (arrived, dotFound, quizFinished) are heard through `onRecorded`, so what they earned is known: a new
 * rank, patch or star plays its sound instead of the event's own (one sound per event). A rank-up and a new patch also
 * show a toast, their visual partner until the reward screen (#46). See decisions/2026-11-21-sound-effects-and-listen.md.
 */
import { assetUrl } from '../assets/manifest';
import { CUED_EVENTS, eventCue, rewardCue } from '../core/cues';
import type { EventBus, GameEvent } from '../core/events';
import { RECORDED_EVENTS, type RewardDiff } from '../core/progression';
import type { VolumeSettings } from '../core/settings';
import type { Content } from '../data/content';
import type { SoundId } from '../data/ids';
import { createAudioManager, unlockOnFirstGesture } from '../platform/audio';
import { createToaster } from '../ui/components/toast';
import type { Speaker } from '../core/speaker';

/** The same sound twice within this many milliseconds plays once (a kid tapping boost very fast). */
export const REPEAT_GAP_MS = 150;

export interface SoundWiring {
  events: Pick<EventBus, 'on'>;
  onRecorded(fn: (e: GameEvent, diff: RewardDiff) => void): () => void;
  audio: { play(id: SoundId): void };
  toast(message: string): void;
  /** The name of a rank number, for the rank-up toast. */
  rankName(rank: number): string;
  /** Milliseconds; tests pass a fake clock. */
  now?: () => number;
}

/** "a Pilot", "an Explorer". */
const withArticle = (name: string) => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;

/** Starts playing cues. Returns a dispose that stops them all. */
export function connectSound({ events, onRecorded, audio, toast, rankName, now = () => performance.now() }: SoundWiring): () => void {
  const lastPlayed = new Map<SoundId, number>();
  let disposed = false;

  const play = (id: SoundId | undefined) => {
    if (!id || disposed) return;
    const t = now();
    const last = lastPlayed.get(id);
    if (last !== undefined && t - last < REPEAT_GAP_MS) return;
    lastPlayed.set(id, t);
    audio.play(id);
  };

  const recorded = new Set<string>(RECORDED_EVENTS);
  const stops = CUED_EVENTS.filter((type) => !recorded.has(type)).map((type) => events.on(type, (e) => play(eventCue(e))));
  stops.push(
    onRecorded((e, diff) => {
      play(rewardCue(diff) ?? eventCue(e));
      if (diff.rankUp) toast(`Rank up! You are ${withArticle(rankName(diff.rankUp.to))} now.`);
      if (diff.newPatches.length > 0) toast('You earned a new patch!');
    }),
  );

  return () => {
    disposed = true;
    stops.forEach((stop) => stop());
  };
}

export interface GameSoundOptions {
  stage: HTMLElement;
  content: Pick<Content, 'sounds' | 'progression'>;
  volumes: VolumeSettings;
  /** The reading voice: its volume follows Settings too. */
  speaker: Pick<Speaker, 'setVolume'>;
  events: EventBus;
  onRecorded: SoundWiring['onRecorded'];
  /** Keep a list of what played, for the debug handle. */
  debug: boolean;
}

export interface GameSound {
  /** What played so far (a copy; always empty unless `debug`). */
  played(): string[];
  /** Applies the Settings volumes: the effects, music and voice channels, and the reading voice. */
  setVolumes(v: VolumeSettings): void;
}

/**
 * The game's sound: an `AudioManager` for the sounds in `sounds.json` that unlocks (loads Howler and preloads every
 * file) on the first tap or key, the cues, and the toaster for their rank-up and patch toasts.
 */
export function startGameSound({ stage, content, volumes, speaker, events, onRecorded, debug }: GameSoundOptions): GameSound {
  const played: SoundId[] = [];
  const audio = createAudioManager({
    volumes,
    sounds: [...content.sounds.values()],
    url: (file) => assetUrl(file) ?? file,
    onPlayed: debug ? (id) => played.push(id) : undefined,
  });
  unlockOnFirstGesture(audio, window);
  const toaster = createToaster(stage);
  const ranks = content.progression.ranks;
  connectSound({
    events,
    onRecorded,
    audio,
    toast: (message) => toaster.push(message),
    rankName: (rank) => ranks.find((r) => r.rank === rank)?.name ?? `rank ${rank}`,
  });
  const setVolumes = (v: VolumeSettings) => {
    for (const channel of ['effects', 'music', 'voice'] as const) audio.setVolume(channel, v[channel]);
    speaker.setVolume(v.voice); // the reading voice is the browser's, not Howler's
  };
  setVolumes(volumes);
  return { played: () => [...played], setVolumes };
}
