/**
 * Known failures that are marked, not hidden. Each one has a follow-up issue.
 * See decisions/2026-11-11-ci-and-e2e-port.md.
 */

/**
 * The page asks for 'Trebuchet MS', which Linux (and ChromeOS) does not have. The wider
 * fallback font makes the title card grow into the buttons at some sizes. These tests are
 * expected to fail on Linux until the layout is fixed; when it is, they pass, Playwright
 * reports "expected to fail, but passed", and this mark must be removed.
 */
export const TITLE_OVERLAP_WITHOUT_TREBUCHET = 'Title card overlaps without Trebuchet MS (Linux, ChromeOS): known layout bug, follow-up issue';
export const noTrebuchetMs = process.platform === 'linux';

/**
 * On the second landing the photo comes from the browser's memory cache, so "loading" can
 * end before a slow CI runner sees it. The game is fine; the test is timing-dependent.
 * Skipped in CI only: it still runs locally.
 */
export const SECOND_LANDING_TIMING = 'Second-landing loading state is too brief to catch on a slow CI runner: test timing, follow-up issue';
export const inCi = !!process.env.CI;
