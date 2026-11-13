import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSET_BUDGET_BYTES, ASSET_ENTRIES, arrivalPhotoId } from '../src/assets/manifest';
import type { AssetEntry } from '../src/platform/assets';

const fileSize = (url: string) => statSync(`public${url}`, { throwIfNoEntry: false })?.size;
const filesOf = (entry: AssetEntry) => [entry.url.high, ...(entry.url.low ? [entry.url.low] : [])];

/** The rows of the CREDITS.md table, keyed by their Id cell (written in backticks). */
function creditRows(): Map<string, string> {
  const rows = new Map<string, string>();
  for (const line of readFileSync('CREDITS.md', 'utf8').split('\n')) {
    const id = /^\|\s*`([a-z0-9-]+)`\s*\|/.exec(line)?.[1];
    if (id) {
      expect(rows.has(id), `CREDITS.md id ${id} is used twice`).toBe(false);
      rows.set(id, line);
    }
  }
  return rows;
}

describe('the asset manifest', () => {
  it('has unique ids', () => {
    const ids = ASSET_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(ASSET_ENTRIES.map((e) => [e.id, e] as const))('%s: every file exists under public/', (_id, entry) => {
    for (const url of filesOf(entry)) expect(fileSize(url), url).toBeGreaterThan(0);
  });

  it.each(ASSET_ENTRIES.map((e) => [e.id, e] as const))('%s: bytes is the exact size of the high file', (_id, entry) => {
    expect(entry.bytes).toBe(fileSize(entry.url.high));
  });

  it.each(ASSET_ENTRIES.map((e) => [e.id, e] as const))('%s: stays within its budget, and the low file is smaller', (_id, entry) => {
    const high = fileSize(entry.url.high)!;
    const low = entry.url.low ? fileSize(entry.url.low)! : undefined;
    if (entry.type === 'texture') {
      expect(high).toBeLessThanOrEqual(ASSET_BUDGET_BYTES.texture.high);
      if (low !== undefined) expect(low).toBeLessThanOrEqual(ASSET_BUDGET_BYTES.texture.low);
    } else {
      expect(high).toBeLessThanOrEqual(ASSET_BUDGET_BYTES[entry.type]);
      if (low !== undefined) expect(low).toBeLessThanOrEqual(ASSET_BUDGET_BYTES[entry.type]);
    }
    if (low !== undefined) expect(low).toBeLessThan(high);
  });

  it.each(ASSET_ENTRIES.map((e) => [e.id, e] as const))('%s: has a CREDITS.md row that lists every one of its files', (_id, entry) => {
    const row = creditRows().get(entry.credit);
    expect(row, `no CREDITS.md row with the id \`${entry.credit}\``).toBeDefined();
    for (const url of filesOf(entry)) expect(row).toContain(`\`public${url}\``);
  });

  it('covers every landing photo: each surface has a photo entry whose files are among its images', () => {
    const { surfaces } = JSON.parse(readFileSync('public/data/surfaces.json', 'utf8')) as {
      surfaces: { worldId: string; images: { high: string; low: string } }[];
    };
    expect(surfaces.length).toBeGreaterThan(0);
    for (const surface of surfaces) {
      const entry = ASSET_ENTRIES.find((e) => e.id === arrivalPhotoId(surface.worldId));
      expect(entry, `no manifest entry for ${arrivalPhotoId(surface.worldId)}`).toBeDefined();
      expect(entry!.type).toBe('texture');
      for (const url of filesOf(entry!)) expect([surface.images.high, surface.images.low]).toContain(url);
    }
  });

  it('gives a window view only the 2048 photo (#31)', () => {
    const earth = ASSET_ENTRIES.find((e) => e.id === 'photo/earth')!;
    expect(earth.url).toEqual({ high: '/textures/surfaces/earth-iss-2048.jpg' });
  });

  it('names the landing photo of a world', () => {
    expect(arrivalPhotoId('mars')).toBe('photo/mars');
  });
});
