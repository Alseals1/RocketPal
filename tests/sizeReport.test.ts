import { describe, expect, it } from 'vitest';
import { formatBytes, renderSummary, summariseDist } from '../tools/size-report';

describe('summariseDist', () => {
  it('counts .js, .css and .html as code and everything else as assets', () => {
    const summary = summariseDist([
      { path: 'index.html', bytes: 700, gzipBytes: 400 },
      { path: 'assets/index-abc.js', bytes: 600_000, gzipBytes: 160_000 },
      { path: 'assets/index-abc.css', bytes: 12_000, gzipBytes: 3_000 },
      { path: 'models/ship.glb', bytes: 37_000 },
      { path: 'textures/surfaces/earth-iss-4096.jpg', bytes: 2_000_000 },
      { path: 'data/planets.json', bytes: 4_000 },
    ]);
    expect(summary).toEqual({
      codeBytes: 612_700,
      codeGzipBytes: 163_400,
      assetBytes: 2_041_000,
      totalBytes: 2_653_700,
    });
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1000, '1.0 kB'],
    [646_303, '646.3 kB'],
    [999_999, '1000.0 kB'],
    [1_000_000, '1.00 MB'],
    [15_000_000, '15.00 MB'],
  ])('%d bytes is %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});

describe('renderSummary', () => {
  const dist = { codeBytes: 703_000, codeGzipBytes: 181_000, assetBytes: 4_900_000, totalBytes: 5_603_000 };
  const firstPlay = {
    totalBytes: 758_063,
    budgetBytes: 15_000_000,
    files: [
      { path: '/assets/index-abc.js', bytes: 646_303 },
      { path: '/assets/shipModel-def.js', bytes: 45_519 },
      { path: '/models/ship.glb', bytes: 37_312 },
      { path: '/assets/index-abc.css', bytes: 11_648 },
      { path: '/data/surfaces.json', bytes: 7_713 },
      { path: '/data/planets.json', bytes: 4_380 },
    ],
  };

  it('shows the code bundle, the whole dist folder and first play against the budget', () => {
    const text = renderSummary(dist, firstPlay);
    expect(text).toContain('| Code bundle (JS, CSS, HTML) | 703.0 kB (181.0 kB gzip) |');
    expect(text).toContain('| Whole `dist/` | 5.60 MB |');
    expect(text).toContain('| First play | 758.1 kB of 15.00 MB (5%) ✅ |');
  });

  it('lists the five largest first-play files, largest first', () => {
    const text = renderSummary(dist, firstPlay);
    expect(text).toContain('| `/assets/index-abc.js` | 646.3 kB |');
    expect(text).toContain('| `/data/surfaces.json` | 7.7 kB |');
    expect(text).not.toContain('planets.json');
    expect(text.indexOf('index-abc.js')).toBeLessThan(text.indexOf('ship.glb'));
  });

  it('marks first play over budget', () => {
    const text = renderSummary(dist, { ...firstPlay, totalBytes: 15_000_000 });
    expect(text).toContain('| First play | 15.00 MB of 15.00 MB (100%) ❌ over budget |');
  });

  it('says "not measured" for first play when the browser test did not write its file', () => {
    const text = renderSummary(dist, null);
    expect(text).toContain('| First play | not measured |');
    expect(text).toContain('| Whole `dist/` | 5.60 MB |');
    expect(text).not.toContain('Largest first-play files');
  });

  it('says "not measured" for the bundle when there is no dist folder', () => {
    const text = renderSummary(null, firstPlay);
    expect(text).toContain('| Code bundle (JS, CSS, HTML) | not measured |');
    expect(text).toContain('| Whole `dist/` | not measured |');
    expect(text).toContain('| First play | 758.1 kB of 15.00 MB (5%) ✅ |');
  });
});
