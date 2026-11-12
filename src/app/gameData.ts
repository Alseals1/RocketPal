import type { Settings } from '../core/settings';
import type { MissionData } from '../data/missions';
import type { PlanetData } from '../data/planets';
import type { QuizData } from '../data/quizzes';
import type { SurfaceData } from '../data/surfaces';
import type { Quality } from '../quality/quality';
import { layoutWorlds } from '../scene/layout';
import type { GameData } from './screens';

/** What `main.ts` hands the game when it starts. */
export interface GameOptions {
  /** 'high' or 'low' from the page address, to force a quality (and turn off the automatic chooser). */
  forcedQuality?: Quality;
  touchControls: boolean;
  surfaces: SurfaceData;
  missions: MissionData;
  quizzes: QuizData;
  settings: Settings;
  debug: boolean;
}

/** The content the screens read: where each world sits, and each world's photo, mission and quiz, by world id. */
export function buildGameData(data: PlanetData, options: GameOptions): GameData {
  return {
    layouts: layoutWorlds(data.worlds),
    surfaces: new Map(options.surfaces.surfaces.map((s) => [s.worldId, s])),
    missions: new Map(options.missions.missions.map((m) => [m.worldId, m])),
    quizzes: new Map(options.quizzes.quizzes.map((q) => [q.worldId, q.questions])),
  };
}
