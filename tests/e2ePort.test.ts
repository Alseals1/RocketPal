import { describe, expect, it } from 'vitest';
import { e2ePort } from '../e2e/port';

const MAIN = '/Users/someone/Desktop/Rocket Pals';
const WORKTREE_27 = '/Users/someone/Desktop/Rocket Pals-goat/27';
const WORKTREE_28 = '/Users/someone/Desktop/Rocket Pals-goat/28';

describe('e2ePort', () => {
  it('gives the same port every time for the same folder', () => {
    expect(e2ePort(MAIN, {})).toBe(e2ePort(MAIN, {}));
  });

  it('ignores a trailing slash and ".." segments', () => {
    expect(e2ePort(`${WORKTREE_27}/`, {})).toBe(e2ePort(WORKTREE_27, {}));
    expect(e2ePort(`${WORKTREE_27}/e2e/..`, {})).toBe(e2ePort(WORKTREE_27, {}));
  });

  it('always picks a port from 4200 to 4999', () => {
    for (let i = 0; i < 200; i++) {
      const port = e2ePort(`/home/runner/work/checkout-${i}`, {});
      expect(port).toBeGreaterThanOrEqual(4200);
      expect(port).toBeLessThanOrEqual(4999);
      expect(Number.isInteger(port)).toBe(true);
    }
  });

  it('gives the main checkout and two worktrees different ports', () => {
    const ports = new Set([e2ePort(MAIN, {}), e2ePort(WORKTREE_27, {}), e2ePort(WORKTREE_28, {})]);
    expect(ports.size).toBe(3);
  });

  it('uses E2E_PORT when it is set', () => {
    expect(e2ePort(MAIN, { E2E_PORT: '4321' })).toBe(4321);
    expect(e2ePort(MAIN, { E2E_PORT: '1024' })).toBe(1024);
    expect(e2ePort(MAIN, { E2E_PORT: '65535' })).toBe(65535);
  });

  it.each(['abc', '80', '70000', '', '43.5', '-4300', ' 4300'])('refuses E2E_PORT=%j with a clear error', (value) => {
    expect(() => e2ePort(MAIN, { E2E_PORT: value })).toThrow(
      `E2E_PORT must be a whole number from 1024 to 65535 (got "${value}")`,
    );
  });
});
