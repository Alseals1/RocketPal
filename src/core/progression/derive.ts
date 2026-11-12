/**
 * Everything the UI shows about progress, worked out from the save (docs/TECHNICAL_ARCHITECTURE.md section 4.6).
 * Pure; `createProgressionMemo` works it out at most once per save revision.
 * See decisions/2026-11-12-events-conditions-progression.md (D8).
 */
import type { Content } from '../../data/content';
import type { ChapterId, CourseId, DotId, ItemId, MissionId, PatchId, PlaceId } from '../../data/ids';
import { dotsFoundAt, isMissionDone, missionProgress, starsAtPlace } from '../conditions';
import type { SaveData } from '../save/schema';
import { rankFor, xpOf, type RankView, type XpContent } from './xp';

/** Pure and memoised by save revision. Everything the UI shows about progress. */
export interface ProgressionView {
  xp: number;
  rank: RankView;
  stars: { total: number; byPlace: Map<PlaceId, number>; byCourse: Map<CourseId, number> };
  missions: Map<MissionId, { done: boolean; progress: { done: number; of: number } }>;
  chapters: Map<ChapterId, { done: boolean; steps: number; stepsDone: number }>;
  patches: Map<PatchId, { earned: boolean; date?: string }>;
  unlocked: Set<ItemId>;
  journal: Map<PlaceId, { found: DotId[]; total: number }>;
}

export type ProgressionContent = XpContent & Pick<Content, 'places' | 'arrivals' | 'missions'>;

export function deriveProgression(save: SaveData, content: ProgressionContent): ProgressionView {
  const xp = xpOf(save, content);

  const byPlace = new Map<PlaceId, number>();
  for (const place of content.places.keys()) byPlace.set(place, starsAtPlace(save, content, place));
  const byCourse = new Map<CourseId, number>(); // courses arrive with #51
  let total = 0;
  for (const n of [...byPlace.values(), ...byCourse.values()]) total += n;

  const missions: ProgressionView['missions'] = new Map();
  for (const id of content.missions.keys()) {
    missions.set(id, { done: isMissionDone(save, content, id), progress: missionProgress(save, content, id) });
  }

  const journal: ProgressionView['journal'] = new Map();
  for (const [place, arrival] of content.arrivals) journal.set(place, { found: dotsFoundAt(save, content, place), total: arrival.hotspots.length });

  return {
    xp,
    rank: rankFor(xp, content.progression),
    stars: { total, byPlace, byCourse },
    missions,
    chapters: new Map(), // chapters arrive with #47
    patches: new Map(), // patches arrive with #54
    unlocked: new Set(), // items arrive with #46
    journal,
  };
}

/** Works out the view at most once per save revision: the same revision gives back the same object. */
export function createProgressionMemo(content: ProgressionContent): (save: SaveData, revision: number) => ProgressionView {
  let last: { revision: number; view: ProgressionView } | undefined;
  return (save, revision) => {
    if (last?.revision !== revision) last = { revision, view: deriveProgression(save, content) };
    return last.view;
  };
}
