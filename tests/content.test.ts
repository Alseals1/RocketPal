import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { buildContent, loadContent, type Content } from '../src/data/content';
import { WORLD_IDS } from '../src/data/ids';
import { FALLBACK_RULES } from '../src/data/progression';
import { entry, realFiles } from './fixtures/content';

const keys = (map: Map<string, unknown>) => [...map.keys()];

let error: MockInstance<typeof console.error>;
beforeEach(() => {
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  error.mockRestore();
  vi.unstubAllGlobals();
});

describe('buildContent with the shipped files', () => {
  let content: Content;
  beforeEach(() => {
    content = buildContent(realFiles());
  });

  it('drops nothing and logs nothing', () => {
    expect(content.problems).toEqual([]);
    expect(error).not.toHaveBeenCalled();
  });

  it('fills every map', () => {
    expect(content.worlds.size).toBe(10);
    expect(content.places.size).toBe(10);
    expect(keys(content.arrivals).sort()).toEqual(['earth', 'mars']);
    expect(keys(content.quizzes).sort()).toEqual(['earth', 'mars']);
    expect(keys(content.missions)).toEqual(['find-3-mars', 'find-3-earth']);
  });

  it('keeps the worlds in file order, which is the journey order the planets are laid out by', () => {
    expect(keys(content.worlds)).toEqual([...WORLD_IDS]);
    expect(keys(content.places)).toEqual([...WORLD_IDS]);
  });

  it('makes one place for each world, in Star Map order', () => {
    expect(content.places.get('mars')).toEqual({ id: 'mars', name: 'Mars', kind: 'world', order: 5 });
    expect(content.places.get('sun')).toEqual({ id: 'sun', name: 'The Sun', kind: 'world', order: 0 });
    expect(content.places.has('belt')).toBe(false); // the belt comes with its own issue
  });

  it('keys each entry by its world, and keeps the entry itself', () => {
    const files = realFiles();
    const built = buildContent(files);
    expect(built.arrivals.get('mars')).toBe(entry(files.surfaces.surfaces, 'mars'));
    // A question pool is rebuilt with only its good questions, but holds the questions themselves.
    expect(built.quizzes.get('earth')).toEqual(entry(files.quizzes.pools, 'earth'));
    expect(built.quizzes.get('earth')!.questions[0]).toBe(entry(files.quizzes.pools, 'earth').questions[0]);
    expect(built.missions.get('find-3-mars')).toBe(entry(files.missions.missions, 'find-3-mars'));
    expect(built.worlds.get('moon')).toBe(entry(files.planets.worlds, 'moon'));
  });
});

