/** What changed between two progression views: drives the reward screen and toasts (architecture 4.6). Pure. */
import type { ChapterId, CourseId, DotId, ItemId, MissionId, PatchId, PlaceId } from '../../data/ids';
import type { ProgressionView } from './derive';

export interface RewardDiff {
  xpGained: number;
  rankUp?: { from: number; to: number };
  /** Each place or course with more stars than before, with its new total. */
  newStars: { place: PlaceId | CourseId; count: number }[];
  newPatches: PatchId[];
  newItems: ItemId[];
  newPages: DotId[];
  missionsDone: MissionId[];
  chaptersDone: ChapterId[];
}

/** Everything in `after` that `before` did not have, in `after`'s order. */
export function diffProgression(before: ProgressionView, after: ProgressionView): RewardDiff {
  const diff: RewardDiff = {
    xpGained: Math.max(0, after.xp - before.xp),
    newStars: [],
    newPatches: [],
    newItems: [],
    newPages: [],
    missionsDone: [],
    chaptersDone: [],
  };
  if (after.rank.rank > before.rank.rank) diff.rankUp = { from: before.rank.rank, to: after.rank.rank };
  const starMaps: [ReadonlyMap<string, number>, ReadonlyMap<string, number>][] = [
    [after.stars.byPlace, before.stars.byPlace],
    [after.stars.byCourse, before.stars.byCourse],
  ];
  for (const [stars, old] of starMaps) {
    for (const [place, count] of stars) if (count > (old.get(place) ?? 0)) diff.newStars.push({ place, count });
  }
  for (const [id, m] of after.missions) if (m.done && !before.missions.get(id)?.done) diff.missionsDone.push(id);
  for (const [id, c] of after.chapters) if (c.done && !before.chapters.get(id)?.done) diff.chaptersDone.push(id);
  for (const [id, p] of after.patches) if (p.earned && !before.patches.get(id)?.earned) diff.newPatches.push(id);
  for (const item of after.unlocked) if (!before.unlocked.has(item)) diff.newItems.push(item);
  for (const [place, page] of after.journal) {
    const had = new Set(before.journal.get(place)?.found);
    for (const dot of page.found) if (!had.has(dot)) diff.newPages.push(dot);
  }
  return diff;
}
