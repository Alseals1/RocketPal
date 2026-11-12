/**
 * Reads and writes the saved progress (#29). Platform layer: it touches the browser's storage and its `storage`
 * event; the format and the merge rules live in `src/core/save/schema.ts`.
 *
 * The same record is written under two keys. `rocketpals.progress` is the key every version has used.
 * `rocketpals.progress.backup` is a copy that today's v1 code does not know about, so a tab left open from before
 * this update, which saves only the v1 flags over the main key, can never wipe 2.0 progress: every read merges both.
 * See decisions/2026-11-11-save-v2-format.md.
 */
import type { SettingsStorage } from '../core/settings';
import { emptySave, merge, migrate, sameSave, type SaveData } from '../core/save/schema';

export const PROGRESS_KEY = 'rocketpals.progress';
export const BACKUP_KEY = 'rocketpals.progress.backup';

export interface SaveStore {
  read(): SaveData;
  /** Reads what is stored, merges it with this window's copy, applies the change, writes. Nothing can go down. */
  update(change: (s: SaveData) => SaveData): SaveData;
  /** Called after a change made here, or one made in another window (the `storage` event). Returns an unsubscribe. */
  onChange(fn: (s: SaveData) => void): () => void;
  /** Goes up by one each time the save changes. */
  readonly revision: number;
}

/** Where the `storage` event comes from: `window` in the game, a plain EventTarget in tests. */
export interface StorageEvents {
  addEventListener(type: 'storage', fn: (e: Event) => void): void;
  removeEventListener(type: 'storage', fn: (e: Event) => void): void;
}

/**
 * A save store over the given storage. With no storage (blocked by the browser) it works in memory for the visit.
 * With no event source it does not hear other windows until its next `update`.
 */
export function createSaveStore(storage: SettingsStorage | null, events: StorageEvents | null): SaveStore & { dispose(): void } {
  let current = readStored(storage);
  let revision = 0;
  const listeners = new Set<(s: SaveData) => void>();

  const adopt = (next: SaveData) => {
    if (sameSave(next, current)) return;
    current = next;
    revision += 1;
    for (const fn of [...listeners]) fn(next);
  };

  // Another window changed storage: take in what is new. Never write here, so two windows cannot answer each other forever.
  const onStorage = (e: Event) => {
    const key = 'key' in e ? (e as StorageEvent).key : null; // null: the other window cleared storage
    if (key !== PROGRESS_KEY && key !== BACKUP_KEY && key !== null) return;
    adopt(merge(readStored(storage), current));
  };
  if (storage && events) events.addEventListener('storage', onStorage);

  return {
    read: () => current,
    update(change) {
      // The stored copy goes first, so a newer version's fields win over this window's older copy of them.
      const base = merge(readStored(storage), current);
      const next = merge(change(base), base);
      if (storage) {
        const text = JSON.stringify(next);
        for (const key of [PROGRESS_KEY, BACKUP_KEY]) {
          try {
            storage.setItem(key, text);
          } catch {
            // Full or blocked: keep going in memory.
          }
        }
      }
      adopt(next);
      return next;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get revision() {
      return revision;
    },
    dispose() {
      events?.removeEventListener('storage', onStorage);
      listeners.clear();
    },
  };
}

/** Both keys, each upgraded on its own, merged. Anything unreadable counts as an empty save. */
function readStored(storage: SettingsStorage | null): SaveData {
  return merge(readKey(storage, PROGRESS_KEY), readKey(storage, BACKUP_KEY));
}

function readKey(storage: SettingsStorage | null, key: string): SaveData {
  try {
    const text = storage?.getItem(key);
    return text ? migrate(JSON.parse(text)) : emptySave();
  } catch {
    return emptySave();
  }
}
