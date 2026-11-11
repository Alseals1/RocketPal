/** Small checks shared by the data validators (planets, surfaces, quizzes, missions). */

export const isText = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0;

export const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export const sentences = (text: string) => (text.match(/[.!?]+(\s|$)/g) ?? []).length || (text.trim() ? 1 : 0);

/** A date written like 2026-10-23 that is a real day. */
export function isRealDate(s: unknown): boolean {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/** Lower case with single spaces, so a phrase can be looked for in a sentence however it was typed. */
export const plain = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

const STOP_WORDS = new Set(
  'a an the of in on at to is are was were be been it its and or that this these those they them their there for from by with as so than then we you your our can do does did not no also all any each very just'.split(' '),
);

/** The words that carry the meaning of a sentence: lower case, no little words, a trailing "s" taken off ("rocks" and "rock" match). */
export function contentWords(text: string): string[] {
  return (plain(text).match(/[a-z0-9.]+/g) ?? [])
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
}
