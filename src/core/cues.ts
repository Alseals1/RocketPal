/**
 * Sound cues (docs/TECHNICAL_ARCHITECTURE.md 5.12): which sound goes with what happened. Pure: an event, or what a
 * recorded event earned, gives a sound id or nothing. `src/app/sound.ts` plays them; game code never calls `play` for
 * feedback. See decisions/2026-11-21-sound-effects-and-listen.md.
 */
import type { SoundId } from '../data/ids';
import type { GameEvent } from './events';
import type { RewardDiff } from './progression';

/** Every sound a cue can give. Each must be in sounds.json (tests/cues.test.ts checks). */
export const SOUND_IDS = ['boost', 'capsule', 'dot-found', 'docking', 'right', 'not-quite', 'star', 'rank-up', 'patch', 'bump'] as const satisfies readonly SoundId[];
export type CueSound = (typeof SOUND_IDS)[number];

/** The sound for an event on its own, or `undefined` when it makes none. */
export function eventCue(e: GameEvent): CueSound | undefined {
  switch (e.type) {
    case 'arrived':
      return 'docking';
    case 'dotFound':
      return 'dot-found';
    case 'capsuleCollected':
      return 'capsule';
    case 'bump':
      return 'bump';
    case 'boost':
      return e.on ? 'boost' : undefined; // letting go makes no sound
    case 'answered':
      return e.correct ? 'right' : 'not-quite';
    // No sound of their own yet: what they earn (a star, a rank, a patch) plays through `rewardCue`.
    case 'quizFinished':
    case 'courseFinished':
    case 'activityFinished':
    case 'rescueDone':
    case 'itemEquipped':
      return undefined;
  }
}

/**
 * The sound for what an event earned, or `undefined` when it earned nothing that has one. The biggest reward wins:
 * a new rank, then a patch, then a star. When this gives a sound it plays instead of the event's own, so one event
 * makes one sound.
 */
export function rewardCue(d: RewardDiff): CueSound | undefined {
  if (d.rankUp) return 'rank-up';
  if (d.newPatches.length > 0) return 'patch';
  if (d.newStars.length > 0) return 'star';
  return undefined;
}

/** The event types `eventCue` can give a sound for: the sound wiring subscribes to these. */
export const CUED_EVENTS = ['arrived', 'dotFound', 'capsuleCollected', 'bump', 'boost', 'answered'] as const satisfies readonly GameEvent['type'][];
