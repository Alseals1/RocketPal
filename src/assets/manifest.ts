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
  // Fly-by photos (#43): 2048 for high quality (no 4096: a fly-by is a window view), 1024 for low quality.
  {
    id: 'photo/moon',
    type: 'texture',
    url: { high: '/textures/surfaces/moon-art002e009057-2048.jpg', low: '/textures/surfaces/moon-art002e009057-1024.jpg' },
    bytes: 279775,
    credit: 'moon-art002e009057',
  },
  {
    id: 'photo/jupiter',
    type: 'texture',
    url: { high: '/textures/surfaces/jupiter-pia04866-2048.jpg', low: '/textures/surfaces/jupiter-pia04866-1024.jpg' },
    bytes: 257915,
    credit: 'jupiter-pia04866',
  },
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

/** The arrival photo of a place. */
export function arrivalPhotoId(place: string): AssetId {
  return `photo/${place}`;
}
