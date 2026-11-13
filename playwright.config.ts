import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import { e2ePort } from './e2e/port.ts';

const CI = !!process.env.CI;
// The port comes from this checkout's folder (or E2E_PORT), so two checkouts never share one.
const port = e2ePort(path.dirname(fileURLToPath(import.meta.url)), process.env);
const url = `http://localhost:${port}`;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: CI,
  // Software WebGL on a small CI runner is slow, so CI gets more time and one retry.
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: CI ? 60_000 : 30_000,
  reporter: CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: url,
    // Headless Chromium has no graphics card, so it draws WebGL in software.
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url,
    // Never reuse a server that is already running: it could be another checkout's build.
    // If the port is taken, --strictPort makes the run fail loudly instead.
    reuseExistingServer: false,
    timeout: 120_000,
    // Builds the component test page too (gallery/components.html, vite.config.ts).
    env: { ...(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string>), RP_GALLERY: '1' },
  },
});
