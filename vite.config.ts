import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    // Three.js alone is about 550 kB. The whole game is far under the 15 MB budget, so this is not a problem.
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
