import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('the Game shell (#32)', () => {
  it('stays under 150 lines: screen code belongs in its screen, not in Game', () => {
    const lines = readFileSync('src/app/game.ts', 'utf8').trimEnd().split('\n');
    expect(lines.length).toBeLessThan(150);
  });
});
