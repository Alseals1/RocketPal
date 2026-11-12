import { describe, it, expect } from 'vitest';
import { APP_TITLE, isDebugOn } from '../src/app';

describe('app', () => {
  it('is called Rocket Pals', () => {
    expect(APP_TITLE).toBe('Rocket Pals');
  });
});

describe('isDebugOn', () => {
  const on = (search: string) => isDebugOn(new URLSearchParams(search));

  it('is on only for ?debug=1', () => {
    expect(on('?debug=1')).toBe(true);
    expect(on('?quality=low&debug=1')).toBe(true);
  });

  it('is off for every other value, and with no value', () => {
    expect(on('?debug=0')).toBe(false);
    expect(on('?debug')).toBe(false);
    expect(on('?debug=')).toBe(false);
    expect(on('?debug=true')).toBe(false);
    expect(on('')).toBe(false);
  });
});
