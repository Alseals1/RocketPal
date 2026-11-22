import { beforeAll, describe, expect, it } from 'vitest';
import { deriveProgression } from '../src/core/progression';
import { migrate } from '../src/core/save/schema';
import { buildContent, type Content } from '../src/data/content';
import type { MissionDef } from '../src/data/missions';
import { NO_MISSIONS_TEXT, buildMissionRows, missionsListenText } from '../src/ui/missionsModel';
import { realFiles } from './fixtures/content';
import { V1_EARTH_MISSION } from './fixtures/saves';

let content: Content;
beforeAll(() => {
  content = buildContent(realFiles());
});

const view = (raw: Record<string, unknown> = { version: 2 }) => deriveProgression(migrate(raw), content);
const rows = (here: string | null = null, raw?: Record<string, unknown>) =>
  buildMissionRows({ missions: content.missions, view: view(raw), places: content.places, here });

describe('the Missions tab rows', () => {
  it('lists every mission, ordered from the Sun outwards (Earth before Mars, whatever the file order)', () => {
    expect(content.missions.size).toBe(2);
    expect(rows().map((r) => r.id)).toEqual(['find-3-earth', 'find-3-mars']);
    expect(rows().map((r) => r.placeName)).toEqual(['Earth', 'Mars']);
  });

  it('shows progress on an open mission, and offers Go: primary on the first open row only', () => {
    const [earth, mars] = rows();
    expect(earth).toMatchObject({ status: 'open', line: '0 of 3 found', go: 'primary', place: 'earth' });
    expect(mars).toMatchObject({ status: 'open', line: '0 of 3 found', go: 'secondary', place: 'mars' });
  });

  it('says "Done!" on a finished mission, with no Go, and the next open row becomes primary', () => {
    const [earth, mars] = rows(null, V1_EARTH_MISSION);
    expect(earth).toMatchObject({ status: 'done', line: 'Done!', go: null, place: null });
    expect(mars).toMatchObject({ status: 'open', line: '0 of 3 found', go: 'primary' });
  });

  it('shows the dots found so far from the progression view', () => {
    const partial = { missions: new Map([['find-3-mars', { done: false, progress: { done: 2, of: 3 } }]]) };
    const list = buildMissionRows({ missions: content.missions, view: partial, places: content.places, here: null });
    expect(list[1]).toMatchObject({ id: 'find-3-mars', line: '2 of 3 found' });
  });

  it('says "You are here" for the world you are at, with no Go', () => {
    const [earth, mars] = rows('earth');
    expect(earth).toMatchObject({ status: 'here', line: 'You are here', go: null, place: null });
    expect(mars.go).toBe('primary');
  });

  it('counts a mission with no progress entry as 0 of its goal', () => {
    const empty = { missions: new Map() } as Pick<ReturnType<typeof view>, 'missions'>;
    const [earth] = buildMissionRows({ missions: content.missions, view: empty, places: content.places, here: null });
    expect(earth.line).toBe('0 of 3 found');
  });

  it('keeps file order for missions at the same place, and puts a mission with no place last', () => {
    const base = content.missions.get('find-3-mars')!;
    const missions = new Map<string, MissionDef>([
      ['side', { ...base, id: 'side', kind: 'side', place: undefined, title: 'Side quest' }],
      ['mars-b', { ...base, id: 'mars-b', title: 'Mars B' }],
      ['mars-a', { ...base, id: 'mars-a', title: 'Mars A' }],
    ]);
    const list = buildMissionRows({ missions, view: { missions: new Map() }, places: content.places, here: null });
    expect(list.map((r) => r.id)).toEqual(['mars-b', 'mars-a', 'side']);
    expect(list[2]).toMatchObject({ placeName: '', go: null });
  });

  it('gives no rows when there are no missions', () => {
    expect(buildMissionRows({ missions: new Map(), view: { missions: new Map() }, places: content.places, here: null })).toEqual([]);
  });

  it('reads the list aloud, or says there are none yet', () => {
    expect(missionsListenText(rows('earth'))).toBe(
      'Missions. Find 3 things out the window, Earth: You are here. Find 3 things on Mars, Mars: 0 of 3 found.',
    );
    expect(missionsListenText([])).toBe(NO_MISSIONS_TEXT);
  });
});
