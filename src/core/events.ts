/**
 * Events (docs/TECHNICAL_ARCHITECTURE.md section 4.4). Everything that happens in play is one typed event. Screens
 * publish; the progression recorder (and later audio cues, toasts and the debug log) subscribe.
 * See decisions/2026-11-12-events-conditions-progression.md (D9).
 */
import type { ActivityId, CapsuleId, CourseId, DotId, ItemId, MissionId, PlaceId } from '../data/ids';

export type GameEvent =
  | { type: 'arrived'; place: PlaceId }
  | { type: 'dotFound'; dot: DotId }
  | { type: 'quizFinished'; place: PlaceId; firstTryAll: boolean }
  | { type: 'capsuleCollected'; capsule: CapsuleId }
  | { type: 'courseFinished'; course: CourseId; timeMs: number; crystals: number; crystalsTotal: number; bumps: number }
  | { type: 'activityFinished'; activity: ActivityId; key?: string }
  | { type: 'rescueDone'; mission: MissionId }
  | { type: 'itemEquipped'; item: ItemId }
  | { type: 'bump' } // for sound and screen feedback only
  | { type: 'boost'; on: boolean };

export interface EventBus {
  emit(e: GameEvent): void;
  on<T extends GameEvent['type']>(type: T, fn: (e: Extract<GameEvent, { type: T }>) => void): () => void;
}

/**
 * A bus that calls its handlers at once, in the order they subscribed. Each emit works on a copy of the list, so a
 * handler that subscribes or unsubscribes during an emit changes only the next one. A handler that throws is logged
 * and the others still run.
 */
export function createEventBus(): EventBus {
  const handlers = new Map<GameEvent['type'], ((e: GameEvent) => void)[]>();
  return {
    emit(e) {
      for (const fn of [...(handlers.get(e.type) ?? [])]) {
        try {
          fn(e);
        } catch (error) {
          console.error(error);
        }
      }
    },
    on(type, fn) {
      const handler = fn as (e: GameEvent) => void;
      const list = handlers.get(type) ?? [];
      handlers.set(type, [...list, handler]);
      return () => {
        const now = handlers.get(type) ?? [];
        const at = now.indexOf(handler);
        if (at >= 0) handlers.set(type, [...now.slice(0, at), ...now.slice(at + 1)]);
      };
    },
  };
}
