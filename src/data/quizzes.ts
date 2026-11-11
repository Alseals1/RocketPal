import type { QuizQuestion } from '../quiz/quiz';
import type { SurfaceData } from './surfaces';
import { contentWords, isRealDate, isText, plain, sentences, words } from './text';

export interface QuizQuestionData extends QuizQuestion {
  /** A short phrase that must appear word for word in the text of the dot the question comes from. It is what backs up the right answer. */
  evidence: string;
}

export interface Quiz {
  worldId: string;
  questions: QuizQuestionData[];
}

export interface QuizData {
  lastChecked: string;
  quizzes: Quiz[];
}

/** Short enough for an 8 to 10 year old to read in one go. */
export const QUIZ_LIMITS = { questionsPerQuiz: 3, optionsPerQuestion: 3, questionWords: 20, optionWords: 8, becauseWords: 25, becauseSentences: 2 };

/** At least this share of the "because" line's meaningful words must be in the dot's own text. */
const BECAUSE_FROM_DOT = 0.6;

/**
 * Returns a list of problems in the quiz data. An empty list means it is valid.
 *
 * What this checks by machine: every question names a real dot of that world; its evidence phrase is word for word in
 * that dot; the right answer uses only words from the dot; a wrong answer brings in something the dot does not say
 * (and does not repeat the evidence); the "because" line is mostly the dot's own words. It cannot tell a reworded wrong
 * answer from a right one, so a person still reads every question against NASA's pages before it ships.
 */
export function validateQuizzes(raw: unknown, surfaces: SurfaceData): string[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return ['quiz data must be an object'];
  const data = raw as Record<string, any>;
  const problems: string[] = [];
  if (!isRealDate(data.lastChecked)) problems.push('lastChecked must be a real date like 2026-10-23');
  if (!Array.isArray(data.quizzes)) return [...problems, 'quizzes must be a list'];

  const seenWorlds = new Set<string>();
  for (const quiz of data.quizzes as Record<string, any>[]) {
    const world = isText(quiz?.worldId) ? quiz.worldId : '(quiz without a worldId)';
    const surface = surfaces.surfaces.find((s) => s.worldId === world);
    if (!surface) problems.push(`${world}: has a quiz but no landing picture`);
    if (seenWorlds.has(world)) problems.push(`${world}: has a quiz more than once`);
    seenWorlds.add(world);

    if (!Array.isArray(quiz?.questions) || quiz.questions.length !== QUIZ_LIMITS.questionsPerQuiz) {
      problems.push(`${world}: needs exactly ${QUIZ_LIMITS.questionsPerQuiz} questions`);
      continue;
    }

    const seenIds = new Set<string>();
    const rightPositions = new Set<number>();
    let rightIsLongest = 0;
    for (const q of quiz.questions as Record<string, any>[]) {
      const label = `${world}/${isText(q?.id) ? q.id : '(question without an id)'}`;
      if (!isText(q?.id) || !/^[a-z0-9-]+$/.test(q.id)) problems.push(`${label}: id is required (lower case letters, numbers and dashes)`);
      else if (seenIds.has(q.id)) problems.push(`${label}: id is used by another question in this quiz`);
      else seenIds.add(q.id);

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
      else if (options.length === QUIZ_LIMITS.optionsPerQuestion) {
        rightPositions.add(options.findIndex((o) => o?.correct === true));
        // By characters, not words: a long word still makes an option look like the answer.
        const lengths = options.map((o) => (isText(o?.text) ? o.text.trim().length : 0));
        const right = options.findIndex((o) => o?.correct === true);
        if (lengths.every((n, i) => i === right || lengths[right] > n)) rightIsLongest++;
      }
      for (const o of options) {
        if (!isText(o?.text)) problems.push(`${label}: every option needs text`);
        else if (words(o.text) > QUIZ_LIMITS.optionWords) problems.push(`${label}: option has too many words (at most ${QUIZ_LIMITS.optionWords})`);
        if (typeof o?.correct !== 'boolean') problems.push(`${label}: every option needs correct: true or false`);
      }
      const texts = options.map((o) => (isText(o?.text) ? plain(o.text) : ''));
      if (new Set(texts).size !== texts.length) problems.push(`${label}: the options must all be different`);

      const hotspot = surface?.hotspots.find((h) => h.id === q?.hotspot);
      if (surface && !hotspot) problems.push(`${label}: hotspot "${String(q?.hotspot)}" is not a dot on ${world}`);
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
    }
    if (rightIsLongest === quiz.questions.length) problems.push(`${world}: the right answer is the longest option in every question, which gives it away`);
    if (rightPositions.size === 1 && quiz.questions.length > 1) {
      problems.push(`${world}: the right answer is in the same position in every question; mix it up`);
    }
  }
  return problems;
}

export async function loadQuizzes(surfaces: SurfaceData, url = '/data/quizzes.json'): Promise<QuizData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  const raw: unknown = await response.json();
  const problems = validateQuizzes(raw, surfaces);
  if (problems.length > 0) throw new Error(`Bad quiz data:\n${problems.join('\n')}`);
  return raw as QuizData;
}
