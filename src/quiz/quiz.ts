export interface QuizOption {
  text: string;
  correct: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  /** One short sentence, from the fact card, shown with the right answer. */
  because: string;
  /** The dot (hotspot) on this world's picture that the question is built from. */
  hotspot: string;
}

export type AnswerResult = 'right' | 'wrong' | 'ignored';

/** One go at a quiz. A wrong answer never ends it: the kid can try again as often as they like. */
export interface QuizRun {
  /** The question being asked, or null when the quiz is finished. */
  readonly current: QuizQuestion | null;
  readonly position: { number: number; of: number };
  readonly finished: boolean;
  /** The options already tried and wrong on the current question (so they can be greyed out). */
  readonly wrongOptions: number[];
  /** How many questions were answered right with the very first pick. */
  readonly firstTryCorrect: number;
  /** Finished, with every question right on the first try. */
  readonly perfect: boolean;
  /** Picks an option on the current question. */
  answer(optionIndex: number): AnswerResult;
}

export function createQuizRun(questions: QuizQuestion[]): QuizRun {
  if (questions.length === 0) throw new Error('A quiz needs at least one question');
  for (const q of questions) {
    if (q.options.filter((o) => o.correct).length !== 1) throw new Error(`Question ${q.id} needs exactly one right answer`);
  }

  let index = 0;
  let wrong = new Set<number>();
  let firstTry = 0;

  return {
    get current() {
      return index < questions.length ? questions[index] : null;
    },
    get position() {
      return { number: Math.min(index + 1, questions.length), of: questions.length };
    },
    get finished() {
      return index >= questions.length;
    },
    get wrongOptions() {
      return [...wrong];
    },
    get firstTryCorrect() {
      return firstTry;
    },
    get perfect() {
      return index >= questions.length && firstTry === questions.length;
    },
    answer(optionIndex: number): AnswerResult {
      const question = index < questions.length ? questions[index] : null;
      if (!question || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) return 'ignored';
      if (wrong.has(optionIndex)) return 'ignored';
      if (question.options[optionIndex].correct) {
        if (wrong.size === 0) firstTry++;
        index++;
        wrong = new Set();
        return 'right';
      }
      wrong.add(optionIndex);
      return 'wrong';
    },
  };
}
