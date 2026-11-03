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
