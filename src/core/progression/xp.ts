/**
 * XP and ranks, worked out from the save (docs/GAME_DESIGN.md section 10). Only facts are saved; XP is never stored,
 * so it cannot get out of step or be lost in a merge. See decisions/2026-11-12-events-conditions-progression.md (D4, D8).
 */
import type { Content } from '../../data/content';
import type { ProgressionRules } from '../../data/progression';
import { isMissionDone, quizState } from '../conditions';
import type { SaveData } from '../save/schema';

export type XpContent = Pick<Content, 'places' | 'arrivals' | 'missions' | 'quizzes' | 'progression'>;

export interface RankView {
  rank: number;
  name: string;
  /** XP earned since this rank began. */
  xpIntoRank: number;
  /** XP still needed for the next rank, or `null` at the last rank. */
  xpForNext: number | null;
}

/** Every dot on every landing picture, as `place/id`. */
export function knownDots(content: Pick<Content, 'arrivals'>): Set<string> {
  const dots = new Set<string>();
  for (const [place, arrival] of content.arrivals) for (const h of arrival.hotspots) dots.add(`${place}/${h.id}`);
  return dots;
}

/**
 * Total XP: each dot found, each `find` mission done, each place's quiz finished and finished perfectly, all at their
 * first-time value; plus each replay counted in `repeats` (`dot:<DotId>`, `quiz:<PlaceId>`), at most `repeatCap` per key,
 * at its "again" value. Anything the content does not have gives nothing.
 */
export function xpOf(save: SaveData, content: XpContent): number {
  const { xp, repeatCap } = content.progression;
  const dots = knownDots(content);
  let total = save.dots.filter((d) => dots.has(d)).length * xp.dot.first;
  for (const m of content.missions.values()) {
    if (m.kind === 'find' && isMissionDone(save, content, m.id)) total += xp.mission.first;
  }
  for (const place of content.places.keys()) {
    const quiz = quizState(save, place);
    if (quiz.done) total += xp.quiz.first;
    if (quiz.perfect) total += xp.perfectQuiz.first;
  }
  for (const [key, count] of Object.entries(save.repeats)) {
    const at = key.indexOf(':');
    const source = key.slice(0, at);
    const id = key.slice(at + 1);
    const again = source === 'dot' && dots.has(id) ? xp.dot.again : source === 'quiz' && content.quizzes.has(id as never) ? xp.quiz.again : 0;
    if (Number.isFinite(count)) total += Math.min(Math.max(0, Math.floor(count)), repeatCap) * again;
  }
  return total;
}

/** The rank for an amount of XP: the highest rank whose `xp` it has reached. */
export function rankFor(xp: number, rules: Pick<ProgressionRules, 'ranks'>): RankView {
  const { ranks } = rules;
  let at = 0;
  while (at + 1 < ranks.length && xp >= ranks[at + 1].xp) at++;
  const current = ranks[at];
  const next = ranks[at + 1];
  return { rank: current.rank, name: current.name, xpIntoRank: xp - current.xp, xpForNext: next ? next.xp - xp : null };
}
