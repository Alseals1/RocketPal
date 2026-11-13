/**
 * Known failures that are marked, not hidden. Each one has a follow-up issue.
 * See decisions/2026-11-11-ci-and-e2e-port.md.
 */

/**
 * On the second landing the photo comes from the browser's memory cache, so "loading" can
 * end before a slow CI runner sees it. The game is fine; the test is timing-dependent.
 * Skipped in CI only: it still runs locally.
 */
export const SECOND_LANDING_TIMING = 'Second-landing loading state is too brief to catch on a slow CI runner: test timing, follow-up issue';
export const inCi = !!process.env.CI;
