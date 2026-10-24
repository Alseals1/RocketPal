import { describe, expect, it } from 'vitest';
import { createQuizRun, type QuizQuestion } from '../src/quiz/quiz';

/** Three questions; the right answers sit at options 1, 0 and 2. */
function questions(): QuizQuestion[] {
  const make = (id: string, right: number): QuizQuestion => ({
    id,
    question: `Question ${id}?`,
    options: [0, 1, 2].map((i) => ({ text: `Answer ${id}${i}`, correct: i === right })),
    because: `Because ${id}.`,
    hotspot: 'rim',
  });
  return [make('a', 1), make('b', 0), make('c', 2)];
}

describe('a quiz run', () => {
  it('starts on the first question, not finished', () => {
    const run = createQuizRun(questions());
    expect(run.current?.id).toBe('a');
    expect(run.position).toEqual({ number: 1, of: 3 });
    expect(run.finished).toBe(false);
  });

  it('moves to the next question after a right answer, and finishes after the last one', () => {
    const run = createQuizRun(questions());
    expect(run.answer(1)).toBe('right');
    expect(run.current?.id).toBe('b');
    expect(run.answer(0)).toBe('right');
    expect(run.current?.id).toBe('c');
    expect(run.finished).toBe(false);
    expect(run.answer(2)).toBe('right');
    expect(run.finished).toBe(true);
    expect(run.current).toBeNull();
  });

  it('never ends or blocks the quiz on a wrong answer: every wrong answer can be tried and the right one still works afterwards', () => {
    const run = createQuizRun(questions());
    expect(run.answer(0)).toBe('wrong'); // option 0 is wrong on question a
    expect(run.answer(2)).toBe('wrong'); // so is option 2: both wrong answers are used up
    expect(run.finished).toBe(false);
    expect(run.current?.id).toBe('a');
    expect(run.answer(1)).toBe('right');
    expect(run.current?.id).toBe('b');
  });

  it('remembers which answers were wrong on the current question (so they can be greyed out), and forgets them on the next', () => {
    const run = createQuizRun(questions());
    run.answer(0);
    run.answer(2);
    expect([...run.wrongOptions].sort()).toEqual([0, 2]);
    run.answer(1);
    expect(run.wrongOptions).toEqual([]);
  });

  it('treats picking the same wrong answer again, and a made-up option, as nothing happening', () => {
    const run = createQuizRun(questions());
    expect(run.answer(0)).toBe('wrong');
    expect(run.answer(0)).toBe('ignored');
    expect(run.answer(7)).toBe('ignored');
    expect(run.answer(-1)).toBe('ignored');
    expect(run.answer(1.5)).toBe('ignored');
    expect(run.wrongOptions).toEqual([0]);
    expect(run.current?.id).toBe('a');
  });

  it('ignores answers after the quiz is finished', () => {
    const run = createQuizRun(questions());
    run.answer(1);
    run.answer(0);
    run.answer(2);
    expect(run.answer(1)).toBe('ignored');
    expect(run.finished).toBe(true);
  });

  it('is perfect only when all three were right on the first try', () => {
    const clean = createQuizRun(questions());
    clean.answer(1);
    clean.answer(0);
    clean.answer(2);
    expect(clean.firstTryCorrect).toBe(3);
    expect(clean.perfect).toBe(true);

    const oneSlip = createQuizRun(questions());
    oneSlip.answer(1);
    oneSlip.answer(2); // wrong on question b
    oneSlip.answer(0);
    oneSlip.answer(2);
    expect(oneSlip.finished).toBe(true);
    expect(oneSlip.firstTryCorrect).toBe(2);
    expect(oneSlip.perfect).toBe(false);
  });

  it('is not perfect part way through, even with every answer so far right', () => {
    const run = createQuizRun(questions());
    run.answer(1);
    run.answer(0);
    expect(run.firstTryCorrect).toBe(2);
    expect(run.perfect).toBe(false);
  });

  it('counts a question as first-try only if its first answer was right, however many wrong tries come before the right one later', () => {
    const run = createQuizRun(questions());
    run.answer(0); // wrong
    run.answer(1); // right, but not first try
    expect(run.firstTryCorrect).toBe(0);
    run.answer(0); // question b, right first time
    expect(run.firstTryCorrect).toBe(1);
  });

  it('refuses to start with no questions', () => {
    expect(() => createQuizRun([])).toThrow();
  });

  it('refuses a question that has no right answer or more than one', () => {
    const none = questions();
    none[0].options.forEach((o) => (o.correct = false));
    expect(() => createQuizRun(none)).toThrow(/exactly one/);
    const two = questions();
    two[1].options.forEach((o) => (o.correct = true));
    expect(() => createQuizRun(two)).toThrow(/exactly one/);
  });

  it('does not change the questions it was given', () => {
    const given = questions();
    const before = JSON.stringify(given);
    const run = createQuizRun(given);
    run.answer(0);
    run.answer(1);
    expect(JSON.stringify(given)).toBe(before);
  });
});
