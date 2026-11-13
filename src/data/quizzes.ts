/**
 * Question pools (docs/TECHNICAL_ARCHITECTURE.md section 4.10). Each world has a pool of levelled questions in
 * public/data/quizzes.json. Every time the quiz opens, `drawQuestions` picks a few for the pilot's rank and shuffles
 * them and their answers, so a replay is a new quiz. Every content check runs on every question; one bad question is
 * left out on its own, and a pool is left out only when it can no longer fill a draw.
 * See decisions/2026-11-13-question-pools.md.
 */
import type { PlaceId } from './ids';
import { seededRandom, shuffled } from './random';
import type { Surface, SurfaceData } from './surfaces';
import { contentWords, isRealDate, isText, plain, sentences, words } from './text';

export interface QuizOption {
  text: string;
  correct: boolean;
}

/** One question as the quiz asks it. */
export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  /** One short sentence, from the fact card, shown with the right answer. */
  because: string;
  /** The dot (hotspot) on this world's picture that the question is built from. */
  hotspot: string;
}

export interface QuizQuestionData extends QuizQuestion {
  /** A short phrase that must appear word for word in the text of the dot the question comes from. It is what backs up the right answer. */
  evidence: string;
}

/** 1 is the easiest. Level 3 is asked only from rank `POOL_RULES.level3FromRank` up. */
export interface PoolQuestion extends QuizQuestionData {
  level: 1 | 2 | 3;
}

export interface QuestionPool {
  place: PlaceId;
  /** A quiz asks 3 questions; a postcard (fly-by worlds) asks 1. */
  format: 'quiz' | 'postcard';
  /** 6-9 for a quiz, 2-4 for a postcard. */
  questions: PoolQuestion[];
}

/** public/data/quizzes.json */
export interface QuestionPoolData {
  lastChecked: string;
  pools: QuestionPool[];
}

/** How many questions each format asks (`draw`) and holds (`min` to `max`), and the rank from which level 3 is asked. */
export const POOL_RULES = {
  quiz: { draw: 3, min: 6, max: 9 },
  postcard: { draw: 1, min: 2, max: 4 },
  level3FromRank: 5,
} as const;

/** Short enough for an 8 to 10 year old to read in one go. */
export const QUIZ_LIMITS = { optionsPerQuestion: 3, questionWords: 20, optionWords: 8, becauseWords: 25, becauseSentences: 2 };

/** At least this share of the "because" line's meaningful words must be in the dot's own text. */
const BECAUSE_FROM_DOT = 0.6;

const FORMATS = ['quiz', 'postcard'] as const;

/** How many tries `drawDifferent` makes before it settles for the last one. */
const DIFFERENT_TRIES = 20;

/**
 * Returns a list of problems in the question data. An empty list means it is valid.
 *
 * What this checks by machine: every question names a real dot of that world; its evidence phrase is word for word in
 * that dot; the right answer uses only words from the dot; a wrong answer brings in something the dot does not say
 * (and does not repeat the evidence); the "because" line is mostly the dot's own words. It cannot tell a reworded wrong
 * answer from a right one, so a person still reads every question against NASA's pages before it ships.
 */
export function validateQuestionPools(raw: unknown, surfaces: SurfaceData): string[] {
  const problems = validateQuestionsFile(raw);
  const pools = (raw as Record<string, unknown> | null)?.pools;
  if (!Array.isArray(pools)) return problems;

  const seen = new Set<string>();
  for (const pool of pools as Record<string, any>[]) {
    const place = placeOf(pool);
    if (seen.has(place)) problems.push(`${place}: has a quiz more than once`);
    seen.add(place);
    problems.push(...checkPool(pool, surfaces.surfaces.find((s) => s.worldId === place)).problems);
  }
  return problems;
}

/** The checks on the questions file as a whole (not on its pools). An empty list means the file can be read. */
export function validateQuestionsFile(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return ['quiz data must be an object'];
  const data = raw as Record<string, unknown>;
  const problems: string[] = [];
  if (!isRealDate(data.lastChecked)) problems.push('lastChecked must be a real date like 2026-10-23');
  if (!Array.isArray(data.pools)) problems.push('pools must be a list');
  return problems;
}

const placeOf = (pool: unknown) => {
  const place = (pool as Record<string, unknown> | null)?.place;
  return isText(place) ? place : '(pool without a place)';
};

/**
 * The checks on one world's pool, against that world's landing picture (`undefined` if it has none). Returns the pool
 * with only its good questions (in file order), or no pool when it cannot be used: not an object, no landing picture,
 * a bad format, no question list, or good questions at levels 1 and 2 on too few dots to fill a draw. The other problems are
 * reported and the pool is still kept.
 */
