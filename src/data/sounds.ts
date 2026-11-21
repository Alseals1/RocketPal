/**
 * Sounds (docs/TECHNICAL_ARCHITECTURE.md 4.15 and 5.12). `sounds.json` lists each sound effect: its file (an asset id
 * in `src/assets/manifest.ts`), its channel, how loud it is and a short caption. Content layer, so the loader can type
 * `Content.sounds`; `src/platform/audio.ts` re-exports these types. See decisions/2026-11-21-sound-effects-and-listen.md.
 */
import type { AssetId, SoundId } from './ids';
import { isText } from './text';

export type Channel = 'effects' | 'music' | 'voice';
export interface SoundDef {
  id: SoundId;
  file: AssetId;
  channel: Channel;
  volume: number;
  caption: string;
}

export const CHANNELS = ['effects', 'music', 'voice'] as const satisfies readonly Channel[];

export const SOUND_LIMITS = { captionChars: 40 };

const SOUND_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SOUND_FILE = /^sound\/[a-z0-9]+(-[a-z0-9]+)*$/;

/** The name a sound's problems start with. */
export function soundLabel(raw: unknown): string {
  const id = (raw as Record<string, unknown> | null)?.id;
  return typeof id === 'string' && SOUND_ID.test(id) ? id : '(sound without an id)';
}

/** The checks on the sounds file as a whole. An empty list means it can be read. */
export function validateSoundsFile(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return ['sound data must be an object'];
  return Array.isArray((raw as Record<string, unknown>).sounds) ? [] : ['sounds must be a list'];
}

/** The checks on one sound. An empty list means it is valid. */
export function validateSound(raw: unknown): string[] {
  const s = raw as Record<string, any> | null; // typed loosely: every read allows for a missing field
  const label = soundLabel(s);
  const problems: string[] = [];
  const say = (problem: string) => problems.push(`${label}: ${problem}`);
  if (label !== s?.id) say('id is required: lowercase letters and digits joined by single dashes');
  if (typeof s?.file !== 'string' || !SOUND_FILE.test(s.file)) say('file must be an asset id like "sound/dot-found"');
  if (!(CHANNELS as readonly unknown[]).includes(s?.channel)) say(`channel must be one of ${CHANNELS.join(', ')}`);
  if (typeof s?.volume !== 'number' || !Number.isFinite(s.volume) || s.volume < 0 || s.volume > 1) say('volume must be a number from 0 to 1');
  if (!isText(s?.caption) || s.caption.length > SOUND_LIMITS.captionChars) say(`caption is required and at most ${SOUND_LIMITS.captionChars} characters`);
  return problems;
}
