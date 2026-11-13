import { describe, expect, it, vi } from 'vitest';
import { AssetLoadError, RefCountedAssetManager, type AssetEntry, type AssetLoader, type AssetManagerOptions } from '../src/platform/assets';

const ENTRIES: AssetEntry[] = [
  { id: 'photo/mars', type: 'texture', url: { high: '/mars-4096.jpg', low: '/mars-2048.jpg' }, bytes: 10, credit: 'mars' },
  { id: 'photo/earth', type: 'texture', url: { high: '/earth-2048.jpg' }, bytes: 10, credit: 'earth' },
  { id: 'model/ship', type: 'model', url: { high: '/ship.glb' }, bytes: 10, credit: 'ship' },
  { id: 'sound/ding', type: 'sound', url: { high: '/ding.mp3' }, bytes: 10, credit: 'ding' },
];

interface FakeValue {
  url: string;
  restored: number;
}

/** A loader whose loads finish only when the test says so. */
function fakeLoader() {
  const pending: { url: string; resolve(v: FakeValue): void; reject(e: unknown): void }[] = [];
  const freed: FakeValue[] = [];
  const loader: AssetLoader<FakeValue> = {
    load: vi.fn(
      (url: string) =>
        new Promise<FakeValue>((resolve, reject) => {
          pending.push({ url, resolve, reject });
        }),
    ),
    free: vi.fn((v: FakeValue) => void freed.push(v)),
    restore: vi.fn((v: FakeValue) => void v.restored++),
  };
  /** Finishes the oldest load still waiting. */
  const finish = async () => {
    const next = pending.shift()!;
    next.resolve({ url: next.url, restored: 0 });
    await flush();
  };
  const fail = async (error: unknown = new Error('404')) => {
    pending.shift()!.reject(error);
    await flush();
  };
  return { loader, pending, freed, finish, fail };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(overrides: Partial<AssetManagerOptions> = {}) {
  const texture = fakeLoader();
  const model = fakeLoader();
  const warn = vi.fn();
  const scheduled: (() => void)[] = [];
  const fetchFile = vi.fn((_url: string) => Promise.resolve());
  let restoreListener: (() => void) | undefined;
  const unsubscribe = vi.fn();
  let low = false;
  const manager = new RefCountedAssetManager({
    entries: ENTRIES,
    loaders: { texture: texture.loader as AssetLoader<unknown>, model: model.loader as AssetLoader<unknown> },
    prefersLow: () => low,
    onContextRestored: (fn) => {
      restoreListener = fn;
      return unsubscribe;
    },
    warn,
    schedule: (fn) => void scheduled.push(fn),
    fetchFile,
    ...overrides,
  });
  return {
    manager,
    texture,
    model,
    warn,
    scheduled,
    fetchFile,
    unsubscribe,
    setLow: (v: boolean) => (low = v),
    restoreContext: () => restoreListener?.(),
    runScheduled: () => scheduled.splice(0).forEach((fn) => fn()),
  };
}

describe('RefCountedAssetManager: acquire and release', () => {
  it('loads once for two users and gives both the same value', async () => {
    const { manager, texture } = setup();
    const a = manager.acquire<FakeValue>('photo/mars');
    const b = manager.acquire<FakeValue>('photo/mars');
    expect(texture.loader.load).toHaveBeenCalledTimes(1);
    await texture.finish();
    expect(await a).toBe(await b);
  });

  it('keeps the asset after the first release and frees it once, in the same call, on the last', async () => {
    const { manager, texture } = setup();
    void manager.acquire('photo/mars');
    void manager.acquire('photo/mars');
    await texture.finish();
    manager.release('photo/mars');
    expect(texture.freed).toHaveLength(0);
    manager.release('photo/mars');
    expect(texture.freed).toHaveLength(1);
    manager.release('photo/mars'); // one release too many does nothing
    expect(texture.loader.free).toHaveBeenCalledTimes(1);
  });

  it('frees on arrival when everyone let go while it was loading, and a new acquire starts a fresh load', async () => {
    const { manager, texture } = setup();
    const first = manager.acquire<FakeValue>('photo/mars');
    manager.release('photo/mars');
    expect(manager.held()).toEqual([]);
    await texture.finish();
    expect(texture.freed).toEqual([await first]);

    const again = manager.acquire<FakeValue>('photo/mars');
    expect(texture.loader.load).toHaveBeenCalledTimes(2);
    await texture.finish();
    expect(await again).not.toBe(await first);
    expect(texture.loader.free).toHaveBeenCalledTimes(1);
  });

  it('does nothing when releasing an id nobody holds', () => {
    const { manager, texture } = setup();
    expect(() => manager.release('photo/mars')).not.toThrow();
    expect(() => manager.release('nope')).not.toThrow();
    expect(texture.loader.free).not.toHaveBeenCalled();
  });

  it('lists the held ids, loading or loaded, sorted', async () => {
    const { manager, texture } = setup();
    void manager.acquire('photo/mars');
    void manager.acquire('model/ship');
    expect(manager.held()).toEqual(['model/ship', 'photo/mars']);
    await texture.finish();
    manager.release('photo/mars');
    expect(manager.held()).toEqual(['model/ship']);
  });
});

describe('RefCountedAssetManager: quality', () => {
  it('loads the low file when the device prefers it and the entry has one', async () => {
    const { manager, texture, setLow } = setup();
    setLow(true);
    void manager.acquire('photo/mars');
    void manager.acquire('photo/earth');
    expect(texture.pending.map((p) => p.url)).toEqual(['/mars-2048.jpg', '/earth-2048.jpg']);
  });

  it('loads the high file otherwise', () => {
    const { manager, texture } = setup();
    void manager.acquire('photo/mars');
    expect(texture.pending.map((p) => p.url)).toEqual(['/mars-4096.jpg']);
  });

  it('keeps an asset already held at its size when the quality drops', async () => {
    const { manager, texture, setLow } = setup();
    const first = manager.acquire<FakeValue>('photo/mars');
    await texture.finish();
    setLow(true);
    const second = manager.acquire<FakeValue>('photo/mars');
    expect(texture.loader.load).toHaveBeenCalledTimes(1);
    expect((await second).url).toBe('/mars-4096.jpg');
    expect(await second).toBe(await first);
  });
});

describe('RefCountedAssetManager: failures', () => {
  it('rejects every waiting acquire with AssetLoadError and warns once', async () => {
    const { manager, texture, warn } = setup();
    const a = manager.acquire('photo/mars');
    const b = manager.acquire('photo/mars');
    const cause = new Error('404');
    const results = Promise.allSettled([a, b]);
    await texture.fail(cause);
    const [ra, rb] = await results;
    for (const r of [ra, rb]) {
      expect(r.status).toBe('rejected');
      const error = (r as PromiseRejectedResult).reason as AssetLoadError;
      expect(error).toBeInstanceOf(AssetLoadError);
      expect(error.id).toBe('photo/mars');
      expect(error.url).toBe('/mars-4096.jpg');
      expect(error.cause).toBe(cause);
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe('Asset photo/mars could not be loaded (/mars-4096.jpg). The game uses its stand-in.');
    expect(manager.held()).toEqual([]);
  });

  it('tries again on the next acquire, without logging again', async () => {
    const { manager, texture, warn } = setup();
    const first = manager.acquire('photo/mars').catch((e: unknown) => e);
    await texture.fail();
    expect(await first).toBeInstanceOf(AssetLoadError);

    const second = manager.acquire('photo/mars').catch((e: unknown) => e);
    expect(texture.loader.load).toHaveBeenCalledTimes(2);
    await texture.fail();
    expect(await second).toBeInstanceOf(AssetLoadError);
    expect(warn).toHaveBeenCalledTimes(1);

    const third = manager.acquire<FakeValue>('photo/mars');
    await texture.finish();
    expect((await third).url).toBe('/mars-4096.jpg');
  });

  it('logs each broken id separately', async () => {
    const { manager, texture, warn } = setup();
    const a = manager.acquire('photo/mars').catch(() => {});
    const b = manager.acquire('photo/earth').catch(() => {});
    await texture.fail();
    await texture.fail();
    await Promise.all([a, b]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('rejects and warns once for an id that is not in the manifest', async () => {
    const { manager, warn } = setup();
    await expect(manager.acquire('tex/nowhere')).rejects.toBeInstanceOf(AssetLoadError);
    await expect(manager.acquire('tex/nowhere')).rejects.toBeInstanceOf(AssetLoadError);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('tex/nowhere');
    expect(manager.held()).toEqual([]);
  });

  it('rejects and warns once for a type with no loader', async () => {
    const { manager, warn } = setup();
    await expect(manager.acquire('sound/ding')).rejects.toBeInstanceOf(AssetLoadError);
    await expect(manager.acquire('sound/ding')).rejects.toBeInstanceOf(AssetLoadError);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('sound');
  });

  it('frees nothing when a load released mid-way then fails', async () => {
    const { manager, texture } = setup();
    const a = manager.acquire('photo/mars').catch(() => {});
    manager.release('photo/mars');
    await texture.fail();
    await a;
    expect(texture.loader.free).not.toHaveBeenCalled();
  });
});

describe('RefCountedAssetManager: lost context', () => {
  it('marks only held, loaded assets for upload again', async () => {
    const { manager, texture, model, restoreContext } = setup();
    const mars = manager.acquire<FakeValue>('photo/mars');
    const earth = manager.acquire<FakeValue>('photo/earth');
    await texture.finish();
    await texture.finish();
    void manager.acquire('model/ship'); // still loading
    manager.release('photo/earth'); // freed

    restoreContext();
    expect((await mars).restored).toBe(1);
    expect((await earth).restored).toBe(0);
    expect(model.loader.restore).not.toHaveBeenCalled();
    expect(texture.loader.restore).toHaveBeenCalledTimes(1);
  });

  it('stops listening on dispose', () => {
    const { manager, unsubscribe } = setup();
    manager.dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('RefCountedAssetManager: preload', () => {
  it('fetches each id once, at low priority, at the chosen size, and counts no users', () => {
    const { manager, scheduled, fetchFile, runScheduled, setLow, texture } = setup();
    setLow(true);
    manager.preload(['photo/mars', 'photo/mars', 'model/ship']);
    expect(fetchFile).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(2);
    runScheduled();
    expect(fetchFile.mock.calls.map((c) => c[0])).toEqual(['/mars-2048.jpg', '/ship.glb']);
    expect(manager.held()).toEqual([]);
    expect(texture.loader.load).not.toHaveBeenCalled();
  });

  it('skips held and unknown ids', () => {
    const { manager, fetchFile, runScheduled } = setup();
    void manager.acquire('photo/mars');
    manager.preload(['photo/mars', 'tex/nowhere', 'photo/earth']);
    runScheduled();
    expect(fetchFile.mock.calls.map((c) => c[0])).toEqual(['/earth-2048.jpg']);
  });

  it('swallows fetch errors, whether they reject or throw', async () => {
    const rejecting = setup({ fetchFile: () => Promise.reject(new Error('offline')) });
    rejecting.manager.preload(['photo/mars']);
    expect(() => rejecting.runScheduled()).not.toThrow();
    const throwing = setup({
      fetchFile: () => {
        throw new Error('no fetch');
      },
    });
    throwing.manager.preload(['photo/mars']);
    expect(() => throwing.runScheduled()).not.toThrow();
    await flush();
    expect(rejecting.warn).not.toHaveBeenCalled();
  });
});