export function checkPool(raw: unknown, surface: Surface | undefined): { pool?: QuestionPool; problems: string[] } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { problems: ['a pool must be an object'] };
  const data = raw as Record<string, any>; // typed loosely: every read allows for a missing field
  const place = placeOf(data);
  const problems: string[] = [];
  if (!surface) problems.push(`${place}: has a quiz but no landing picture`);
  if (!FORMATS.includes(data.format)) problems.push(`${place}: format must be "quiz" or "postcard"`);
  if (!Array.isArray(data.questions)) problems.push(`${place}: questions must be a list`);
  if (problems.length > 0) return { problems };

  const format = data.format as QuestionPool['format'];
  const rules = POOL_RULES[format];
  const authored = data.questions as unknown[];
  const kept: PoolQuestion[] = [];
  const seenIds = new Set<string>();
  const seenQuestions = new Set<string>();
  const rightPositions = new Set<number>();
  let rightIsLongest = 0;

  for (const q of authored as Record<string, any>[]) {
    const label = `${place}/${isText(q?.id) ? q.id : '(question without an id)'}`;
    const own = checkQuestion(q, place, surface);
    if (isText(q?.id) && seenIds.has(q.id)) own.push(`${label}: id is used by another question in this quiz`);
    else if (isText(q?.id)) seenIds.add(q.id);
    if (isText(q?.question) && seenQuestions.has(plain(q.question))) own.push(`${label}: asks the same question as another one in this pool`);
    else if (isText(q?.question)) seenQuestions.add(plain(q.question));
    problems.push(...own);
    if (own.length === 0) kept.push(q as PoolQuestion);

    // Giveaways across the pool, counted on every question that has three options with one right.
    const options: Record<string, any>[] = Array.isArray(q?.options) ? q.options : [];
    const right = options.findIndex((o) => o?.correct === true);
    if (options.length === QUIZ_LIMITS.optionsPerQuestion && options.filter((o) => o?.correct === true).length === 1) {
      rightPositions.add(right);
      // By characters, not words: a long word still makes an option look like the answer.
      const lengths = options.map((o) => (isText(o?.text) ? o.text.trim().length : 0));
      if (lengths.every((n, i) => i === right || lengths[right] > n)) rightIsLongest++;
    }
  }

  if (authored.length < rules.min || authored.length > rules.max) {
    problems.push(`${place}: needs ${rules.min} to ${rules.max} questions (has ${authored.length})`);
  }
  if (rightPositions.size === 1 && authored.length > 1) {
    problems.push(`${place}: the right answer is in the same position in every question; mix it up`);
  }
  if (rightIsLongest > Math.floor(authored.length / 3)) {
    problems.push(`${place}: the right answer is the longest option in more than a third of the questions, which gives it away`);
  }
  // A draw never asks two questions on one dot, so it is the dots that must be enough, not the questions.
  const easyDots = new Set(kept.filter((q) => q.level !== 3).map((q) => q.hotspot)).size;
  if (easyDots < rules.draw) {
    const dots = rules.draw === 1 ? '1 dot' : `${rules.draw} different dots`;
    problems.push(`${place}: needs good questions on at least ${dots} at level 1 or 2 to make a ${format} (has ${easyDots})`);
    return { problems };
  }
  return { pool: { place: place as PlaceId, format, questions: kept }, problems };
}

/** The checks on one question of `place`'s pool, against that world's landing picture. An empty list means it is good. */
export function checkQuestion(raw: unknown, place: string, surface: Surface | undefined): string[] {
  const q = raw as Record<string, any>; // typed loosely: every read allows for a missing field
  const problems: string[] = [];
  const label = `${place}/${isText(q?.id) ? q.id : '(question without an id)'}`;
  if (!isText(q?.id) || !/^[a-z0-9-]+$/.test(q.id)) problems.push(`${label}: id is required (lower case letters, numbers and dashes)`);

  if (q?.level !== 1 && q?.level !== 2 && q?.level !== 3) problems.push(`${label}: level must be 1, 2 or 3`);

  if (!isText(q?.question)) problems.push(`${label}: question is required`);
  else {
    if (!q.question.trim().endsWith('?')) problems.push(`${label}: question must end with a question mark`);
    if (words(q.question) > QUIZ_LIMITS.questionWords) problems.push(`${label}: question has too many words (at most ${QUIZ_LIMITS.questionWords})`);
  }

  if (!isText(q?.because)) problems.push(`${label}: because is required (one short sentence about why the answer is right)`);
  else if (words(q.because) > QUIZ_LIMITS.becauseWords || sentences(q.because) > QUIZ_LIMITS.becauseSentences) {
    problems.push(`${label}: because is too long (at most ${QUIZ_LIMITS.becauseWords} words and ${QUIZ_LIMITS.becauseSentences} sentences)`);
  }

  const options: Record<string, any>[] = Array.isArray(q?.options) ? q.options : [];
  if (options.length !== QUIZ_LIMITS.optionsPerQuestion) problems.push(`${label}: needs exactly ${QUIZ_LIMITS.optionsPerQuestion} options`);
  const rightCount = options.filter((o) => o?.correct === true).length;
  if (options.length > 0 && rightCount !== 1) problems.push(`${label}: needs exactly one right answer (has ${rightCount})`);
  for (const o of options) {
    if (!isText(o?.text)) problems.push(`${label}: every option needs text`);
    else if (words(o.text) > QUIZ_LIMITS.optionWords) problems.push(`${label}: option has too many words (at most ${QUIZ_LIMITS.optionWords})`);
    if (typeof o?.correct !== 'boolean') problems.push(`${label}: every option needs correct: true or false`);
  }
  const texts = options.map((o) => (isText(o?.text) ? plain(o.text) : ''));
  if (new Set(texts).size !== texts.length) problems.push(`${label}: the options must all be different`);

  const hotspot = surface?.hotspots.find((h) => h.id === q?.hotspot);
  if (surface && !hotspot) problems.push(`${label}: hotspot "${String(q?.hotspot)}" is not a dot on ${place}`);
  if (!isText(q?.evidence)) problems.push(`${label}: evidence is required (a phrase from the dot's text)`);
  else if (hotspot) {
    const evidence = plain(q.evidence);
    if (!plain(hotspot.text).includes(evidence)) problems.push(`${label}: evidence "${q.evidence}" is not word for word in the text of the "${hotspot.id}" dot`);
    for (const o of options) {
      if (o?.correct === false && isText(o?.text) && plain(o.text).includes(evidence)) {
        problems.push(`${label}: a wrong option repeats the evidence, so it could also be right`);
      }
    }
    const inDot = new Set(contentWords(hotspot.text));
    for (const o of options) {
      if (!isText(o?.text)) continue;
      const used = contentWords(o.text);
      if (o.correct === true && (used.length === 0 || used.some((w) => !inDot.has(w)))) {
        problems.push(`${label}: the right answer has words that are not in the "${hotspot.id}" dot's text`);
      }
      if (o.correct === false && used.every((w) => inDot.has(w))) {
        problems.push(`${label}: a wrong option is made of only words from the dot, so it could also be right`);
      }
    }
    if (isText(q?.because)) {
      const because = contentWords(q.because);
      if (because.length > 0 && because.filter((w) => inDot.has(w)).length / because.length < BECAUSE_FROM_DOT) {
        problems.push(`${label}: because is not from the "${hotspot.id}" dot's text (use its own words)`);
      }
    }
  }
  return problems;
}

