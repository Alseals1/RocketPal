import path from 'node:path';

// Each checkout (the main folder and every G.O.A.T. worktree) gets its own
// browser-test port, so two test runs at the same time never test each
// other's build. E2E_PORT overrides the port.

const FIRST_PORT = 4200;
const PORT_COUNT = 800; // 4200 to 4999

export function e2ePort(folder: string, env: { E2E_PORT?: string }): number {
  const override = env.E2E_PORT;
  if (override !== undefined) {
    const port = /^\d+$/.test(override) ? Number(override) : NaN;
    if (!(port >= 1024 && port <= 65535)) {
      throw new Error(`E2E_PORT must be a whole number from 1024 to 65535 (got "${override}")`);
    }
    return port;
  }
  return FIRST_PORT + (fnv1a(path.resolve(folder)) % PORT_COUNT);
}

// FNV-1a, 32 bit: a small, stable string hash.
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
