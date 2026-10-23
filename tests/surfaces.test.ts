import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import surfacesJson from '../public/data/surfaces.json';
import { validateSurfaces } from '../src/data/surfaces';
import { cylindricalPhotoToAzEl } from '../src/surface/geometry';

const WORLDS = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const copy = () => structuredClone(surfacesJson) as any;

describe('surfaces.json', () => {
  it('is valid as shipped', () => {
    expect(validateSurfaces(surfacesJson, WORLDS)).toEqual([]);
  });

  it('points at picture files that really exist', () => {
    for (const surface of surfacesJson.surfaces) {
      for (const file of [surface.images.high, surface.images.low]) {
        expect(existsSync(join('public', file)), file).toBe(true);
      }
    }
  });

  it('gives Mars five hotspots, each with at least one NASA page it was checked against', () => {
    const mars = surfacesJson.surfaces.find((s) => s.worldId === 'mars')!;
    expect(mars.hotspots).toHaveLength(5);
    for (const spot of mars.hotspots) {
      expect(spot.sources.length).toBeGreaterThanOrEqual(1);
      for (const url of spot.sources) expect(url).toMatch(/^https:\/\/(science\.)?nasa\.gov\//);
    }
  });

  it('puts every dot on the thing its words are about', () => {
    // Where each feature is in the ORIGINAL NASA photo (9238 x 2451 px), read off the picture by eye as fractions of its
    // width and height. The angles in surfaces.json must agree with the photo's own geometry, to within 2 degrees.
    const photo = { aspect: 9238 / 2451, horizon: 0.088 };
    const inPhoto: Record<string, [number, number]> = {
      rim: [0.32, 0.072], // the far hills on the horizon
      ground: [0.21, 0.452], // red dirt, left of the rover
      rover: [0.625, 0.621], // the white rover deck
      photo: [0.9, 0.358], // open ground on the right
    };
    const mars = surfacesJson.surfaces.find((s) => s.worldId === 'mars')!;
    for (const [id, [x, y]] of Object.entries(inPhoto)) {
      const want = cylindricalPhotoToAzEl(x, y, photo);
      const spot = mars.hotspots.find((h) => h.id === id)!;
      expect(Math.abs(((spot.azimuth - want.azimuth + 540) % 360) - 180), `${id} azimuth`).toBeLessThan(2);
      expect(Math.abs(spot.elevation - want.elevation), `${id} elevation`).toBeLessThan(2);
    }
    // The sky dot sits above the photo's top edge, in the sky, near the bright glow (azimuth about 130).
    const sky = mars.hotspots.find((h) => h.id === 'sky')!;
    expect(sky.elevation).toBeGreaterThan(cylindricalPhotoToAzEl(0.5, 0, photo).elevation + 5);
    expect(Math.abs(sky.azimuth - 130)).toBeLessThan(25);
  });

  it('tells the player which parts of the picture are filled in, not photographed', () => {
    const mars = surfacesJson.surfaces.find((s) => s.worldId === 'mars')!;
    expect(mars.creditNote).toMatch(/filled in/i);
  });

  it('credits NASA for the photo', () => {
    const mars = surfacesJson.surfaces.find((s) => s.worldId === 'mars')!;
    expect(mars.credit).toContain('NASA');
  });
});

describe('validateSurfaces', () => {
  it('rejects data that is not an object', () => {
    expect(validateSurfaces(null, WORLDS).length).toBeGreaterThan(0);
  });

  it('rejects a missing or fake lastChecked date', () => {
    const a = copy();
    delete a.lastChecked;
    expect(validateSurfaces(a, WORLDS)).toContainEqual(expect.stringContaining('lastChecked'));
    const b = copy();
    b.lastChecked = '2026-02-31';
    expect(validateSurfaces(b, WORLDS)).toContainEqual(expect.stringContaining('lastChecked'));
  });

  it('rejects a surface for a world that does not exist, and duplicates', () => {
    const a = copy();
    a.surfaces[0].worldId = 'krypton';
    expect(validateSurfaces(a, WORLDS)).toContainEqual(expect.stringContaining('krypton'));
    const b = copy();
    b.surfaces.push(structuredClone(b.surfaces[0]));
    expect(validateSurfaces(b, WORLDS)).toContainEqual(expect.stringContaining('twice'));
  });

  it('rejects missing credit or picture files', () => {
    const a = copy();
    a.surfaces[0].credit = ' ';
    expect(validateSurfaces(a, WORLDS)).toContainEqual(expect.stringContaining('credit'));
    const b = copy();
    delete b.surfaces[0].images.low;
    expect(validateSurfaces(b, WORLDS)).toContainEqual(expect.stringContaining('images'));
  });

  it('rejects angles that are out of range', () => {
    const a = copy();
    a.surfaces[0].hotspots[0].azimuth = 400;
    expect(validateSurfaces(a, WORLDS)).toContainEqual(expect.stringContaining('azimuth'));
    const b = copy();
    b.surfaces[0].hotspots[0].elevation = 95;
    expect(validateSurfaces(b, WORLDS)).toContainEqual(expect.stringContaining('elevation'));
    const c = copy();
    c.surfaces[0].start.azimuth = -1;
    expect(validateSurfaces(c, WORLDS)).toContainEqual(expect.stringContaining('start'));
  });

  it('rejects text that is too long for a 8 to 10 year old to read in one go', () => {
    const wordy = copy();
    wordy.surfaces[0].hotspots[0].text = Array.from({ length: 60 }, () => 'word').join(' ') + '.';
    expect(validateSurfaces(wordy, WORLDS)).toContainEqual(expect.stringContaining('words'));
    const rambling = copy();
    rambling.surfaces[0].hotspots[0].text = 'One. Two. Three. Four.';
    expect(validateSurfaces(rambling, WORLDS)).toContainEqual(expect.stringContaining('sentences'));
    const longTitle = copy();
    longTitle.surfaces[0].hotspots[0].title = 'x'.repeat(60);
    expect(validateSurfaces(longTitle, WORLDS)).toContainEqual(expect.stringContaining('title'));
  });

  it('rejects hotspots with no source, a non-https source, or no check date', () => {
    const a = copy();
    a.surfaces[0].hotspots[1].sources = ['nasa.gov'];
    expect(validateSurfaces(a, WORLDS)).toContainEqual(expect.stringContaining('sources'));
    const none = copy();
    none.surfaces[0].hotspots[1].sources = [];
    expect(validateSurfaces(none, WORLDS)).toContainEqual(expect.stringContaining('sources'));
    const b = copy();
    delete b.surfaces[0].hotspots[1].lastChecked;
    expect(validateSurfaces(b, WORLDS)).toContainEqual(expect.stringContaining('lastChecked'));
  });

  it('rejects duplicate hotspot ids and an empty hotspot list', () => {
    const a = copy();
    a.surfaces[0].hotspots[1].id = a.surfaces[0].hotspots[0].id;
    expect(validateSurfaces(a, WORLDS)).toContainEqual(expect.stringContaining('duplicate'));
    const b = copy();
    b.surfaces[0].hotspots = [];
    expect(validateSurfaces(b, WORLDS)).toContainEqual(expect.stringContaining('hotspots'));
  });
});
