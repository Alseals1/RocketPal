/**
 * Every file the game loads through the `AssetManager` (docs/TECHNICAL_ARCHITECTURE.md 4.15 and 5.11): its high and
 * low URL, the size of the high file in bytes, and its row id in `CREDITS.md`. `tests/assetManifest.test.ts` checks
 * each entry against the files on disk, the budgets below and `CREDITS.md`.
 *
 * Platform layer (decisions/2026-11-13-asset-manager.md).
 */
import type { AssetId } from '../data/ids';
import type { AssetEntry } from '../platform/assets';

export const ASSET_ENTRIES: readonly AssetEntry[] = [
  { id: 'model/ship', type: 'model', url: { high: '/models/ship.glb' }, bytes: 37312, credit: 'ship' },
  {
    id: 'photo/mars',
    type: 'texture',
    url: { high: '/textures/surfaces/mars-jezero-4096.jpg', low: '/textures/surfaces/mars-jezero-2048.jpg' },
    bytes: 794849,
    credit: 'mars-jezero',
  },
  // A window view only fills part of the screen, so it never needs the big picture (#31): earth-iss-4096.jpg stays on
  // disk and in CREDITS.md, but is left out here on purpose.
  { id: 'photo/earth', type: 'texture', url: { high: '/textures/surfaces/earth-iss-2048.jpg' }, bytes: 546539, credit: 'earth-iss' },
];

/** The most bytes one file of each type may have (`high` and `low` for textures). */
export const ASSET_BUDGET_BYTES = {
  texture: { high: 1_500_000, low: 600_000 },
  model: 500_000,
  image: 200_000,
  sound: 500_000,
  font: 200_000,
} as const;

/** The landing photo of a world. */
export function arrivalPhotoId(worldId: string): AssetId {
  return `photo/${worldId}`;
}
