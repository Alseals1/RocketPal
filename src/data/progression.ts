/**
 * The progression rules in public/data/progression.json: the XP table and the ranks (docs/GAME_DESIGN.md section 10,
 * docs/TECHNICAL_ARCHITECTURE.md section 4.6). The types live here, in the Content layer, because `Content` holds the
 * rules; Logic re-exports them from `src/core/progression/`. See decisions/2026-11-12-events-conditions-progression.md.
 */

export type XpSource =
  | 'dot'
  | 'capsule'
  | 'mission'
  | 'quiz'
  | 'perfectQuiz'
  | 'course'
  | 'courseStar'
  | 'personalBest'
  | 'sideMission'
  | 'chapter'
  | 'activity';

export const XP_SOURCES = [
  'dot',
  'capsule',
  'mission',
  'quiz',
  'perfectQuiz',
  'course',
  'courseStar',
  'personalBest',
  'sideMission',
  'chapter',
  'activity',
] as const satisfies readonly XpSource[];

export interface ProgressionRules {
  xp: Record<XpSource, { first: number; again: number }>; // the table in GAME_DESIGN.md section 10
  repeatCap: number; // repeats that still give XP, per activity (e.g. 10)
  ranks: { rank: number; name: string; xp: number }[]; // 8 ranks
}

export const RANK_NAME_CHARS = 20;

/** Used when progression.json is missing or broken: no XP from anything, and one rank. Stars and missions still work. */
export const FALLBACK_RULES: ProgressionRules = {
  xp: Object.fromEntries(XP_SOURCES.map((s) => [s, { first: 0, again: 0 }])) as ProgressionRules['xp'],
  repeatCap: 0,
  ranks: [{ rank: 1, name: 'Cadet', xp: 0 }],
};

const isWhole = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;

/** Returns a list of problems in the progression rules. An empty list means they are valid. */
export function validateProgression(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return ['progression data must be an object'];
  const data = raw as Record<string, unknown>;
  const problems: string[] = [];

  const xp = data.xp as Record<string, unknown> | undefined;
  if (typeof xp !== 'object' || xp === null || Array.isArray(xp)) {
    problems.push('xp must be an object with an entry for each XP source');
  } else {
    for (const source of XP_SOURCES) {
      const entry = xp[source] as Record<string, unknown> | undefined;
      if (typeof entry !== 'object' || entry === null || !isWhole(entry.first) || !isWhole(entry.again)) {
        problems.push(`xp.${source} must have "first" and "again", each a whole number of 0 or more`);
      }
    }
  }

  if (!isWhole(data.repeatCap)) problems.push('repeatCap must be a whole number of 0 or more');

  const ranks = data.ranks;
  if (!Array.isArray(ranks) || ranks.length === 0) {
    problems.push('ranks must be a list of at least one rank');
  } else {
    ranks.forEach((r: Record<string, any> | null, i) => {
      const label = `ranks[${i}]`;
      if (r?.rank !== i + 1) problems.push(`${label}: rank must be ${i + 1} (ranks are numbered 1, 2, 3... in order)`);
      if (typeof r?.name !== 'string' || !r.name.trim() || r.name.length > RANK_NAME_CHARS) {
        problems.push(`${label}: name is required and at most ${RANK_NAME_CHARS} characters`);
      }
      if (!isWhole(r?.xp)) problems.push(`${label}: xp must be a whole number of 0 or more`);
      else if (i === 0 && r.xp !== 0) problems.push(`${label}: the first rank starts at 0 xp`);
      else if (i > 0 && isWhole(ranks[i - 1]?.xp) && r.xp <= ranks[i - 1].xp) problems.push(`${label}: xp must be more than the rank before`);
    });
  }
  return problems;
}
