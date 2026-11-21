/**
 * Wires progression into the game (docs/TECHNICAL_ARCHITECTURE.md 5.2 and 7): screens emit events on the bus, the
 * recorder writes them into the save, and `progression()` works the view out once per save revision.
 * The recorder subscribes before anything else, so when `emit` returns the save is already up to date
 * (decisions/2026-11-12-events-conditions-progression.md, D9).
 */
import { createEventBus, type EventBus, type GameEvent } from '../core/events';
import { RECORDED_EVENTS, createProgressionMemo, diffProgression, record, type ProgressionView, type RewardDiff } from '../core/progression';
import type { Content } from '../data/content';
import type { SaveStore } from '../platform/saveStore';

export interface ProgressionWiring {
  events: EventBus;
  progression: () => ProgressionView;
  /**
   * Calls `fn` after each recorded event is written, with what it earned (an empty diff when nothing changed).
   * Listeners run in the recorder's handler, so they come before any later subscriber of the bus. Returns an unsubscribe.
   */
  onRecorded(fn: (e: GameEvent, diff: RewardDiff) => void): () => void;
  /** Stops recording. */
  dispose(): void;
}

export function connectProgression(save: SaveStore, content: Content): ProgressionWiring {
  const events = createEventBus();
  const memo = createProgressionMemo(content);
  const progression = () => memo(save.read(), save.revision);
  let listeners: ((e: GameEvent, diff: RewardDiff) => void)[] = [];
  const stops = RECORDED_EVENTS.map((type) =>
    events.on(type, (e) => {
      const before = listeners.length > 0 ? progression() : undefined;
      save.update((s) => record(s, e, content));
      if (!before) return;
      const diff = diffProgression(before, progression());
      for (const fn of [...listeners]) {
        try {
          fn(e, diff);
        } catch (error) {
          console.error(error); // a listener must not stop the others, or the screen that emitted
        }
      }
    }),
  );
  return {
    events,
    progression,
    onRecorded(fn) {
      listeners = [...listeners, fn];
      return () => {
        listeners = listeners.filter((l) => l !== fn);
      };
    },
    dispose: () => {
      stops.forEach((stop) => stop());
      listeners = [];
    },
  };
}
