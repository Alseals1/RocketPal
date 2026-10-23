import { describe, it, expect } from 'vitest';
import { APP_TITLE } from '../src/app';

describe('app', () => {
  it('is called Rocket Pals', () => {
    expect(APP_TITLE).toBe('Rocket Pals');
  });
});
