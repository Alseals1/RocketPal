import { describe, expect, it } from 'vitest';
import { CONDITION_TYPES, validateCondition, type ConditionContext } from '../src/data/conditions';

const ctx: ConditionContext = {
  places: new Set(['earth', 'mars', 'venus']),
  dotsAt: (place) => ({ earth: 6, mars: 5 } as Record<string, number>)[place],
  quizPlaces: new Set(['earth', 'mars']),
  missionIds: new Set(['find-3-mars']),
};
const check = (c: unknown, path?: string) => validateCondition(c, ctx, path);

describe('validateCondition', () => {
  it('accepts a good condition of every supported kind', () => {
    expect(check({ type: 'visited', place: 'venus' })).toEqual([]);
    expect(check({ type: 'dotsFound', place: 'mars', count: 3 })).toEqual([]);
    expect(check({ type: 'dotsFound', place: 'mars', count: 5 })).toEqual([]);
    expect(check({ type: 'quizDone', place: 'earth' })).toEqual([]);
    expect(check({ type: 'quizDone', place: 'earth', perfect: true })).toEqual([]);
    expect(check({ type: 'starsAt', place: 'venus', count: 3 })).toEqual([]);
    expect(check({ type: 'capsules', count: 4 })).toEqual([]);
    expect(check({ type: 'missionDone', mission: 'find-3-mars' })).toEqual([]);
    expect(check({ type: 'all', of: [{ type: 'visited', place: 'mars' }] })).toEqual([]);
    expect(check({ type: 'any', of: [{ type: 'visited', place: 'mars' }, { type: 'capsules', count: 1 }] })).toEqual([]);
  });

  it('rejects something that is not a condition', () => {
    expect(check(null)).toEqual(['goal must be a condition']);
    expect(check([])).toEqual(['goal must be a condition']);
    expect(check({})).toEqual(['goal needs a type']);
  });

  it('rejects the kinds whose content does not exist yet, and unknown kinds', () => {
    for (const type of ['rank', 'chapterDone', 'patch', 'courseDone', 'activityDone', 'teleport']) {
      expect(check({ type })).toEqual([`goal: "${type}" is not supported yet`]);
    }
  });

  it('knows every kind in the type', () => {
    expect(CONDITION_TYPES).toHaveLength(13);
  });

  it('visited needs a place in planets.json', () => {
    expect(check({ type: 'visited', place: 'pluto' })).toEqual(['goal: visited place must be a world in planets.json']);
  });

  it('dotsFound needs a place with a picture and a count from 1 to its dots', () => {
    expect(check({ type: 'dotsFound', place: 'mars', count: 6 })).toEqual([
      'goal: dotsFound count must be a whole number from 1 to the number of dots on the picture (5)',
    ]);
    expect(check({ type: 'dotsFound', place: 'mars', count: 0 })).toHaveLength(1);
    expect(check({ type: 'dotsFound', place: 'mars', count: 1.5 })).toHaveLength(1);
    expect(check({ type: 'dotsFound', place: 'venus', count: 1 })).toEqual(['goal: dotsFound place must be a world with a landing picture']);
    expect(check({ type: 'dotsFound', place: 'pluto', count: 'x' })).toEqual([
      'goal: dotsFound place must be a world with a landing picture',
      'goal: dotsFound count must be a whole number from 1 to the number of dots on the picture',
    ]);
  });

  it('quizDone needs a place with a quiz and an optional true or false', () => {
    expect(check({ type: 'quizDone', place: 'venus' })).toEqual(['goal: quizDone place must be a world with a quiz']);
    expect(check({ type: 'quizDone', place: 'mars', perfect: 'yes' })).toEqual(['goal: quizDone perfect must be true or false']);
  });

  it('starsAt needs a place and a count from 1 to 3', () => {
    expect(check({ type: 'starsAt', place: 'mars', count: 4 })).toEqual(['goal: starsAt count must be a whole number from 1 to 3']);
    expect(check({ type: 'starsAt', place: 'nowhere', count: 1 })).toEqual(['goal: starsAt place must be a world in planets.json']);
  });

  it('capsules needs a count of at least 1', () => {
    expect(check({ type: 'capsules', count: 0 })).toEqual(['goal: capsules count must be a whole number of at least 1']);
  });

  it('missionDone needs a mission in missions.json', () => {
    expect(check({ type: 'missionDone', mission: 'find-3-venus' })).toEqual(['goal: missionDone mission must be a mission in missions.json']);
  });

  it('all and any need a list, and check each child with its own path', () => {
    expect(check({ type: 'all', of: [] })).toEqual(['goal: all needs a list of at least one condition']);
    expect(check({ type: 'any' })).toEqual(['goal: any needs a list of at least one condition']);
    expect(check({ type: 'all', of: [{ type: 'visited', place: 'mars' }, { type: 'any', of: [{ type: 'rank', atLeast: 2 }] }] })).toEqual([
      'goal.of[1].of[0]: "rank" is not supported yet',
    ]);
  });

  it('starts each message with the path it was given', () => {
    expect(check({ type: 'visited', place: 'x' }, 'available')).toEqual(['available: visited place must be a world in planets.json']);
  });
});
