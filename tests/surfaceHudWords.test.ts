import { describe, expect, it } from 'vitest';
import { loadingLine } from '../src/ui/surfaceHud';

describe('loadingLine', () => {
  it('says "Flying to" on a fly-by, never "Landing"', () => {
    expect(loadingLine({ title: 'Flying past Jupiter', wording: 'flyingPast' })).toBe('Flying to Jupiter...');
    expect(loadingLine({ title: 'Flying past the Moon', wording: 'flyingPast' })).toBe('Flying to the Moon...');
  });

  it('says "Landing on" and the place name where the kid lands', () => {
    expect(loadingLine({ title: 'Jezero Crater, Mars', wording: 'landed' })).toBe('Landing on Jezero Crater...');
  });
});
