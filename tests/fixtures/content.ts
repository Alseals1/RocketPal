import missionsJson from '../../public/data/missions.json';
import planetsJson from '../../public/data/planets.json';
import progressionJson from '../../public/data/progression.json';
import quizzesJson from '../../public/data/quizzes.json';
import surfacesJson from '../../public/data/surfaces.json';
import type { RawContent } from '../../src/data/content';

/** Fresh deep copies of the shipped data files, so each test can break them in its own way. */
export function realFiles() {
  return {
    planets: structuredClone(planetsJson) as any,
    surfaces: structuredClone(surfacesJson) as any,
    missions: structuredClone(missionsJson) as any,
    quizzes: structuredClone(quizzesJson) as any,
    progression: structuredClone(progressionJson) as any,
  } satisfies RawContent;
}

/** The entry for `worldId` in a list of worlds, pictures, quizzes or missions. */
export const entry = (list: any[], worldId: string) => list.find((x) => (x.id ?? x.worldId) === worldId);
