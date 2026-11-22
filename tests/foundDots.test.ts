import { describe, expect, it } from 'vitest';
import { foundView } from '../src/ui/foundDots';

const DOTS = ['rim', 'ground', 'sky'];

describe('foundView', () => {
  it('shows nothing found on a first visit', () => {
    expect(foundView([], [], DOTS)).toEqual({ found: new Set(), all: false });
  });

  it('shows the dots found on earlier visits (from the save)', () => {
    expect([...foundView(['rim', 'sky'], [], DOTS).found]).toEqual(['rim', 'sky']);
  });

  it('adds the dots opened on this visit, each counted once', () => {
    const view = foundView(['rim'], ['rim', 'ground'], DOTS);
    expect(view.found.size).toBe(2);
    expect(view.all).toBe(false);
  });

  it('is all found when every dot is found, from either source', () => {
    expect(foundView(['rim', 'ground'], ['sky'], DOTS).all).toBe(true);
    expect(foundView(DOTS, [], DOTS).all).toBe(true);
  });

  it('ignores ids that are not on this picture (an old save, or a dot taken out of the data)', () => {
    const view = foundView(['rim', 'gone'], ['old'], DOTS);
    expect([...view.found]).toEqual(['rim']);
  });

  it('is never "all found" on a picture with no dots', () => {
    expect(foundView([], [], []).all).toBe(false);
  });
});
