/**
 * Progression (docs/TECHNICAL_ARCHITECTURE.md section 4.6): XP, ranks, stars, missions and Journal pages, all worked
 * out from the save, and the recorder, the only code that changes the save. The rules' types live in
 * `src/data/progression.ts` (Content holds them) and are re-exported here.
 */
export type { ProgressionRules, XpSource } from '../../data/progression';
export { createProgressionMemo, deriveProgression, type ProgressionContent, type ProgressionView } from './derive';
export { diffProgression, type RewardDiff } from './diff';
export { RECORDED_EVENTS, record, type RecorderContent } from './recorder';
export { rankFor, xpOf, type RankView } from './xp';