describe('buildContent leaves out a broken entry, and only what depends on it', () => {
  it('a broken world: only that world and its place are missing', () => {
    const files = realFiles();
    entry(files.planets.worlds, 'neptune').hook = ' ';
    const content = buildContent(files);
    expect(content.problems).toEqual(['planets.json: neptune: hook is required', 'planets.json: neptune: world is missing']);
    expect(keys(content.worlds)).toEqual(WORLD_IDS.filter((id) => id !== 'neptune'));
    expect(content.places.has('neptune')).toBe(false);
    expect(content.arrivals.size).toBe(2);
    expect(content.quizzes.size).toBe(2);
    expect(content.missions.size).toBe(2);
  });

  it('a broken Earth takes the Moon (its parent is gone) and every Earth entry with it; Mars stays', () => {
    const files = realFiles();
    entry(files.planets.worlds, 'earth').diameterKm = -5;
    const content = buildContent(files);
    expect(content.worlds.size).toBe(8);
    expect(content.worlds.has('earth')).toBe(false);
    expect(content.worlds.has('moon')).toBe(false);
    expect(keys(content.arrivals)).toEqual(['mars']);
    expect(keys(content.quizzes)).toEqual(['mars']);
    expect(keys(content.missions)).toEqual(['find-3-mars']);
    expect(content.problems).toEqual(
      expect.arrayContaining([
        'planets.json: earth: diameterKm must be a positive number',
        'planets.json: moon: parent "earth" is not a world in the list',
        'planets.json: earth: world is missing',
        'planets.json: moon: world is missing',
        'surfaces.json: earth: not a world in planets.json',
        'quizzes.json: earth: has a quiz but no landing picture',
        'missions.json: find-3-earth: place must be a world in planets.json',
      ]),
    );
  });

  it('a broken landing picture takes its quiz and mission with it; Earth keeps everything', () => {
    const files = realFiles();
    entry(files.surfaces.surfaces, 'mars').credit = '';
    const content = buildContent(files);
    expect(keys(content.arrivals)).toEqual(['earth']);
    expect(keys(content.quizzes)).toEqual(['earth']);
    expect(keys(content.missions)).toEqual(['find-3-earth']);
    expect(content.worlds.size).toBe(10);
    expect(content.problems).toContain('surfaces.json: mars: credit is required (say who took the picture)');
  });

  it('one bad dot leaves out the whole picture (single dots are not dropped yet)', () => {
    const files = realFiles();
    entry(files.surfaces.surfaces, 'mars').hotspots[0].elevation = 200;
    const content = buildContent(files);
    expect(content.arrivals.has('mars')).toBe(false);
    expect(content.problems[0]).toMatch(/^surfaces\.json: mars\/\w+: elevation/);
  });

  it('a broken quiz: only that quiz is missing', () => {
    const files = realFiles();
    entry(files.quizzes.pools, 'mars').questions = [];
    const content = buildContent(files);
    expect(content.problems).toEqual([
      'quizzes.json: mars: needs 6 to 9 questions (has 0)',
      'quizzes.json: mars: needs at least 3 good questions at level 1 or 2 to make a quiz (has 0)',
    ]);
    expect(keys(content.quizzes)).toEqual(['earth']);
    expect(content.missions.size).toBe(2);
    expect(content.arrivals.size).toBe(2);
  });

  it('a bad question: only that question is missing, and the rest of its quiz still loads', () => {
    const files = realFiles();
    const mars = entry(files.quizzes.pools, 'mars');
    mars.questions.find((q: any) => q.id === 'mars-sky').hotspot = 'no-such-dot';
    const content = buildContent(files);
    expect(content.problems).toEqual(['quizzes.json: mars/mars-sky: hotspot "no-such-dot" is not a dot on mars']);
    expect(keys(content.quizzes).sort()).toEqual(['earth', 'mars']);
    const ids = content.quizzes.get('mars')!.questions.map((q) => q.id);
    expect(ids).toEqual(mars.questions.map((q: any) => q.id).filter((id: string) => id !== 'mars-sky'));
    expect(content.missions.size).toBe(2);
    expect(error.mock.calls.map((c) => String(c[0]))).toEqual(['Some quizzes were left out:\nmars/mars-sky: hotspot "no-such-dot" is not a dot on mars']);
  });

  it('a broken mission: only that mission is missing', () => {
    const files = realFiles();
    entry(files.missions.missions, 'find-3-mars').goal.count = 99;
    const content = buildContent(files);
    expect(content.problems).toEqual([
      'missions.json: find-3-mars: goal: dotsFound count must be a whole number from 1 to the number of dots on the picture (5)',
    ]);
    expect(keys(content.missions)).toEqual(['find-3-earth']);
    expect(content.quizzes.size).toBe(2);
  });

  it('rejects a mission of another kind, with a goal elsewhere, or with no teaser', () => {
    const files = realFiles();
    entry(files.missions.missions, 'find-3-mars').kind = 'tour';
    entry(files.missions.missions, 'find-3-earth').goal.place = 'mars';
    const content = buildContent(files);
    expect(content.missions.size).toBe(0);
    expect(content.problems).toEqual([
      'missions.json: find-3-mars: kind must be "find" (other kinds come with their own issues)',
      "missions.json: find-3-earth: a find mission's goal must be dotsFound at its own place",
    ]);
    const noTeaser = realFiles();
    delete entry(noTeaser.missions.missions, 'find-3-mars').teaser;
    expect(buildContent(noTeaser).problems).toEqual([
      'missions.json: find-3-mars: teaser text is required and at most 20 words',
      'missions.json: find-3-mars: teaser place must be a world in planets.json',
    ]);
  });

  it('a mission whose teaser points at a left-out world is left out too', () => {
    const files = realFiles();
    entry(files.planets.worlds, 'jupiter').color = 'orange';
    const content = buildContent(files);
    expect(keys(content.missions)).toEqual(['find-3-earth']);
    expect(content.problems).toContain('missions.json: find-3-mars: teaser place must be a world in planets.json');
  });

  it('a mission whose goal points at a left-out landing picture is left out too', () => {
    const files = realFiles();
    entry(files.missions.missions, 'find-3-earth').place = 'mars'; // its own place is fine, but the goal is at Earth
    entry(files.surfaces.surfaces, 'earth').credit = '';
    const content = buildContent(files);
    expect(content.problems).toEqual(
      expect.arrayContaining([
        'missions.json: find-3-earth: a find mission\'s goal must be dotsFound at its own place',
        'missions.json: find-3-earth: goal: dotsFound place must be a world with a landing picture',
      ]),
    );
    expect(keys(content.missions)).toEqual(['find-3-mars']);
  });

  it('a goal that names another mission must name one in the file', () => {
    const files = realFiles();
    entry(files.missions.missions, 'find-3-mars').available = { type: 'missionDone', mission: 'find-3-earth' };
    entry(files.missions.missions, 'find-3-earth').available = { type: 'missionDone', mission: 'find-3-venus' };
    const content = buildContent(files);
    expect(content.problems).toEqual(['missions.json: find-3-earth: available: missionDone mission must be a mission in missions.json']);
    expect(keys(content.missions)).toEqual(['find-3-mars']);
  });

  it('keeps the first copy of a quiz or mission that is listed twice, and the first find mission at a place', () => {
    const files = realFiles();
    const marsQuiz = entry(files.quizzes.pools, 'mars');
    const marsMission = entry(files.missions.missions, 'find-3-mars');
    files.quizzes.pools.push({ ...structuredClone(marsQuiz), questions: marsQuiz.questions.slice(0, 6) });
    files.missions.missions.push({ ...structuredClone(marsMission), title: 'A second Mars mission' });
    files.missions.missions.push({ ...structuredClone(marsMission), id: 'find-2-mars' });
    const content = buildContent(files);
    expect(content.quizzes.get('mars')).toEqual(marsQuiz); // the first copy: all 8 questions
    expect(content.missions.get('find-3-mars')).toBe(marsMission);
    expect(keys(content.missions)).toEqual(['find-3-mars', 'find-3-earth']);
    expect(content.problems).toEqual([
      'quizzes.json: mars: has a quiz more than once (kept the first)',
      'missions.json: find-3-mars: listed twice (kept the first)',
      'missions.json: find-2-mars: mars already has a find mission (kept the first)',
    ]);
  });

  it('keeps the first copy of a world or a landing picture that is listed twice', () => {
    const files = realFiles();
    const mars = entry(files.planets.worlds, 'mars');
    const marsPicture = entry(files.surfaces.surfaces, 'mars');
    files.planets.worlds.push({ ...structuredClone(mars), name: 'Mars again' });
    files.surfaces.surfaces.push(structuredClone(marsPicture));
    const content = buildContent(files);
    expect(content.worlds.get('mars')).toBe(mars);
    expect(content.arrivals.get('mars')).toBe(marsPicture);
    expect(keys(content.worlds)).toEqual([...WORLD_IDS]);
    expect(content.problems).toEqual([
      'planets.json: mars: listed twice (kept the first)',
      'surfaces.json: mars: listed twice (kept the first)',
    ]);
  });

  it('leaves out a world that is not one of the ten', () => {
    const files = realFiles();
    files.planets.worlds.push({ ...structuredClone(entry(files.planets.worlds, 'neptune')), id: 'pluto', name: 'Pluto' });
    const content = buildContent(files);
    expect(content.worlds.has('pluto' as never)).toBe(false);
    expect(content.problems).toEqual(['planets.json: pluto: not one of the ten worlds']);
  });
});

