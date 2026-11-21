// Makes the game's sound effects (#34): ten short, soft sounds, synthesised from sine and triangle tones and a little
// seeded noise, written as mono 16-bit WAV files at 22,050 Hz into public/sounds/. Nothing is downloaded or sampled, so
// the sounds are original work with no licence to approve (CREDITS.md, row `sounds`).
//
// Run with `node tools/make-sounds.ts` after changing a recipe. The output is the same every time:
// tests/sounds.test.ts renders every recipe again and checks the bytes match the committed files.
// Node runs this file directly (type stripping), so keep to plain, erasable TypeScript.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SAMPLE_RATE = 22050;
/** The loudest any sample may be: -6 dBFS, so nothing is harsh or clips. */
export const PEAK = 0.5;

export interface Tone {
  /** Start, in seconds from the start of the sound. */
  at: number;
  /** How long the tone lasts, in seconds (its decay ends here). */
  length: number;
  /** Frequency in Hz; glides to `toFreq` over the tone when that is given. */
  freq: number;
  toFreq?: number;
  wave: 'sine' | 'triangle';
  /** Relative loudness before the whole sound is scaled to its peak. */
  gain: number;
  /** Attack in seconds (5 to 20 ms keeps the start soft, with no click). */
  attack?: number;
}

export interface Noise {
  at: number;
  length: number;
  gain: number;
  /** One-pole low-pass cutoff in Hz at the start and the end: low numbers give a soft whoosh, not a hiss. */
  cutoff: number;
  toCutoff: number;
  /** Fraction of the length spent rising before it fades: a swell, not a hit. */
  swell: number;
}

export interface SoundRecipe {
  id: string;
  /** Total length in seconds. */
  length: number;
  /** The loudest sample, at most `PEAK`. */
  peak: number;
  tones: Tone[];
  noise?: Noise;
}

const note = (at: number, length: number, freq: number, gain = 1, wave: Tone['wave'] = 'sine'): Tone => ({ at, length, freq, gain, wave, attack: 0.008 });

/** Note frequencies (equal temperament, A4 = 440 Hz). */
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const E6 = 1318.51;
const G6 = 1567.98;
const G4 = 392;
const C4 = 261.63;
const E4 = 329.63;
const A4 = 440;

/** The ten sounds, in the order of sounds.json. Soft tones, smooth decays, nothing like a buzzer or an alarm. */
export const SOUND_RECIPES: readonly SoundRecipe[] = [
  {
    id: 'boost',
    length: 0.45,
    peak: 0.35,
    tones: [{ at: 0, length: 0.45, freq: 110, toFreq: 165, wave: 'sine', gain: 0.5, attack: 0.06 }],
    noise: { at: 0, length: 0.45, gain: 1, cutoff: 300, toCutoff: 1400, swell: 0.35 },
  },
  { id: 'capsule', length: 0.3, peak: 0.4, tones: [note(0, 0.14, E5, 1, 'triangle'), note(0.09, 0.21, A5, 1, 'triangle')] },
  { id: 'dot-found', length: 0.45, peak: 0.42, tones: [note(0, 0.45, C6), note(0, 0.45, G6, 0.25), note(0, 0.3, E6, 0.2)] },
  { id: 'docking', length: 0.6, peak: 0.42, tones: [note(0, 0.32, G4, 1), note(0.2, 0.4, C5, 1), note(0.2, 0.4, G5, 0.2)] },
  { id: 'right', length: 0.4, peak: 0.45, tones: [note(0, 0.2, C5), note(0.1, 0.3, E5), note(0.1, 0.3, C6, 0.15)] },
  // "Not quite": two soft notes stepping down a little. Quiet and warm, so it never sounds like being told off.
  { id: 'not-quite', length: 0.35, peak: 0.3, tones: [note(0, 0.18, A4, 1, 'triangle'), note(0.14, 0.21, E4, 1, 'triangle')] },
  {
    id: 'star',
    length: 0.6,
    peak: 0.4,
    tones: [note(0, 0.3, C6, 0.8), note(0.08, 0.3, E6, 0.8), note(0.16, 0.3, G6, 0.8), note(0.24, 0.36, C6 * 2, 0.5)],
  },
  {
    id: 'rank-up',
    length: 1.2,
    peak: 0.45,
    tones: [
      note(0, 0.25, C5, 1, 'triangle'),
      note(0.18, 0.25, E5, 1, 'triangle'),
      note(0.36, 0.25, G5, 1, 'triangle'),
      note(0.54, 0.66, C6, 1, 'triangle'),
      note(0.54, 0.66, C5, 0.4),
      note(0.54, 0.66, G5, 0.3),
    ],
  },
  { id: 'patch', length: 0.8, peak: 0.42, tones: [note(0, 0.35, G5), note(0.15, 0.4, D5 * 2, 0.8), note(0.3, 0.5, G6, 0.7)] },
  {
    id: 'bump',
    length: 0.25,
    peak: 0.4,
    tones: [{ at: 0, length: 0.25, freq: 95, toFreq: 55, wave: 'sine', gain: 1, attack: 0.005 }, note(0, 0.12, C4, 0.15)],
    noise: { at: 0, length: 0.1, gain: 0.25, cutoff: 400, toCutoff: 200, swell: 0.05 },
  },
];