/**
 * Picks one go's questions from a pool: 3 for a quiz, 1 for a postcard, never the same question twice, and never two
 * questions on the same dot (one could give the other's answer away, so the bonus star would not be earned). Ranks below
 * `POOL_RULES.level3FromRank` get only levels 1 and 2. From that rank a quiz has exactly one level-3 question (when the
 * pool has one) and a postcard draws from every level. The questions and each question's answers come in a shuffled
 * order. Pure: the same pool, rank and seed always give the same draw, and the pool is never changed.
 */
export function drawQuestions(pool: QuestionPool, rank: number, seed: number): QuizQuestion[] {
  const rand = seededRandom(seed);
  const { draw } = POOL_RULES[pool.format];
  const base = pool.questions.filter((q) => q.level !== 3);
  const hard = pool.questions.filter((q) => q.level === 3);
  const high = rank >= POOL_RULES.level3FromRank;

  const picked: PoolQuestion[] = [];
  /** Adds up to `count` questions from `from` in a random order, never one twice, and only on a new dot unless `sameDot`. */
  const take = (from: readonly PoolQuestion[], count: number, sameDot = false) => {
    if (count <= 0) return;
    for (const q of shuffled(from, rand)) {
      if (picked.length >= draw || count <= 0) return;
      if (picked.includes(q) || (!sameDot && picked.some((p) => p.hotspot === q.hotspot))) continue;
      picked.push(q);
      count--;
    }
  };
  const levels = high && pool.format === 'postcard' ? pool.questions : base;
  if (high && pool.format === 'quiz' && hard.length > 0) take(hard, 1);
  take(levels, draw - picked.length);
  // A valid pool always fills its draw above (checkPool asks for enough dots). Only a pool that skipped validation can
  // come up short: top it up with a second question on a dot, then from any level, never repeating a question.
  take(levels, draw - picked.length, true);
  take(pool.questions, draw - picked.length, true);

  return shuffled(picked, rand).map((q) => ({
    id: q.id,
    question: q.question,
    options: shuffled(q.options, rand).map((o) => ({ text: o.text, correct: o.correct })),
    because: q.because,
    hotspot: q.hotspot,
  }));
}

/**
 * `drawQuestions`, but never the same as `last` (same questions, same order, same answer order): tries `seed`,
 * `seed + 1` and so on, up to 20 times, then settles for the last try. Returns the draw and the seed it used.
 */
export function drawDifferent(pool: QuestionPool, rank: number, seed: number, last?: readonly QuizQuestion[]): { questions: QuizQuestion[]; seed: number } {
  let questions: QuizQuestion[] = [];
  let used = seed;
  for (let i = 0; i < DIFFERENT_TRIES; i++) {
    used = seed + i;
    questions = drawQuestions(pool, rank, used);
    if (!last || !sameDraw(questions, last)) break;
  }
  return { questions, seed: used };
}

function sameDraw(a: readonly QuizQuestion[], b: readonly QuizQuestion[]): boolean {
  return (
    a.length === b.length &&
    a.every((q, i) => q.id === b[i].id && q.options.length === b[i].options.length && q.options.every((o, j) => o.text === b[i].options[j].text))
  );
}
