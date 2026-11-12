import { describe, it, expect } from 'vitest';
import planetsJson from '../public/data/planets.json';
import type { World } from '../src/data/planets';
import {
  formatDistanceKm,
  lightTravelSeconds,
  formatDuration,
  distanceBetweenKm,
  realDistanceRemainingKm,
  realSpeedKmPerSec,
  formatSpeed,
  pretendSpeedNote,
  timesLightSpeed,
  REAL_ROCKET_COMPARISON,
} from '../src/scale/readout';

const worlds = planetsJson.worlds as World[];
const world = (id: string) => worlds.find((w) => w.id === id)!;

describe('formatDistanceKm', () => {
  it('writes small distances in plain km with a thousands comma', () => {
    expect(formatDistanceKm(900)).toBe('900 km');
    expect(formatDistanceKm(384_400)).toBe('384,400 km');
  });

  it('writes millions and billions the way a kid would say them', () => {
    expect(formatDistanceKm(57_900_000)).toBe('57.9 million km');
    expect(formatDistanceKm(149_600_000)).toBe('149.6 million km');
    expect(formatDistanceKm(1_432_000_000)).toBe('1.4 billion km');
    expect(formatDistanceKm(4_515_000_000)).toBe('4.5 billion km');
  });

  it('moves up a unit instead of showing 1000.0 million or 1,000,000 km', () => {
    expect(formatDistanceKm(999_999.6)).toBe('1.0 million km');
    expect(formatDistanceKm(999_960_000)).toBe('1.0 billion km');
  });
});

describe('lightTravelSeconds', () => {
  it('takes light about 8 minutes (499 s) to get from the Sun to Earth', () => {
    expect(lightTravelSeconds(149_600_000)).toBeCloseTo(499, 0);
  });

  it('takes light about 1.3 seconds to get from the Moon to Earth', () => {
    expect(lightTravelSeconds(384_400)).toBeCloseTo(1.28, 2);
  });
});

describe('formatDuration', () => {
  it('uses one decimal for very short times', () => {
    expect(formatDuration(1.28)).toBe('1.3 seconds');
  });

  it('uses the right singular and plural', () => {
    expect(formatDuration(1)).toBe('1 second');
    expect(formatDuration(60)).toBe('1 minute');
    expect(formatDuration(3600)).toBe('1 hour');
    expect(formatDuration(86_400)).toBe('1 day');
  });

  it('rounds to the biggest sensible unit', () => {
    expect(formatDuration(45)).toBe('45 seconds');
    expect(formatDuration(499)).toBe('8 minutes');
    expect(formatDuration(15_060)).toBe('4 hours');
    expect(formatDuration(200_000)).toBe('2 days');
  });

  it('never shows 60 seconds or 60 minutes', () => {
    expect(formatDuration(59.7)).toBe('1 minute');
    expect(formatDuration(3_570)).toBe('1 hour');
  });
});

describe('distanceBetweenKm', () => {
  it('is 0 from a world to itself', () => {
    expect(distanceBetweenKm(world('mars'), world('mars'))).toBe(0);
  });

  it('is the Moon orbit size between Earth and the Moon, in either direction', () => {
    expect(distanceBetweenKm(world('earth'), world('moon'))).toBe(384_400);
    expect(distanceBetweenKm(world('moon'), world('earth'))).toBe(384_400);
  });

  it('is the planet distance from the Sun for the Sun', () => {
    expect(distanceBetweenKm(world('sun'), world('mercury'))).toBe(57_900_000);
  });

  it('is the closest-approach gap between two planets', () => {
    expect(distanceBetweenKm(world('earth'), world('neptune'))).toBe(4_365_400_000);
    expect(distanceBetweenKm(world('neptune'), world('earth'))).toBe(4_365_400_000);
  });

  it('measures from Earth for trips that start or end at the Moon', () => {
    expect(distanceBetweenKm(world('moon'), world('mars'))).toBe(78_400_000);
    expect(distanceBetweenKm(world('sun'), world('moon'))).toBe(149_600_000);
  });
});

describe('real numbers for a compressed trip', () => {
  it('scales the remaining real distance by how far along the flight is', () => {
    expect(realDistanceRemainingKm(1_000, 25, 100)).toBe(250);
  });

  it('never goes below 0', () => {
    expect(realDistanceRemainingKm(1_000, -5, 100)).toBe(0);
  });

  it('keeps scaling when the ship is farther away than the leg is long (it may start somewhere else)', () => {
    expect(realDistanceRemainingKm(1_000, 120, 100)).toBe(1_200);
  });

  it('is 0 when the leg has no length', () => {
    expect(realDistanceRemainingKm(1_000, 10, 0)).toBe(0);
  });

  it('turns scene speed into the real speed it stands for', () => {
    // 10 scene units per second over a leg of 500 scene units = 4,365,400,000 km
    expect(realSpeedKmPerSec(10, 4_365_400_000, 500)).toBe(87_308_000);
    expect(realSpeedKmPerSec(10, 1_000, 0)).toBe(0);
  });

  it('writes a speed with its unit', () => {
    expect(formatSpeed(87_308_000)).toBe('87.3 million km per second');
  });
});

describe('the pretend speed lesson', () => {
  const C = 299_792.458;

  it('says how many times faster than light the pretend rocket goes', () => {
    expect(timesLightSpeed(C * 2)).toBeCloseTo(2);
    // About what the stats show on the way to Saturn.
    expect(pretendSpeedNote(5_800_000)).toBe('19 times faster than light! Only a pretend rocket can do that.');
  });

  it('writes big numbers with a thousands comma', () => {
    expect(pretendSpeedNote(C * 1000)).toBe('1,000 times faster than light! Only a pretend rocket can do that.');
  });

  it('does not say "1 times" when it is only a little faster than light', () => {
    expect(pretendSpeedNote(C * 1.2)).toBe('Faster than light! Only a pretend rocket can do that.');
    expect(pretendSpeedNote(C * 1.5)).toBe('2 times faster than light! Only a pretend rocket can do that.');
  });

  it('never says faster than light when it is not', () => {
    expect(pretendSpeedNote(C)).toBe('Our rocket is pretend.');
    expect(pretendSpeedNote(100)).toBe('Our rocket is pretend.');
    expect(pretendSpeedNote(0)).toBe('Our rocket is pretend.');
  });

  it('compares with a real spacecraft, in a short sentence', () => {
    expect(REAL_ROCKET_COMPARISON).toContain('New Horizons');
    expect(REAL_ROCKET_COMPARISON).toContain('Pluto');
    expect(REAL_ROCKET_COMPARISON.split(/\s+/).length).toBeLessThanOrEqual(20);
  });
});
