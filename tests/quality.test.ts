import { describe, it, expect } from 'vitest';
import { initialQuality, chooseQuality, qualitySettings, rendererOptions, prefersLowAssets } from '../src/quality/quality';

const frames = (ms: number, count: number) => Array.from({ length: count }, () => ms);

describe('initialQuality', () => {
  it('starts low on weak hardware', () => {
    expect(initialQuality({ deviceMemory: 2 })).toBe('low');
    expect(initialQuality({ hardwareConcurrency: 2 })).toBe('low');
  });

  it('starts low on a typical school Chromebook: 4 GB or 4 cores (#31)', () => {
    expect(initialQuality({ deviceMemory: 4, hardwareConcurrency: 8 })).toBe('low');
    expect(initialQuality({ deviceMemory: 8, hardwareConcurrency: 4 })).toBe('low');
    expect(initialQuality({ deviceMemory: 4, hardwareConcurrency: 4 })).toBe('low');
  });

  it('starts high on normal hardware, or when the browser does not say', () => {
    expect(initialQuality({ deviceMemory: 8, hardwareConcurrency: 8 })).toBe('high');
    expect(initialQuality({ deviceMemory: 8, hardwareConcurrency: 5 })).toBe('high');
    expect(initialQuality({ deviceMemory: 8 })).toBe('high');
    expect(initialQuality({})).toBe('high');
  });
});

describe('rendererOptions', () => {
  it('low quality has no antialiasing and draws at pixel ratio 1, even on a sharp screen', () => {
    expect(rendererOptions('low', 2)).toEqual({ antialias: false, pixelRatio: 1 });
  });

  it('high quality has antialiasing and draws at most at pixel ratio 2', () => {
    expect(rendererOptions('high', 3)).toEqual({ antialias: true, pixelRatio: 2 });
    expect(rendererOptions('high', 1.5)).toEqual({ antialias: true, pixelRatio: 1.5 });
  });

  it('a missing or zero pixel ratio counts as 1', () => {
    expect(rendererOptions('high', 0).pixelRatio).toBe(1);
    expect(rendererOptions('high', undefined).pixelRatio).toBe(1);
    expect(rendererOptions('low', Number.NaN).pixelRatio).toBe(1);
  });
});

describe('prefersLowAssets', () => {
  it('loads the big files only at high quality on a card that can hold a 4096 picture', () => {
    expect(prefersLowAssets('high', 16384)).toBe(false);
    expect(prefersLowAssets('high', 4096)).toBe(false);
    expect(prefersLowAssets('high', 2048)).toBe(true);
  });

  it('loads the small files at low quality, whatever the card', () => {
    expect(prefersLowAssets('low', 16384)).toBe(true);
  });
});

describe('chooseQuality', () => {
  it('stays high when the game runs smoothly (60 fps)', () => {
    expect(chooseQuality(frames(16.7, 90), 'high')).toBe('high');
  });

  it('drops to low when the game runs slowly (25 fps)', () => {
    expect(chooseQuality(frames(40, 90), 'high')).toBe('low');
  });

  it('does not judge on too few frames', () => {
    expect(chooseQuality(frames(100, 5), 'high')).toBe('high');
  });

  it('ignores a single hitch among smooth frames', () => {
    const samples = [...frames(16.7, 60), 400, ...frames(16.7, 29)];
    expect(chooseQuality(samples, 'high')).toBe('high');
  });

  it('never goes back up by itself once low, so quality does not flicker', () => {
    expect(chooseQuality(frames(8, 90), 'low')).toBe('low');
  });
});

describe('qualitySettings', () => {
  it('turns glow and shadows off in low mode', () => {
    const low = qualitySettings('low');
    expect(low.glow).toBe(false);
    expect(low.shadows).toBe(false);
    expect(low.pixelRatioCap).toBe(1);
  });

  it('uses fewer stars in low mode than in high mode', () => {
    expect(qualitySettings('low').starCount).toBeLessThan(qualitySettings('high').starCount);
  });

  it('turns glow and shadows on in high mode', () => {
    const high = qualitySettings('high');
    expect(high.glow).toBe(true);
    expect(high.shadows).toBe(true);
  });
});
