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
  // The sound effects (#34): made by tools/make-sounds.ts, played through the AudioManager, which preloads them after
  // the first tap or key.
  { id: 'sound/boost', type: 'sound', url: { high: '/sounds/boost.wav' }, bytes: 19890, credit: 'sounds' },
  { id: 'sound/capsule', type: 'sound', url: { high: '/sounds/capsule.wav' }, bytes: 13274, credit: 'sounds' },
  { id: 'sound/dot-found', type: 'sound', url: { high: '/sounds/dot-found.wav' }, bytes: 19890, credit: 'sounds' },
  { id: 'sound/docking', type: 'sound', url: { high: '/sounds/docking.wav' }, bytes: 26504, credit: 'sounds' },
  { id: 'sound/right', type: 'sound', url: { high: '/sounds/right.wav' }, bytes: 17684, credit: 'sounds' },
  { id: 'sound/not-quite', type: 'sound', url: { high: '/sounds/not-quite.wav' }, bytes: 15478, credit: 'sounds' },
  { id: 'sound/star', type: 'sound', url: { high: '/sounds/star.wav' }, bytes: 26504, credit: 'sounds' },
  { id: 'sound/rank-up', type: 'sound', url: { high: '/sounds/rank-up.wav' }, bytes: 52964, credit: 'sounds' },
  { id: 'sound/patch', type: 'sound', url: { high: '/sounds/patch.wav' }, bytes: 35324, credit: 'sounds' },
  { id: 'sound/bump', type: 'sound', url: { high: '/sounds/bump.wav' }, bytes: 11070, credit: 'sounds' },
  // The Star Map's planet thumbnails (#42): 128 x 128 WebP, made by tools/make-thumbnails.ts from the scene's own
  // procedural textures. Re-run the script when makeWorldTexture changes.
  { id: 'thumb/sun', type: 'image', url: { high: '/thumbnails/sun.webp' }, bytes: 5500, credit: 'thumbnails' },
  { id: 'thumb/mercury', type: 'image', url: { high: '/thumbnails/mercury.webp' }, bytes: 2382, credit: 'thumbnails' },
  { id: 'thumb/venus', type: 'image', url: { high: '/thumbnails/venus.webp' }, bytes: 2806, credit: 'thumbnails' },
  { id: 'thumb/earth', type: 'image', url: { high: '/thumbnails/earth.webp' }, bytes: 3122, credit: 'thumbnails' },
  { id: 'thumb/moon', type: 'image', url: { high: '/thumbnails/moon.webp' }, bytes: 2438, credit: 'thumbnails' },
  { id: 'thumb/mars', type: 'image', url: { high: '/thumbnails/mars.webp' }, bytes: 2762, credit: 'thumbnails' },
  { id: 'thumb/jupiter', type: 'image', url: { high: '/thumbnails/jupiter.webp' }, bytes: 2792, credit: 'thumbnails' },
  { id: 'thumb/saturn', type: 'image', url: { high: '/thumbnails/saturn.webp' }, bytes: 2548, credit: 'thumbnails' },
  { id: 'thumb/uranus', type: 'image', url: { high: '/thumbnails/uranus.webp' }, bytes: 2748, credit: 'thumbnails' },
  { id: 'thumb/neptune', type: 'image', url: { high: '/thumbnails/neptune.webp' }, bytes: 2820, credit: 'thumbnails' },
];

/** The most bytes one file of each type may have (`high` and `low` for textures). */
export const ASSET_BUDGET_BYTES = {
  texture: { high: 1_500_000, low: 600_000 },
  model: 500_000,
  image: 200_000,
  sound: 500_000,
  font: 200_000,
} as const;

/** All the sound files together may be at most this big (#34: small, and loaded only after the first tap or key). */
export const SOUND_TOTAL_BUDGET_BYTES = 500_000;

/** The URL of an asset's (high) file, or `undefined` for an id the manifest does not have. */
export function assetUrl(id: AssetId): string | undefined {
  return ASSET_ENTRIES.find((e) => e.id === id)?.url.high;
}

/** The landing photo of a world. */
export function arrivalPhotoId(worldId: string): AssetId {
  return `photo/${worldId}`;
}

/** The Star Map thumbnail of a world (#42). */
export function thumbnailId(worldId: string): AssetId {
  return `thumb/${worldId}`;
}
