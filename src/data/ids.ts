/** The shared ids (docs/TECHNICAL_ARCHITECTURE.md section 4.1). Plain strings in the JSON files, typed here. */

export type WorldId = 'sun' | 'mercury' | 'venus' | 'earth' | 'moon' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';
export type PlaceId = WorldId | 'belt'; // a Star Map destination; the belt is a region, not a world
export type DotId = `${PlaceId}/${string}`; // 'mars/rim'
export type CapsuleId = string; // 'light-8-minutes'
export type MissionId = string; // 'tour-2-mars', 'find-3-mars', 'rescue-balloon'
export type ChapterId = 'home' | 'rocky' | 'giants' | 'ice';
export type CourseId = string; // 'belt-cadet'
export type ActivityId = string; // 'belt-run', 'planet-lineup'
export type ItemId = string; // 'paint-mars-red'
export type PatchId = string; // 'first-flight'
export type SoundId = string; // 'dot-found'
export type AssetId = string; // 'tex/jupiter', 'model/ship'

/** The ten worlds, from the Sun outwards (the Moon after Earth). This is also their order on the Star Map. */
export const WORLD_IDS = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'moon',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
] as const satisfies readonly WorldId[];

export function isWorldId(x: unknown): x is WorldId {
  return typeof x === 'string' && (WORLD_IDS as readonly string[]).includes(x);
}
