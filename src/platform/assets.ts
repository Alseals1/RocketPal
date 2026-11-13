/**
 * Assets (docs/TECHNICAL_ARCHITECTURE.md 4.15 and 5.11). One manager loads every file the game draws: it counts who is
 * using each asset, picks the high or low file, frees an asset when its last user lets go, marks held assets for upload
 * again after a lost graphics context, and logs a broken file once.
 *
 * Platform layer: it never imports `three`. The render layer hands it one `AssetLoader` per asset type
 * (`src/render/assetLoaders.ts`) and the app wires the two together, as `createAudioManager` takes its Howler loader.
 * See decisions/2026-11-13-asset-manager.md.
 */
import type { AssetId } from '../data/ids';

// 4.15 as written.
export interface AssetEntry {
  id: AssetId;
  type: 'texture' | 'model' | 'image' | 'sound' | 'font';
  url: { high: string; low?: string };
  bytes: number;
  credit: string; // credit: a CREDITS.md entry id
}
export interface AssetManager {
  acquire<T>(id: AssetId): Promise<T>; // loads at the current quality, counts users
  release(id: AssetId): void; // frees GPU memory when the last user releases
  preload(ids: AssetId[]): void; // low priority, after the first frame
}

/**
 * Loads and frees one type of asset. Every user of an id gets the same value, so a user that changes it (for example
 * `toShipModel` swapping the flame's material) must be its only user; a second user of a model must clone it.
 */
export interface AssetLoader<T> {
  load(url: string): Promise<T>;
  /** Frees the value's memory (on the graphics card and the decoded image). Called once, on the last release. */
  free(value: T): void;
  /** After a lost graphics context: marks the value to be uploaded again. */
  restore?(value: T): void;
}

/** Why `acquire` rejected: an unknown id, a type with no loader, or a file that could not be loaded. */
export class AssetLoadError extends Error {
  constructor(
    readonly id: AssetId,
    readonly url?: string,
    options?: { cause?: unknown },
  ) {
    super(`Asset ${id} could not be loaded${url ? ` (${url})` : ''}.`, options);
    this.name = 'AssetLoadError';
  }
}

export interface AssetManagerOptions {
  entries: readonly AssetEntry[];
  loaders: Partial<Record<AssetEntry['type'], AssetLoader<unknown>>>;
  /** True when the small files suit this device (low quality, or a card that cannot hold the big picture). */
  prefersLow(): boolean;
  /** Subscribes to a restored graphics context; returns an unsubscribe. */
  onContextRestored?(fn: () => void): () => void;
  /** Where the one log line per broken asset goes. `console.warn` by default. */
  warn?(message: string, error: unknown): void;
  /** Runs work at low priority. `requestIdleCallback` (or `setTimeout`) by default. */
  schedule?(fn: () => void): void;
  /** Fetches a file into the HTTP cache. `fetch` by default. */
  fetchFile?(url: string): Promise<unknown>;
}

interface AssetRecord {
  users: number;
  promise: Promise<unknown>;
  loaded: boolean;
  value?: unknown;
  loader: AssetLoader<unknown>;
}

const defaultSchedule = (fn: () => void): void => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => fn());
  else setTimeout(fn, 0);
};

export class RefCountedAssetManager implements AssetManager {
  private readonly entries: ReadonlyMap<AssetId, AssetEntry>;
  private readonly records = new Map<AssetId, AssetRecord>();
  /** Ids already logged as broken: each is logged once per session, however often it is tried again. */
  private readonly logged = new Set<AssetId>();
  private readonly warn: (message: string, error: unknown) => void;
  private readonly schedule: (fn: () => void) => void;
  private readonly fetchFile: (url: string) => Promise<unknown>;
  private readonly unsubscribe?: () => void;

  constructor(private readonly options: AssetManagerOptions) {
    this.entries = new Map(options.entries.map((e) => [e.id, e]));
    this.warn = options.warn ?? ((message, error) => console.warn(message, error));
    this.schedule = options.schedule ?? defaultSchedule;
    this.fetchFile = options.fetchFile ?? ((url) => fetch(url));
    this.unsubscribe = options.onContextRestored?.(() => this.restore());
  }

  acquire<T>(id: AssetId): Promise<T> {
    const live = this.records.get(id);
    if (live) {
      live.users++;
      return live.promise as Promise<T>;
    }
    const entry = this.entries.get(id);
    const loader = entry && this.options.loaders[entry.type];
    if (!entry || !loader) {
      const error = new AssetLoadError(id);
      this.logOnce(id, entry ? `Asset ${id} has no loader for its type (${entry.type}).` : `Asset ${id} is not in the manifest.`, error);
      return Promise.reject(error);
    }

    const url = this.urlFor(entry);
    const record: AssetRecord = { users: 1, loaded: false, loader, promise: Promise.resolve() };
    record.promise = loader.load(url).then(
      (value) => {
        if (this.records.get(id) !== record) {
          loader.free(value); // everyone let go while it was loading
        } else {
          record.value = value;
          record.loaded = true;
        }
        return value;
      },
      (cause: unknown) => {
        if (this.records.get(id) === record) this.records.delete(id);
        this.logOnce(id, `Asset ${id} could not be loaded (${url}). The game uses its stand-in.`, cause);
        throw new AssetLoadError(id, url, { cause });
      },
    );
    this.records.set(id, record);
    return record.promise as Promise<T>;
  }

  /** Synchronous: on the last release the asset is freed before this returns (or as soon as its load finishes). */
  release(id: AssetId): void {
    const record = this.records.get(id);
    if (!record) return;
    record.users--;
    if (record.users > 0) return;
    this.records.delete(id);
    if (record.loaded) record.loader.free(record.value);
  }

  /** Warms the HTTP cache at low priority. Decodes nothing, counts no users, and never fails. */
  preload(ids: AssetId[]): void {
    for (const id of new Set(ids)) {
      if (this.records.has(id)) continue;
      const entry = this.entries.get(id);
      if (!entry) continue;
      const url = this.urlFor(entry);
      this.schedule(() => {
        try {
          void this.fetchFile(url).catch(() => {});
        } catch {
          // a fetch that throws at once is ignored too
        }
      });
    }
  }

  /** The ids with at least one user, loading or loaded, sorted. For the debug handle. */
  held(): AssetId[] {
    return [...this.records.keys()].sort();
  }

  /** Stops listening for a restored context. */
  dispose(): void {
    this.unsubscribe?.();
  }

  private urlFor(entry: AssetEntry): string {
    return this.options.prefersLow() && entry.url.low ? entry.url.low : entry.url.high;
  }

  private restore(): void {
    for (const record of this.records.values()) {
      if (record.loaded) record.loader.restore?.(record.value);
    }
  }

  private logOnce(id: AssetId, message: string, error: unknown): void {
    if (this.logged.has(id)) return;
    this.logged.add(id);
    this.warn(message, error);
  }
}
