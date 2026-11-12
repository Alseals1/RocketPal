# Save v2: a backup key, sorted lists, and how the save types are split

Date: 2026-11-11. Decided by the Plan agent for issue #29 (save v2) and approved at plan review; built by the Implement agent.

## What was decided
1. **A backup key.** The `SaveStore` writes the same record to `rocketpals.progress` (the key every version has used, kept) and to `rocketpals.progress.backup`. Every read loads both, upgrades each, and merges them.
2. **Merge order: the stored copy first.** `update` does `merge(stored, thisWindow)`, then applies the change, then merges the result with that base again so nothing can go down. The only order-dependent rule is `keep` (fields this code does not know), so a newer version's stored values win over an older window's copy.
3. **Lists are a sorted set union.** `visited`, `dots`, `capsules`, `activities` and `rescues` merge as the deduplicated union, sorted. The result does not depend on which copy comes first, and writes are stable.
4. **`'newest'` ties are settled by the larger JSON text,** so the merge gives the same answer either way round. A value with no finite `at` is kept, not compared.
5. **The types are split.** The known fields are `interface SaveFields`, and `interface SaveData extends SaveFields { [unknown: string]: unknown }`. `SAVE_SCHEMA` is typed over `Exclude<keyof SaveFields, 'version'>`. The entry types `WorldSave`, `QuizSave` and `CourseSave` each have `[unknown: string]: unknown`, and `pilot.callSign` is a `Stamped<string>` (`{ value, at }`). These are small changes to the types in `docs/TECHNICAL_ARCHITECTURE.md` section 4.5, which now shows them.
6. **Rule for every later version:** an upgrade only fills fields that are missing, and never changes the type of an existing field. A v2 window writes `version: 2` over a v3 record (keeping v3's fields as unknown ones), so the v3 upgrade must be safe to run again on such a record. The rule is also written beside `migrate`.
7. **The `storage` event never writes.** It merges what another window saved into memory and tells the listeners. Only `update` writes.
8. **Unknown fields are kept forever.** A full 2.0 save is a few KB, and the backup doubles that: far below any `localStorage` limit. A write that fails (full or blocked) is caught, and the game carries on in memory.

## Why
- **The backup:** a tab left open from before this update runs today's v1 code. It saves `{ version: 1, worlds }` over `rocketpals.progress` and drops every 2.0 field. Without a second key, those fields are lost for good whenever no new window is open to put them back, which is the normal case after a kid closes the new tab. The v1 code does not know the backup key, so it never touches it.
- **`keyof Omit<SaveData, 'version'>`** on an interface with an index signature is `string | number`, which would quietly switch off the type check on `SAVE_SCHEMA`.
- **Entry index signatures** are how per-world (and per-quiz, per-course) fields from a newer version are typed and kept.

## Alternatives
- **Repair only on the `storage` event (no backup):** loses data whenever the old tab saves with no new window open.
- **Move v2 to a new key and leave `rocketpals.progress` as v1:** the issue says to keep the key, and every reader would need two formats.
- **Keep `loadProgress`, `saveProgress` and `mergeProgress` as wrappers over the store:** two save paths to keep in step, and the v1 merge drops v2 fields.
- **Write back in the `storage` event handler:** two windows could keep answering each other; the backup already guarantees nothing is lost.
- **`fast-check` for the property test:** a new dependency. A seeded generator (as in `tests/flightModel.test.ts`) is enough.

## Note
After an old tab saves, anyone reading `localStorage` by hand sees a v1 record under `rocketpals.progress` until a new window saves again. The game itself always merges the backup back in, so nothing is lost.