describe('buildContent with a file that is unusable as a whole', () => {
  it('an optional file that is not an object, or could not be loaded, adds nothing and the rest still loads', () => {
    const files = realFiles();
    const content = buildContent({ ...files, quizzes: 'x', missions: undefined });
    expect(content.quizzes.size).toBe(0);
    expect(content.missions.size).toBe(0);
    expect(content.arrivals.size).toBe(2);
    expect(content.worlds.size).toBe(10);
    expect(content.problems).toEqual(['quizzes.json: quiz data must be an object', 'missions.json: could not be loaded']);
  });

  it('a bad lastChecked leaves out the whole file, as before', () => {
    const files = realFiles();
    files.missions.lastChecked = 'soon';
    const content = buildContent(files);
    expect(content.missions.size).toBe(0);
    expect(content.problems).toEqual(['missions.json: lastChecked must be a real date like 2026-10-23']);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toBe('Bad mission data:\nlastChecked must be a real date like 2026-10-23');
  });

  it('with no landing pictures, every quiz and mission is left out and the worlds still load', () => {
    const content = buildContent({ ...realFiles(), surfaces: undefined });
    expect(content.worlds.size).toBe(10);
    expect(content.arrivals.size + content.quizzes.size + content.missions.size).toBe(0);
  });

  it('a planets file that is unusable as a whole stops the game', () => {
    expect(() => buildContent({ ...realFiles(), planets: null })).toThrow(/^Bad planets data:\nplanets data must be an object/);
    expect(() => buildContent({ ...realFiles(), planets: undefined })).toThrow(/Bad planets data/);
    const files = realFiles();
    files.planets.source = '';
    expect(() => buildContent(files)).toThrow(/Bad planets data:\nsource/);
    const noList = realFiles();
    noList.planets.worlds = {};
    expect(() => buildContent(noList)).toThrow(/worlds must be a list/);
  });

  it('a planets file with no good world at all stops the game', () => {
    const files = realFiles();
    for (const w of files.planets.worlds) w.hook = '';
    expect(() => buildContent(files)).toThrow(/^Bad planets data:\nsun: hook is required/);
  });
});

