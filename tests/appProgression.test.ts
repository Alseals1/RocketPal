import { beforeAll, describe, expect, it } from 'vitest';
import { connectProgression } from '../src/app/progression';
import { createSaveStore } from '../src/platform/saveStore';
import { buildContent, type Content } from '../src/data/content';
import { realFiles } from './fixtures/content';

let content: Content;
beforeAll(() => {
  content = buildContent(realFiles());
});

describe('connectProgression', () => {
  it('records each event before emit returns, so the screen can read the new view at once', () => {
    const save = createSaveStore(null, null);
    const { events, progression } = connectProgression(save, content);
    const seen: number[] = [];
    events.on('dotFound', () => seen.push(progression().journal.get('mars')!.found.length)); // a later subscriber sees it too
    events.emit({ type: 'arrived', place: 'mars' });
    events.emit({ type: 'dotFound', dot: 'mars/rim' });
    expect(progression().journal.get('mars')!.found).toEqual(['mars/rim']);
    expect(seen).toEqual([1]);
    expect(save.read().visited).toEqual(['mars']);
    for (const id of ['sky', 'rover']) events.emit({ type: 'dotFound', dot: `mars/${id}` });
    expect(progression().missions.get('find-3-mars')!.done).toBe(true);
    expect(progression().stars.byPlace.get('mars')).toBe(1);
    events.emit({ type: 'quizFinished', place: 'mars', firstTryAll: true });
    expect(progression().stars.byPlace.get('mars')).toBe(3);
    expect(progression().xp).toBe(3 * 5 + 20 + 20 + 10);
  });

  it('works the view out once per save change', () => {
    const save = createSaveStore(null, null);
    const { events, progression } = connectProgression(save, content);
    const a = progression();
    expect(progression()).toBe(a);
    events.emit({ type: 'bump' }); // not recorded: same save, same view
    expect(progression()).toBe(a);
    events.emit({ type: 'dotFound', dot: 'earth/air' });
    expect(progression()).not.toBe(a);
  });

  it('tells onRecorded listeners what each recorded event earned', () => {
    const save = createSaveStore(null, null);
    const { events, onRecorded } = connectProgression(save, content);
    const seen: { type: string; pages: string[]; stars: number; missions: string[] }[] = [];
    onRecorded((e, diff) => seen.push({ type: e.type, pages: diff.newPages, stars: diff.newStars.length, missions: diff.missionsDone }));
    events.emit({ type: 'bump' }); // not recorded: no call
    events.emit({ type: 'dotFound', dot: 'mars/rim' });
    events.emit({ type: 'dotFound', dot: 'mars/sky' });
    events.emit({ type: 'dotFound', dot: 'mars/rover' });
    events.emit({ type: 'quizFinished', place: 'mars', firstTryAll: false });
    expect(seen).toEqual([
      { type: 'dotFound', pages: ['mars/rim'], stars: 0, missions: [] },
      { type: 'dotFound', pages: ['mars/sky'], stars: 0, missions: [] },
      { type: 'dotFound', pages: ['mars/rover'], stars: 1, missions: ['find-3-mars'] },
      { type: 'quizFinished', pages: [], stars: 1, missions: [] },
    ]);
  });

  it('gives an empty diff for a recorded event that changed nothing, and stops after unsubscribe', () => {
    const save = createSaveStore(null, null);
    const { events, onRecorded } = connectProgression(save, content);
    events.emit({ type: 'dotFound', dot: 'mars/rim' });
    const diffs: number[] = [];
    const stop = onRecorded((_e, diff) => diffs.push(diff.newPages.length + diff.newStars.length + (diff.rankUp ? 1 : 0)));
    events.emit({ type: 'dotFound', dot: 'mars/rim' }); // a repeat
    stop();
    events.emit({ type: 'dotFound', dot: 'mars/sky' });
    expect(diffs).toEqual([0]);
  });

  it('stops recording once disposed', () => {
    const save = createSaveStore(null, null);
    const { events, dispose } = connectProgression(save, content);
    dispose();
    events.emit({ type: 'dotFound', dot: 'mars/rim' });
    expect(save.read().dots).toEqual([]);
  });
});
