/** Saved records as they really appear in a browser's storage, for the save tests. */

/** v1, exactly as the e2e test "saves only the yes/no flags" saw it: the Earth mission and nothing else. */
export const V1_EARTH_MISSION = {
  version: 1,
  worlds: { earth: { missionDone: true, quizDone: false, perfectQuiz: false } },
};

/** v1: three stars on Mars, two on Earth. */
export const V1_MARS_3_EARTH_2 = {
  version: 1,
  worlds: {
    mars: { missionDone: true, quizDone: true, perfectQuiz: true },
    earth: { missionDone: true, quizDone: true, perfectQuiz: false },
  },
};

/** A record with no version at all (read as v1). */
export const NO_VERSION = {
  worlds: { moon: { missionDone: true, quizDone: true, perfectQuiz: false } },
};

/** A full v2 record, every field in use. */
export const V2_FULL = {
  version: 2,
  worlds: { mars: { missionDone: true, quizDone: true, perfectQuiz: true } },
  visited: ['earth', 'mars'],
  dots: ['mars:rim', 'mars:sky'],
  capsules: ['moon:1'],
  quizzes: { mars: { done: true, perfect: false } },
  courses: { 'ring-run': { finish: true, crystals: false, smooth: true, bestMs: 41_250 } },
  activities: ['rover:1'],
  rescues: ['lost-probe'],
  repeats: { 'quiz:mars': 2 },
  patchDates: { 'first-landing': '2026-11-01' },
  equipped: { trim: { item: 'stripes', at: 1_700_000_000_000 } },
  pilot: { callSign: { value: 'Comet', at: 1_700_000_000_500 } },
};

/** A record from a newer version, with fields this code has never heard of, at every level. */
export const V3_FROM_THE_FUTURE = {
  version: 3,
  worlds: { mars: { missionDone: true, quizDone: false, perfectQuiz: false, rings: 2 } },
  visited: ['mars'],
  dots: [],
  capsules: [],
  quizzes: { mars: { done: true, perfect: true, tries: [1, 2] } },
  courses: { 'ring-run': { finish: true, crystals: true, smooth: false, bestMs: 39_000, ghost: 'abc' } },
  activities: [],
  rescues: [],
  repeats: {},
  patchDates: {},
  equipped: {},
  pilot: {},
  pets: { comet: { name: 'Zip' } },
  theme: 'night',
};
