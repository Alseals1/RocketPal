import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The component test page (gallery/components.html) is built only for the browser tests, which set
// RP_GALLERY=1 (playwright.config.ts). A normal build ships only the game.
const gallery = process.env.RP_GALLERY === '1';
const page = (file: string) => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  build: {
    // Three.js alone is about 550 kB. The whole game is far under the 15 MB budget, so this is not a problem.
    chunkSizeWarningLimit: 700,
    rolldownOptions: gallery ? { input: { main: page('./index.html'), gallery: page('./gallery/components.html') } } : {},
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
