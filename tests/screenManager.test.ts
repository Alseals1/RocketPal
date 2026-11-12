import { describe, expect, it } from 'vitest';
import { ScreenManager } from '../src/app/screenManager';
import type { Screen, ScreenId } from '../src/app/screens';

/** A pretend screen that writes down every call. Its `enter` waits until the test says so. */
function fakeScreen(id: ScreenId, log: string[]) {
  const pending: { resolve: () => void; reject: (e: Error) => void }[] = [];
  let auto = false;
  const screen: Screen & { finishEnter(): void; failEnter(e: Error): void; enterAtOnce(): void; pendingEnters(): number } = {
    id,
    enter(params) {
      log.push(`${id}.enter(${JSON.stringify(params)})`);
      if (auto) return Promise.resolve();
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }));
    },
    update(dt, now) {
      log.push(`${id}.update(${dt},${now})`);
    },
    resize(w, h) {
      log.push(`${id}.resize(${w},${h})`);
    },
    pause() {
      log.push(`${id}.pause`);
    },
    resume() {
      log.push(`${id}.resume`);
    },
    async leave() {
      log.push(`${id}.leave`);
    },
    finishEnter: () => pending.shift()!.resolve(),
    failEnter: (e) => pending.shift()!.reject(e),
    enterAtOnce: () => (auto = true),
    pendingEnters: () => pending.length,
  };
  return screen;
}

/** Lets every waiting promise step run. */
const settle = () => new Promise((r) => setTimeout(r, 0));

function setUp() {
  const log: string[] = [];
  const space = fakeScreen('space', log);
  const arrival = fakeScreen('arrival', log);
  const manager = new ScreenManager([space, arrival], 'space');
  return { log, space, arrival, manager };
}

describe('ScreenManager', () => {
  it('starts on the first screen, and sends each frame only to the active screen', () => {
    const { log, manager } = setUp();
    expect(manager.activeId).toBe('space');
    expect(manager.currentId).toBe('space');
    manager.update(0.016, 100);
    expect(log).toEqual(['space.update(0.016,100)']);
  });

  it('sends a new screen size to every screen, active or not', () => {
    const { log, manager } = setUp();
    manager.resize(800, 600);
    expect(log).toEqual(['space.resize(800,600)', 'arrival.resize(800,600)']);
  });

  it('enters the next screen while the old one keeps going, then leaves the old one', async () => {
    const { log, arrival, manager } = setUp();
    const going = manager.go('arrival', { surface: 'mars' });
    expect(log).toEqual(['arrival.enter({"surface":"mars"})']);
    expect(manager.currentId).toBe('arrival'); // it counts as arrived from the start
    expect(manager.activeId).toBe('space');

    manager.update(0.016, 1); // the picture is still loading: space keeps drawing
    await settle();
    expect(log.at(-1)).toBe('space.update(0.016,1)');

    arrival.finishEnter();
    await going;
    expect(log.slice(-1)).toEqual(['space.leave']);
    expect(manager.activeId).toBe('arrival');
    expect(manager.currentId).toBe('arrival');
    manager.update(0.016, 2);
    expect(log.at(-1)).toBe('arrival.update(0.016,2)');
  });

  it('going to the active screen leaves it and enters it again', async () => {
    const { log, space, manager } = setUp();
    space.enterAtOnce();
    await manager.go('space', { liftOff: true });
    expect(log).toEqual(['space.leave', 'space.enter({"liftOff":true})']);
    expect(manager.activeId).toBe('space');
  });

  it('a failed enter leaves the new screen, keeps the old one, and rejects', async () => {
    const { log, arrival, manager } = setUp();
    const going = manager.go('arrival', {});
    arrival.failEnter(new Error('no picture'));
    await expect(going).rejects.toThrow('no picture');
    expect(log).toEqual(['arrival.enter({})', 'arrival.leave']);
    expect(manager.activeId).toBe('space');
    expect(manager.currentId).toBe('space');
  });

  it('a screen abandoned while it enters is left at once and never becomes active, even when it finishes later', async () => {
    const { log, space, arrival, manager } = setUp();
    space.enterAtOnce();
    const first = manager.go('arrival', {});
    const back = manager.go('space', { liftOff: true }); // Back while "Landing on Mars..."
    expect(manager.currentId).toBe('space');
    await back;
    expect(log).toEqual(['arrival.enter({})', 'arrival.leave', 'space.leave', 'space.enter({"liftOff":true})']);

    arrival.finishEnter(); // the picture arrives late
    await first;
    expect(manager.activeId).toBe('space');
    expect(log.filter((l) => l === 'arrival.leave')).toHaveLength(1); // left once, not again
    manager.update(0.016, 1);
    expect(log.at(-1)).toBe('space.update(0.016,1)');
  });

  it('a late failure of an abandoned screen is swallowed', async () => {
    const { log, space, arrival, manager } = setUp();
    space.enterAtOnce();
    const first = manager.go('arrival', {});
    await manager.go('space', { liftOff: true });
    arrival.failEnter(new Error('too late'));
    await expect(first).resolves.toBeUndefined();
    expect(log.filter((l) => l === 'arrival.leave')).toHaveLength(1);
    expect(manager.activeId).toBe('space');
  });

  it('three quick changes end on the last one', async () => {
    const { log, space, arrival, manager } = setUp();
    space.enterAtOnce();
    const one = manager.go('arrival', { n: 1 });
    const two = manager.go('space', { liftOff: true });
    const three = manager.go('arrival', { n: 3 });
    expect(manager.currentId).toBe('arrival');
    while (arrival.pendingEnters() > 0) arrival.finishEnter();
    await Promise.all([one, two, three]);
    expect(manager.activeId).toBe('arrival');
    expect(log.at(-1)).toBe('space.leave');
    expect(log.filter((l) => l.startsWith('arrival.enter'))).toEqual(['arrival.enter({"n":1})', 'arrival.enter({"n":3})']);
    manager.update(0.016, 1);
    expect(log.at(-1)).toBe('arrival.update(0.016,1)');
  });

  it('never pauses or resumes a screen yet (nothing asks it to)', async () => {
    const { log, arrival, manager } = setUp();
    const going = manager.go('arrival', {});
    arrival.finishEnter();
    await going;
    expect(log.some((l) => l.endsWith('.pause') || l.endsWith('.resume'))).toBe(false);
  });

  it('refuses a screen it does not have', async () => {
    const { manager } = setUp();
    await expect(manager.go('hangar', {})).rejects.toThrow('hangar');
  });
});