/** A small seeded random number generator (mulberry32), so the noise is the same on every run. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A soft start, then a smooth fall to silence at the end of the tone (no click at either end). */
function envelope(t: number, length: number, attack: number): number {
  if (t < 0 || t >= length) return 0;
  if (t < attack) return Math.sin(((t / attack) * Math.PI) / 2) ** 2;
  const fall = (t - attack) / Math.max(1e-6, length - attack);
  return (1 - fall) ** 2.2;
}

function wave(kind: Tone['wave'], phase: number): number {
  if (kind === 'sine') return Math.sin(2 * Math.PI * phase);
  const p = phase - Math.floor(phase);
  return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
}

/** The recipe as 16-bit samples, scaled so the loudest one is exactly `recipe.peak`. */
export function renderSound(recipe: SoundRecipe): Int16Array {
  const count = Math.round(recipe.length * SAMPLE_RATE);
  const mix = new Float64Array(count);
  for (const tone of recipe.tones) {
    let phase = 0;
    const attack = tone.attack ?? 0.008;
    for (let i = 0; i < count; i++) {
      const t = i / SAMPLE_RATE - tone.at;
      if (t < 0 || t >= tone.length) continue;
      const freq = tone.toFreq === undefined ? tone.freq : tone.freq + (tone.toFreq - tone.freq) * (t / tone.length);
      mix[i] += tone.gain * envelope(t, tone.length, attack) * wave(tone.wave, phase);
      phase += freq / SAMPLE_RATE;
    }
  }
  if (recipe.noise) {
    const n = recipe.noise;
    const random = seeded(recipe.id.length * 7919 + 17);
    let low = 0;
    for (let i = 0; i < count; i++) {
      const t = i / SAMPLE_RATE - n.at;
      if (t < 0 || t >= n.length) continue;
      const x = t / n.length;
      const cutoff = n.cutoff + (n.toCutoff - n.cutoff) * x;
      const k = 1 - Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE);
      low += k * (random() * 2 - 1 - low);
      const shape = x < n.swell ? Math.sin(((x / n.swell) * Math.PI) / 2) ** 2 : (1 - (x - n.swell) / (1 - n.swell)) ** 2;
      mix[i] += n.gain * shape * low * 3; // the low-pass takes most of the level away; this puts it back
    }
  }
  let loudest = 0;
  for (const v of mix) loudest = Math.max(loudest, Math.abs(v));
  const scale = loudest > 0 ? Math.min(recipe.peak, PEAK) / loudest : 0;
  const samples = new Int16Array(count);
  for (let i = 0; i < count; i++) samples[i] = Math.round(mix[i] * scale * 32767);
  return samples;
}

/** A WAV file: the 44-byte RIFF header (PCM, mono, 16-bit) and the samples, little-endian. */
export function encodeWav(samples: Int16Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const dataBytes = samples.length * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true); // the fmt chunk's size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per sample
  view.setUint16(34, 16, true); // bits per sample
  text(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true);
  return bytes;
}

function main(): void {
  const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sounds');
  mkdirSync(out, { recursive: true });
  let total = 0;
  for (const recipe of SOUND_RECIPES) {
    const bytes = encodeWav(renderSound(recipe));
    writeFileSync(path.join(out, `${recipe.id}.wav`), bytes);
    total += bytes.length;
    console.log(`${recipe.id}.wav  ${bytes.length} bytes`);
  }
  console.log(`total  ${total} bytes`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
