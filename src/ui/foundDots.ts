/**
 * Which dots show as found on an arrival view. A dot is found if the save has it (from any earlier visit, or another
 * window of the game) or if the kid opened it on this visit. Only dots on this picture count.
 */
export interface FoundView {
  found: ReadonlySet<string>;
  /** Every dot on the picture is found. */
  all: boolean;
}

export function foundView(saved: Iterable<string>, opened: Iterable<string>, hotspotIds: readonly string[]): FoundView {
  const onPicture = new Set(hotspotIds);
  const found = new Set<string>();
  for (const id of [...saved, ...opened]) if (onPicture.has(id)) found.add(id);
  return { found, all: hotspotIds.length > 0 && found.size === onPicture.size };
}
