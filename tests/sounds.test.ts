import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSET_ENTRIES, SOUND_TOTAL_BUDGET_BYTES, assetUrl } from '../src/assets/manifest';
import { validateSound, validateSoundsFile, type SoundDef } from '../src/data/sounds';
import { SAMPLE_RATE, SOUND_RECIPES, encodeWav, renderSound } from '../tools/make-sounds';

const SOUND_IDS = ['boost', 'capsule', 'dot-found', 'docking', 'right', 'not-quite', 'star', 'rank-up', 'patch', 'bump'];
const file = JSON.parse(readFileSync('public/data/sounds.json', 'utf8')) as { sounds: SoundDef[] };
const soundEntries = ASSET_ENTRIES.filter((e) => e.type === 'sound');

/** The header of a WAV file, read the way tools/make-sounds.ts writes it. */
function readWav(bytes: Buffer) {
  const text = (at: number) => bytes.toString('ascii', at, at + 4);
  return {
    riff: text(0),
    wave: text(8),
    format: bytes.readUInt16LE(20),
    channels: bytes.readUInt16LE(22),
    sampleRate: bytes.readUInt32LE(24),
    bits: bytes.readUInt16LE(34),
    dataTag: text(36),
    dataBytes: bytes.readUInt32LE(40),
  };
}

describe('sounds.json', () => {
  it('validates with no problems and lists exactly the ten sounds', () => {
    expect(validateSoundsFile(file)).toEqual([]);
    expect(file.sounds.flatMap(validateSound)).toEqual([]);
    expect(file.sounds.map((s) => s.id)).toEqual(SOUND_IDS);
  });

  it('keeps every sound on the effects channel, gentle (volume at most 0.7) and captioned', () => {
    for (const s of file.sounds) {
      expect(s.channel, s.id).toBe('effects');
      expect(s.volume, s.id).toBeGreaterThan(0);
      expect(s.volume, s.id).toBeLessThanOrEqual(0.7);
      expect(s.caption.trim().length, s.id).toBeGreaterThan(0);
      expect(s.file, s.id).toBe(`sound/${s.id}`);
    }
  });
});

describe('the sound files', () => {
  it.each(file.sounds.map((s) => [s.id, s] as const))('%s: has a sound entry in the manifest whose file exists', (_id, s) => {
    const entry = ASSET_ENTRIES.find((e) => e.id === s.file);
    expect(entry?.type).toBe('sound');
    expect(assetUrl(s.file)).toBe(`/sounds/${s.id}.wav`);
    expect(statSync(`public${entry!.url.high}`).size).toBe(entry!.bytes);
  });

  it.each(soundEntries.map((e) => [e.id, e] as const))('%s: is a mono 16-bit 22,050 Hz WAV of at most 1.5 s', (_id, entry) => {
    const bytes = readFileSync(`public${entry.url.high}`);
    const wav = readWav(bytes);
    expect(wav).toMatchObject({ riff: 'RIFF', wave: 'WAVE', format: 1, channels: 1, sampleRate: 22050, bits: 16, dataTag: 'data' });
    expect(wav.dataBytes).toBe(bytes.length - 44);
    expect(wav.dataBytes / 2 / wav.sampleRate).toBeLessThanOrEqual(1.5);
  });

  it('are under the total budget together', () => {
    const total = soundEntries.reduce((sum, e) => sum + e.bytes, 0);
    expect(soundEntries).toHaveLength(10);
    expect(total).toBeLessThan(SOUND_TOTAL_BUDGET_BYTES);
  });

  it.each(SOUND_RECIPES.map((r) => [r.id, r] as const))('%s: the script makes exactly the committed file', (id, recipe) => {
    const made = encodeWav(renderSound(recipe));
    expect(Buffer.from(made).equals(readFileSync(`public/sounds/${id}.wav`))).toBe(true);
  });

  it('has one recipe per sound, and none peaks above -6 dBFS', () => {
    expect(SOUND_RECIPES.map((r) => r.id)).toEqual(SOUND_IDS);
    for (const recipe of SOUND_RECIPES) {
      const samples = renderSound(recipe);
      expect(samples.length).toBe(Math.round(recipe.length * SAMPLE_RATE));
      const loudest = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(loudest / 32767, recipe.id).toBeLessThanOrEqual(0.5 + 1e-4);
      expect(Math.abs(samples[0]), `${recipe.id} starts softly`).toBeLessThan(200);
      expect(Math.abs(samples[samples.length - 1]), `${recipe.id} ends in silence`).toBeLessThan(200);
    }
  });
});

describe('validateSound', () => {
  const good: SoundDef = { id: 'dot-found', file: 'sound/dot-found', channel: 'effects', volume: 0.5, caption: 'Ding' };

  it('accepts a good sound', () => {
    expect(validateSound(good)).toEqual([]);
  });

  it('rejects a bad id, file, channel, volume or caption', () => {
    expect(validateSound({ ...good, id: 'Dot Found' })[0]).toContain('id is required');
    expect(validateSound({ ...good, file: '/sounds/dot.wav' })).toEqual(['dot-found: file must be an asset id like "sound/dot-found"']);
    expect(validateSound({ ...good, channel: 'loud' })).toEqual(['dot-found: channel must be one of effects, music, voice']);
    expect(validateSound({ ...good, volume: 1.5 })).toEqual(['dot-found: volume must be a number from 0 to 1']);
    expect(validateSound({ ...good, volume: Number.NaN })).toEqual(['dot-found: volume must be a number from 0 to 1']);
    expect(validateSound({ ...good, caption: '  ' })).toEqual(['dot-found: caption is required and at most 40 characters']);
    expect(validateSound({ ...good, caption: 'x'.repeat(41) })).toEqual(['dot-found: caption is required and at most 40 characters']);
    expect(validateSound(null)[0]).toContain('(sound without an id)');
  });

  it('rejects a file that is not a sound list', () => {
    expect(validateSoundsFile([])).toEqual(['sound data must be an object']);
    expect(validateSoundsFile({})).toEqual(['sounds must be a list']);
  });
});