describe('buildContent with the progression rules', () => {
  it('loads the XP table and the ranks', () => {
    const content = buildContent(realFiles());
    expect(content.progression.ranks).toHaveLength(8);
    expect(content.progression.xp.dot).toEqual({ first: 5, again: 1 });
    expect(content.progression.repeatCap).toBe(10);
  });

  it('a missing file gives no XP, says so in problems, and leaves the console to loadContent', () => {
    const content = buildContent({ ...realFiles(), progression: undefined });
    expect(content.progression).toEqual(FALLBACK_RULES);
    expect(content.problems).toEqual(['progression.json: could not be loaded']);
    expect(error).not.toHaveBeenCalled();
    expect(content.missions.size).toBe(2);
  });

  it('a broken file gives no XP, is logged once, and the rest still loads', () => {
    const files = realFiles();
    files.progression.ranks[0].xp = 10;
    delete files.progression.xp.dot;
    const content = buildContent(files);
    expect(content.progression).toEqual(FALLBACK_RULES);
    expect(content.problems).toEqual([
      'progression.json: xp.dot must have "first" and "again", each a whole number of 0 or more',
      'progression.json: ranks[0]: the first rank starts at 0 xp',
    ]);
    expect(error.mock.calls.map((c) => String(c[0]))).toEqual([
      'Bad progression data:\nxp.dot must have "first" and "again", each a whole number of 0 or more\nranks[0]: the first rank starts at 0 xp',
    ]);
    expect(content.worlds.size).toBe(10);
    expect(content.missions.size).toBe(2);
  });

  it('the fallback is a copy, so changing one content cannot change another', () => {
    const a = buildContent({ ...realFiles(), progression: null });
    a.progression.ranks.push({ rank: 2, name: 'x', xp: 1 });
    expect(buildContent({ ...realFiles(), progression: null }).progression).toEqual(FALLBACK_RULES);
    expect(FALLBACK_RULES.ranks).toHaveLength(1);
  });
});

