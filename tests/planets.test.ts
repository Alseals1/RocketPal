import { describe, it, expect } from 'vitest';
import planetsJson from '../public/data/planets.json';
import { validatePlanets } from '../src/data/planets';

const WORLD_IDS = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// A fresh deep copy so each test can break the data in its own way.
const copy = () => structuredClone(planetsJson) as any;

describe('planets.json', () => {
  it('is valid as shipped', () => {
    expect(validatePlanets(planetsJson)).toEqual([]);
  });

  it('has exactly the ten worlds, in journey order', () => {
    expect(planetsJson.worlds.map((w) => w.id)).toEqual(WORLD_IDS);
  });

  it('flags moon counts that can still change for checking', () => {
    const verify = planetsJson.worlds.filter((w) => w.moons.verify).map((w) => w.id);
    expect(verify).toEqual(['jupiter', 'saturn', 'uranus', 'neptune']);
  });
});

describe('validatePlanets', () => {
  it('rejects a missing lastChecked date', () => {
    const data = copy();
    delete data.lastChecked;
    expect(validatePlanets(data)).toContainEqual(expect.stringContaining('lastChecked'));
  });

  it('rejects a lastChecked that is not a real YYYY-MM-DD date', () => {
    const data = copy();
    data.lastChecked = '2026-13-45';
    expect(validatePlanets(data)).toContainEqual(expect.stringContaining('lastChecked'));
  });

  it('rejects a missing world', () => {
    const data = copy();
    data.worlds = data.worlds.filter((w: any) => w.id !== 'mars');
    expect(validatePlanets(data)).toContainEqual(expect.stringContaining('mars'));
  });

  it('rejects duplicate ids', () => {
    const data = copy();
    data.worlds[2].id = 'mercury';
    expect(validatePlanets(data)).toContainEqual(expect.stringContaining('duplicate'));
  });

  it('rejects a diameter that is not a positive number', () => {
    const data = copy();
    data.worlds[3].diameterKm = -5;
    expect(validatePlanets(data)).toContainEqual(expect.stringContaining('earth'));
  });

  it('rejects a moon whose parent does not exist', () => {
    const data = copy();
    data.worlds[4].parent = 'krypton';
    expect(validatePlanets(data)).toContainEqual(expect.stringContaining('parent'));
  });

  it('rejects an empty hook', () => {
    const data = copy();
    data.worlds[1].hook = '  ';
    expect(validatePlanets(data)).toContainEqual(expect.stringContaining('hook'));
  });

  it('rejects data that is not an object', () => {
    expect(validatePlanets(null).length).toBeGreaterThan(0);
  });
});
