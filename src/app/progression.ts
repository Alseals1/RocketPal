/**
 * Wires progression into the game (docs/TECHNICAL_ARCHITECTURE.md 5.2 and 7): screens emit events on the bus, the
 * recorder writes them into the save, and `progression()` works the view out once per save revision.
 * The recorder subscribes before anything else, so when `emit` returns the save is already up to date
 * (decisions/2026-11-12-events-conditions-progression.md, D9).
 */
import { createEventBus, type EventBus } from '../core/events';
import { RECORDED_EVENTS, createProgressionMemo, record, type ProgressionView } from '../core/progression';
import type { Content } from '../data/content';
import type { SaveStore } from '../platform/saveStore';

export interface ProgressionWiring {
  events: EventBus;
  progression: () => ProgressionView;
  /** Stops recording. */
  dispose(): void;
}

export function connectProgression(save: SaveStore, content: Content): ProgressionWiring {
  const events = createEventBus();
  const memo = createProgressionMemo(content);
  const stops = RECORDED_EVENTS.map((type) => events.on(type, (e) => void save.update((s) => record(s, e, content))));
  return {
    events,
    progression: () => memo(save.read(), save.revision),
    dispose: () => stops.forEach((stop) => stop()),
  };
}