describe('buildContent tells the console what it left out', () => {
  it('one message per file, with the same wording as before', () => {
    const files = realFiles();
    entry(files.quizzes.pools, 'mars').questions = [];
    entry(files.planets.worlds, 'neptune').hook = '';
    buildContent(files);
    const messages = error.mock.calls.map((c) => String(c[0]));
    expect(messages).toEqual([
      'Some worlds were left out:\nneptune: hook is required\nneptune: world is missing',
      'Some quizzes were left out:\nmars: needs 6 to 9 questions (has 0)\nmars: needs at least 3 good questions at level 1 or 2 to make a quiz (has 0)',
    ]);
  });

  it('names landing pictures and missions the way the old loaders did', () => {
    const files = realFiles();
    entry(files.surfaces.surfaces, 'mars').credit = '';
    buildContent(files);
    const messages = error.mock.calls.map((c) => String(c[0]));
    expect(messages[0]).toMatch(/^Some landing pictures were left out:\nmars: credit/);
    expect(messages).toContainEqual(expect.stringMatching(/^Some quizzes were left out:\nmars: has a quiz but no landing picture/));
    expect(messages).toContainEqual(expect.stringMatching(/^Some missions were left out:\nfind-3-mars: has a mission but no landing picture/));
  });
});

describe('loadContent', () => {
  const files = realFiles();
  const bodyFor = (url: string) => files[url.replace(/^.*\/(\w+)\.json$/, '$1') as keyof typeof files];

  it('asks for all the files at once, before any of them arrives', async () => {
    const waiting: { url: string; answer: () => void }[] = [];
    const fetch = vi.fn(
      (url: string) =>
        new Promise<Response>((resolve) => {
          waiting.push({ url, answer: () => resolve(new Response(JSON.stringify(bodyFor(url)))) });
        }),
    );
    vi.stubGlobal('fetch', fetch);
    const loading = loadContent();
    await Promise.resolve();
    expect(waiting.map((w) => w.url).sort()).toEqual([
      '/data/missions.json',
      '/data/planets.json',
      '/data/progression.json',
      '/data/quizzes.json',
      '/data/surfaces.json',
    ]);
    for (const w of waiting) w.answer();
    const content = await loading;
    expect(content.problems).toEqual([]);
    expect(content.worlds.size).toBe(10);
    expect(content.missions.size).toBe(2);
    expect(error).not.toHaveBeenCalled();
  });

  it('carries on without a file that could not be loaded, and says so', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('missions.json')) throw new TypeError('Failed to fetch');
        return new Response(JSON.stringify(bodyFor(url)));
      }),
    );
    const content = await loadContent();
    expect(content.missions.size).toBe(0);
    expect(content.quizzes.size).toBe(2);
    expect(content.worlds.size).toBe(10);
    expect(content.problems).toEqual(['missions.json: could not be loaded']);
    expect(error.mock.calls.map((c) => String(c[0]))).toEqual(['Could not load /data/missions.json (Failed to fetch)']);
  });

  it('treats a missing file (404) the same way', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('quizzes.json') ? new Response('nope', { status: 404 }) : new Response(JSON.stringify(bodyFor(url))),
      ),
    );
    const content = await loadContent();
    expect(content.quizzes.size).toBe(0);
    expect(error.mock.calls.map((c) => String(c[0]))).toEqual(['Could not load /data/quizzes.json (404)']);
  });

  it('gives up when planets.json cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (url.endsWith('planets.json') ? new Response('', { status: 500 }) : new Response(JSON.stringify(bodyFor(url))))),
    );
    await expect(loadContent()).rejects.toThrow('Could not load /data/planets.json (500)');
  });
});
