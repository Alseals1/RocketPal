/**
 * Which radio a key moves to, like any radio group: arrows move and wrap round, Home goes to the first,
 * End to the last. Returns undefined for any other key (or no radios), so the caller lets it through.
 */
export function nextRadioIndex(at: number, key: string, count: number): number | undefined {
  if (count <= 0) return undefined;
  const move: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  if (key in move) return (((at + move[key]) % count) + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return undefined;
}
