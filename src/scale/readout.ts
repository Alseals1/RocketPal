import type { World } from '../data/planets';

const SPEED_OF_LIGHT_KM_PER_SEC = 299_792.458;

/** "384,400 km", "57.9 million km", "4.5 billion km". */
export function formatDistanceKm(km: number): string {
  if (km >= 1e9) return `${(km / 1e9).toFixed(1)} billion km`;
  if (km >= 1e6) return `${(km / 1e6).toFixed(1)} million km`;
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

export function lightTravelSeconds(km: number): number {
  return km / SPEED_OF_LIGHT_KM_PER_SEC;
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/** A short, rounded time for kids: "1.3 seconds", "8 minutes", "4 hours", "2 days". */
export function formatDuration(seconds: number): string {
  if (seconds < 10) return plural(Number(seconds.toFixed(1)), 'second');
  if (Math.round(seconds) < 60) return plural(Math.round(seconds), 'second');
  const minutes = seconds / 60;
  if (Math.round(minutes) < 60) return plural(Math.round(minutes), 'minute');
  const hours = minutes / 60;
  if (Math.round(hours) < 24) return plural(Math.round(hours), 'hour');
  return plural(Math.round(hours / 24), 'day');
}

/**
 * Real distance for a trip between two worlds, as a "closest approach": both worlds
 * are treated as lined up on the same side of the Sun. The Moon counts as being at
 * Earth's distance from the Sun.
 */
export function distanceBetweenKm(a: World, b: World): number {
  if (a.id === b.id) return 0;
  if (a.parent === b.id) return a.distanceFromParentKm ?? 0;
  if (b.parent === a.id) return b.distanceFromParentKm ?? 0;
  return Math.abs(a.distanceFromSunKm - b.distanceFromSunKm);
}

/** The real distance still to go, when the ship is `sceneRemaining` out of `sceneLeg` scene units away. */
export function realDistanceRemainingKm(legKm: number, sceneRemaining: number, sceneLeg: number): number {
  if (sceneLeg <= 0) return 0;
  return Math.min(legKm, Math.max(0, (legKm * sceneRemaining) / sceneLeg));
}

/** The real speed that a scene speed stands for on this leg. */
export function realSpeedKmPerSec(sceneSpeed: number, legKm: number, sceneLeg: number): number {
  if (sceneLeg <= 0) return 0;
  return (sceneSpeed * legKm) / sceneLeg;
}

export function formatSpeed(kmPerSec: number): string {
  return `${formatDistanceKm(kmPerSec)} per second`;
}
