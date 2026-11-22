/**
 * What Mission Control's Missions tab shows (docs/VISUAL_DESIGN.md 7.6), worked out from the content and the progression
 * view. Pure, so it is unit-tested without a page (tests/missionsModel.test.ts).
 */
import type { ProgressionView } from '../core/progression';
import type { Place } from '../data/content';
import { isWorldId, type MissionId, type PlaceId, type WorldId } from '../data/ids';
import { findCountOf, type MissionDef } from '../data/missions';

export type MissionStatus = 'done' | 'here' | 'open';

export interface MissionRow {
  id: MissionId;
  title: string;
  /** The world's name, or empty for a mission with no place. */
  placeName: string;
  /** Where Go sets course to. Null when Go is not offered. */
  place: WorldId | null;
  status: MissionStatus;
  /** "Done!", "You are here" or "1 of 3 found". */
  line: string;
  /** Primary on the first open row, secondary on later ones, none on the rest. */
  go: 'primary' | 'secondary' | null;
}

export interface MissionRowsInput {
  missions: ReadonlyMap<MissionId, MissionDef>;
  view: Pick<ProgressionView, 'missions'>;
  places: ReadonlyMap<PlaceId, Place>;
  /** The world the player is at or on now, if any. */
  here: string | null;
}

export const NO_MISSIONS_TEXT = 'No missions yet. Explore a world to find one!';

/** One row per mission, ordered from the Sun outwards (missions with no place last), then in file order. */
export function buildMissionRows({ missions, view, places, here }: MissionRowsInput): MissionRow[] {
  const order = (m: MissionDef) => (m.place ? (places.get(m.place)?.order ?? Infinity) : Infinity);
  const sorted = [...missions.values()].map((m, i) => ({ m, i })).sort((a, b) => order(a.m) - order(b.m) || a.i - b.i);
  let firstOpen = true;
  return sorted.map(({ m }) => {
    const state = view.missions.get(m.id);
    const status: MissionStatus = state?.done ? 'done' : m.place && m.place === here ? 'here' : 'open';
    const progress = state?.progress ?? { done: 0, of: findCountOf(m) };
    const line = status === 'done' ? 'Done!' : status === 'here' ? 'You are here' : `${progress.done} of ${progress.of} found`;
    const place = status === 'open' && isWorldId(m.place) ? m.place : null;
    let go: MissionRow['go'] = null;
    if (place) {
      go = firstOpen ? 'primary' : 'secondary';
      firstOpen = false;
    }
    return { id: m.id, title: m.title, placeName: m.place ? (places.get(m.place)?.name ?? '') : '', place, status, line, go };
  });
}

/** What Listen reads on the Missions tab. */
export function missionsListenText(rows: readonly MissionRow[]): string {
  if (rows.length === 0) return NO_MISSIONS_TEXT;
  const lines = rows.map((r) => `${r.title}${r.placeName ? `, ${r.placeName}` : ''}: ${r.line}`);
  return `Missions. ${lines.join('. ')}.`;
}
