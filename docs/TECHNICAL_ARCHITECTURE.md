# Rocket Pals: technical architecture

**Status: approved by the product owner on 2026-11-11**, with all decisions in section 12 (see `decisions/2026-11-11-technical-architecture-approved.md`). No code has changed yet. It designs how Rocket Pal 2.0 is built on today's code. It follows [GAME_DESIGN.md](GAME_DESIGN.md) and [VISUAL_DESIGN.md](VISUAL_DESIGN.md), both approved on 2026-11-11, and the findings in [PROJECT_AUDIT.md](PROJECT_AUDIT.md). The order of work is in [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

**Contents:** 1. Goals and constraints · 2. Today, in one page · 3. Layers and rules · 4. Shared types · 5. The systems (14) · 6. Map from gameplay to code · 7. How one action flows through the game · 8. How to extend it · 9. Testing · 10. Getting there without a rewrite · 11. Risks · 12. Decisions for approval

---

## 1. Goals and constraints

**Goals**
1. **Grow without a rewrite.** Every 2.0 feature plugs into a small number of extension points (a screen, a data file, an event, an item, an activity). Today's working code moves behind those points, one piece at a time, with its tests still passing.
2. **Rendering, game logic and UI stay apart.** Game rules never import Three.js or touch the page. Three.js code never decides rules. UI never draws 3D.
3. **Data, not code, for content.** Worlds, missions, quizzes, rewards, patches, items, courses and sounds live in validated JSON. Adding a world or an item is a data change plus its picture or model.
4. **Types first.** The interfaces in section 4 are agreed before the systems behind them are built.

**Constraints** (from `CLAUDE.md`, unchanged)
* Three.js, TypeScript, Vite. Plain TypeScript and CSS for the interface; no UI framework.
* **No backend.** There are no accounts, nothing is shared between players, content ships with the build, and the product rules forbid data collection. A server would add accounts, consent, hosting and privacy duties for children's data with no feature that needs it. Saves stay in `localStorage`, as today.
* 30+ fps on a school Chromebook; under 15 MB to first play; works with storage blocked; nothing sent off the page.
* Runtime dependencies stay `three` and `howler`. A new library needs a recorded decision.

## 2. Today, in one page

* `src/main.ts` checks WebGL, applies settings, loads `planets.json`, `surfaces.json`, `missions.json` and `quizzes.json` (each optional file fails soft), and creates `Game`.
* `src/game.ts` (504 lines) owns the frame loop, the `'space' | 'surface'` mode, the ship, the target and autopilot, quality, landing, progress, settings and the debug handle.
* **Pure and tested:** `flight/flightModel.ts`, `scale/`, `quality/`, `quiz/quiz.ts`, `core/progress.ts`, `core/settings.ts`, `data/*.ts` validators, `surface/geometry.ts`.
* **Rendering:** `scene/spaceScene.ts` (owns the one `WebGLRenderer`), `surface/panoramaScene.ts` (borrows it), `scene/shipModel.ts` (lazy GLB load).
* **UI:** `ui/hud.ts`, `ui/surfaceHud.ts`, `ui/quizPanel.ts`, `ui/settingsPanel.ts`, `ui/focus.ts`, `ui/stars.ts`, one `style.css`.
* **Platform:** `flight/input.ts` (keyboard and touch), `audio/speech.ts` (read-aloud).

The good news from the audit: the rules are already pure, the content is already JSON with strict validators, and the renderer is already shared. The architecture below keeps all three and adds the missing middle: one place for game state, one stream of events, and one way to add a screen.

## 3. Layers and rules

```
                 ┌──────────────────────────────────────────┐
                 │  app/      main.ts, Game (the shell),    │
                 │            screen manager, wiring         │
                 └───────┬──────────────┬──────────────┬────┘
                         │              │              │
        ┌────────────────▼───┐  ┌───────▼───────┐  ┌───▼──────────────┐
        │ screens/ activities/│  │  ui/          │  │ render/ scene/    │
        │ (one per screen;    │──▶  HTML + CSS   │  │ surface/          │
        │  glue only)         │──┼───────────────┼──▶  Three.js only    │
        └────────┬────────────┘  └───────▲───────┘  └───────▲──────────┘
                 │                       │ view models      │ render frames
        ┌────────▼───────────────────────┴──────────────────┴──────────┐
        │ core/  flight/  quiz/  scale/  quality/   PURE GAME LOGIC     │
        │ (state, rules, progression, missions, save format, events)   │
        └────────┬──────────────────────────────────────────────────────┘
                 │ types
        ┌────────▼───────────┐     ┌────────────────────────────────────┐
        │ data/  content     │     │ platform/  storage, audio, speech,  │
        │ types, loaders,    │     │ input, assets (browser APIs)        │
        │ validators         │     │                                     │
        └────────────────────┘     └────────────────────────────────────┘
```

| Layer | Folders | May import | May not import |
| --- | --- | --- | --- |
| **Content** | `src/data/` | nothing in `src/` except shared types | `three`, the DOM, anything else |
| **Logic** | `src/core/`, `src/flight/`, `src/quiz/`, `src/scale/`, `src/quality/` | content types, each other | `three`, `howler`, the DOM, `ui/`, `render/` |
| **Render** | `src/render/` (new), `src/scene/`, `src/surface/` | `three`, logic types, `ui/tokens.ts` | `ui/` components, the save store, `howler` |
| **UI** | `src/ui/` | logic types and view models, `ui/tokens.ts` | `three`, `render/` |
| **Platform** | `src/platform/` (new; `audio/`, `flight/input.ts` move here over time) | browser APIs, `howler` | `ui/`, `render/` |
| **Screens and activities** | `src/screens/`, `src/activities/` (new) | everything above | — |
| **App** | `src/main.ts`, `src/game.ts` → `src/app/` | everything | — |

**These rules are enforced by a unit test** (`tests/architecture.test.ts`) that reads every file's `import` lines and fails if a layer imports something it may not. It needs no extra tools.

Existing folders keep their names. New folders are added; old files move only when they are next changed (section 10).

## 4. Shared types

These are the contracts. Each lives in the layer that owns it (file named in the heading). Everything else depends on them, so they are agreed first and changed only with a decision.

### 4.1 Ids (`src/data/ids.ts`)

```ts
export type WorldId = 'sun' | 'mercury' | 'venus' | 'earth' | 'moon' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';
export type PlaceId = WorldId | 'belt';          // a Star Map destination; the belt is a region, not a world
export type DotId = `${PlaceId}/${string}`;     // 'mars/rim'
export type CapsuleId = string;                  // 'light-8-minutes'
export type MissionId = string;                  // 'tour-2-mars', 'find-3-mars', 'rescue-balloon'
export type ChapterId = 'home' | 'rocky' | 'giants' | 'ice';
export type CourseId = string;                   // 'belt-cadet'
export type ActivityId = string;                 // 'belt-run', 'planet-lineup'
export type ItemId = string;                     // 'paint-mars-red'
export type PatchId = string;                    // 'first-flight'
export type SoundId = string;                    // 'dot-found'
export type AssetId = string;                    // 'tex/jupiter', 'model/ship'
```

### 4.2 Content (`src/data/content.ts`)

```ts
/** Everything loaded from public/data/, validated, indexed. Read-only after start. */
export interface Content {
  places: Map<PlaceId, Place>;
  worlds: Map<WorldId, World>;                 // planets.json (exists)
  arrivals: Map<PlaceId, ArrivalDef>;          // surfaces.json (exists, extended)
  quizzes: Map<PlaceId, QuestionPool>;         // quizzes.json (extended to pools)
  capsules: CapsuleFact[];                     // capsules.json (new)
  missions: Map<MissionId, MissionDef>;        // missions.json (extended)
  chapters: ChapterDef[];                      // chapters.json (new)
  courses: Map<CourseId, CourseDef>;           // courses.json (new)
  activities: Map<ActivityId, ActivityDef>;    // activities.json (new)
  items: Map<ItemId, ItemDef>;                 // items.json (new)
  patches: Map<PatchId, PatchDef>;             // patches.json (new)
  progression: ProgressionRules;               // progression.json (new): XP table, ranks
  sounds: Map<SoundId, SoundDef>;              // sounds.json (new)
  problems: string[];                          // entries dropped by validation (logged; must be empty in tests)
}

export interface Place {
  id: PlaceId;
  name: string;
  kind: 'world' | 'region';
  order: number;                               // position on the Star Map, from the Sun outwards
}
```

### 4.3 Conditions: one language for missions, patches and unlocks (`src/core/conditions.ts`)

Missions, patches and item unlocks all ask "has the player done X?". They share one condition type and one pure evaluator, so a new kind of goal is added once and works everywhere.

```ts
export type Condition =
  | { type: 'visited'; place: PlaceId }
  | { type: 'dotsFound'; place: PlaceId; count: number }            // count of that place's dots found, ever
  | { type: 'quizDone'; place: PlaceId; perfect?: boolean }
  | { type: 'starsAt'; place: PlaceId | CourseId; count: number }
  | { type: 'courseDone'; course: CourseId; star?: 'finish' | 'crystals' | 'smooth' }
  | { type: 'capsules'; count: number }
  | { type: 'activityDone'; activity: ActivityId; key?: string }    // key: a world for per-world mini-games
  | { type: 'missionDone'; mission: MissionId }
  | { type: 'chapterDone'; chapter: ChapterId }
  | { type: 'rank'; atLeast: number }
  | { type: 'patch'; patch: PatchId }
  | { type: 'all'; of: Condition[] }
  | { type: 'any'; of: Condition[] };

/** Pure. True when the save meets the condition. Never stores anything. */
export function isMet(c: Condition, save: SaveData, content: Content): boolean;
/** Pure. 0..1 for progress bars ("2 of 3 found"). */
export function progressOf(c: Condition, save: SaveData, content: Content): { done: number; of: number };
```

### 4.4 Events (`src/core/events.ts`)

Everything that happens in play is one typed event. Screens publish; the progression recorder, audio cues, toasts and the debug log subscribe.

```ts
export type GameEvent =
  | { type: 'arrived'; place: PlaceId }
  | { type: 'dotFound'; dot: DotId }
  | { type: 'quizFinished'; place: PlaceId; firstTryAll: boolean }
  | { type: 'capsuleCollected'; capsule: CapsuleId }
  | { type: 'courseFinished'; course: CourseId; timeMs: number; crystals: number; crystalsTotal: number; bumps: number }
  | { type: 'activityFinished'; activity: ActivityId; key?: string }
  | { type: 'rescueDone'; mission: MissionId }
  | { type: 'itemEquipped'; item: ItemId }
  | { type: 'bump' }                                        // for sound and screen feedback only
  | { type: 'boost'; on: boolean };

export interface EventBus {
  emit(e: GameEvent): void;
  on<T extends GameEvent['type']>(type: T, fn: (e: Extract<GameEvent, { type: T }>) => void): () => void;
}
```

### 4.5 Save data (`src/core/save/schema.ts`)

One versioned record under `rocketpals.progress` (the key used today). Every field declares how two copies merge, so a second open window can never lose anything (#29).

```ts
export interface SaveData {
  version: 2;
  worlds: Record<string, { missionDone: boolean; quizDone: boolean; perfectQuiz: boolean }>; // v1, kept
  visited: string[];                         // PlaceIds                       merge: union
  dots: string[];                            // DotIds found                   merge: union
  capsules: string[];                        // CapsuleIds                     merge: union
  quizzes: Record<string, { done: boolean; perfect: boolean }>;  // per place   merge: OR per flag
  courses: Record<string, { finish: boolean; crystals: boolean; smooth: boolean; bestMs?: number }>; // OR flags, min time
  activities: string[];                      // `${ActivityId}:${key}` done     merge: union
  rescues: string[];                         // MissionIds                     merge: union
  repeats: Record<string, number>;           // replay counters for XP          merge: max
  patchDates: Record<string, string>;        // PatchId → first date seen       merge: earliest
  equipped: Record<string, { item: string; at: number }>;  // slot → item     merge: newest `at`
  pilot: { callSign?: { value: string; at: number } };     //                  merge: newest `at`
  [unknown: string]: unknown;                // fields from a newer version are kept, never dropped
}

export type MergeRule = 'union' | 'or' | 'max' | 'min' | 'earliest' | 'newest' | 'keep';
export const SAVE_SCHEMA: Record<keyof Omit<SaveData, 'version'>, MergeRule | Record<string, MergeRule>>;

export function migrate(raw: unknown): SaveData;           // no version → v1 → v2; garbage → empty, per field
export function merge(a: SaveData, b: SaveData): SaveData; // driven by SAVE_SCHEMA; unknown fields: keep from either
```

**What is not saved, because it is worked out from the above:** XP, rank, stars, which missions and chapters are done, which patches are earned, which items are unlocked, and Journal pages. Deriving them means there is nothing to get out of step, and nothing to merge.

### 4.6 Progression (`src/core/progression/`)

```ts
export interface ProgressionRules {
  xp: Record<XpSource, { first: number; again: number }>;  // the table in GAME_DESIGN.md section 10
  repeatCap: number;                                       // repeats that still give XP, per activity (e.g. 10)
  ranks: { rank: number; name: string; xp: number }[];     // 8 ranks
}
export type XpSource = 'dot' | 'capsule' | 'mission' | 'quiz' | 'perfectQuiz' | 'course' | 'courseStar'
  | 'personalBest' | 'sideMission' | 'chapter' | 'activity';

/** Pure and memoised by save revision. Everything the UI shows about progress. */
export interface ProgressionView {
  xp: number;
  rank: { rank: number; name: string; xpIntoRank: number; xpForNext: number | null };
  stars: { total: number; byPlace: Map<PlaceId, number>; byCourse: Map<CourseId, number> };
  missions: Map<MissionId, { done: boolean; progress: { done: number; of: number } }>;
  chapters: Map<ChapterId, { done: boolean; steps: number; stepsDone: number }>;
  patches: Map<PatchId, { earned: boolean; date?: string }>;
  unlocked: Set<ItemId>;
  journal: Map<PlaceId, { found: DotId[]; total: number }>;
}
export function deriveProgression(save: SaveData, content: Content): ProgressionView;

/** Pure. What changed between two views: drives the reward screen and toasts. */
export interface RewardDiff {
  xpGained: number; rankUp?: { from: number; to: number };
  newStars: { place: PlaceId | CourseId; count: number }[];
  newPatches: PatchId[]; newItems: ItemId[]; newPages: DotId[];
  missionsDone: MissionId[]; chaptersDone: ChapterId[];
}
export function diffProgression(before: ProgressionView, after: ProgressionView): RewardDiff;
```

### 4.7 Missions and chapters (`src/data/missions.ts`, extended)

```ts
export interface MissionDef {
  id: MissionId;
  kind: 'find' | 'tour' | 'side' | 'rescue' | 'request';
  place?: PlaceId;                 // where it happens (for "Go" on the mission board)
  chapter?: ChapterId;             // tour steps
  title: string;                   // ≤ 40 characters, as today
  goal: Condition;                 // done when this is met (derived, never stored)
  available?: Condition;           // shown only once this is met (requests, rescues)
  done: string;                    // Orbit's line when it is done (exists today)
  teaser?: { text: string; place: PlaceId };  // exists today
  rescue?: RescueDef;              // kind 'rescue' only
}
export interface ChapterDef { id: ChapterId; title: string; steps: MissionId[]; reward: { patch: PatchId; item?: ItemId } }
```

Today's `find` missions become `{ kind: 'find', goal: { type: 'dotsFound', place: 'mars', count: 3 } }`. The migration in #29 keeps today's `missionDone` flag as already met.

### 4.8 Items, slots and gear (`src/data/items.ts`)

```ts
export type Slot = 'paint' | 'decal' | 'exhaust' | 'parts' | 'gear'          // rocket
  | 'suit' | 'visor' | 'chestPatch' | 'backpack' | 'helmetLight';            // astronaut (Phase 2)

export interface ItemDef {
  id: ItemId;
  slot: Slot;
  name: string;
  fact: string;                    // one line, with its source, validated like a fact card
  sources: string[];
  unlock: Condition;               // { type: 'rank', atLeast: 1 } for starter items
  look: ItemLook;
  order: number;
}
export type ItemLook =
  | { slot: 'paint' | 'exhaust' | 'suit' | 'visor' | 'helmetLight'; color: string }
  | { slot: 'decal'; texture: AssetId }
  | { slot: 'parts' | 'backpack'; model: AssetId }
  | { slot: 'chestPatch'; patch: PatchId }
  | { slot: 'gear'; capability: Capability; model?: AssetId };

/** Gear lets you see and learn more; it never changes flying. */
export type Capability = 'telescope' | 'radio' | 'spectrometer' | 'magnetometer';
```

**Rocket upgrades are gear.** Content that needs gear says so: a hidden dot has `requires: 'telescope'`, the Light-Speed Messenger activity has `requires: 'radio'`. The flight model's settings come only from the assist setting and the course, never from items. A unit test checks that no item can reach `FlightConfig`, which keeps "gear never helps you win" true by construction.

### 4.9 Arrivals and planet environments (`src/data/surfaces.ts`, extended)

```ts
export type ArrivalKind = 'panorama' | 'window' | 'flyby' | 'course';
export interface ArrivalDef {
  place: PlaceId;
  kind: ArrivalKind;               // 'panorama' and 'window' exist today; 'flyby' is a window with a cockpit frame
  frame?: 'station' | 'cockpit';
  wording: 'landed' | 'flyingPast';  // the Sun and the giant planets say "flying past"
  // ...the existing Surface fields: title, images, credit, start, orbitHint, hotspots
  hotspots: Hotspot[];             // Hotspot gains `requires?: Capability` and `level?: 1 | 2 | 3`
  course?: CourseId;               // kind 'course': the belt
}
```

How a world looks in space is render data, kept out of the science file:

```ts
// src/render/worldLooks.ts (data from public/data/looks.json)
export interface WorldLook {
  place: PlaceId;
  texture?: { high: AssetId; low: AssetId };
  atmosphere?: { color: string; strength: number };
  ring?: { texture: AssetId; inner: number; outer: number };
  emissive?: boolean;                                    // the Sun
}
```

### 4.10 Questions (`src/data/quizzes.ts`, extended)

```ts
export interface QuestionPool {
  place: PlaceId;
  format: 'quiz' | 'postcard';       // 3 questions, or 1 (fly-by worlds)
  questions: PoolQuestion[];         // 6-9 for a quiz, 2-4 for a postcard
}
export interface PoolQuestion extends QuizQuestionData { level: 1 | 2 | 3 }

/** Pure, seeded. Picks the run's questions for the rank and shuffles the answers. */
export function drawQuestions(pool: QuestionPool, rank: number, seed: number): QuizQuestion[];
```

Every existing content check (the right answer backed by its dot's words, and so on) runs on every question in every pool.

### 4.11 Screens (`src/app/screens.ts`)

```ts
export type ScreenId = 'welcome' | 'space' | 'arrival' | 'activity' | 'hangar';

export interface Screen<P = unknown> {
  readonly id: ScreenId;
  enter(params: P): Promise<void>;        // acquire assets, build UI, start listening
  update(dt: number, now: number): void;  // every frame while active and not paused
  resize(width: number, height: number): void;
  pause(): void; resume(): void;          // Mission Control and dialogs pause the screen
  leave(): Promise<void>;                 // stop listening, release assets, remove UI
}

export interface ScreenContext {
  content: Content;
  save: SaveStore;
  progression: () => ProgressionView;
  events: EventBus;
  renderer: RendererHost;
  assets: AssetManager;
  audio: AudioManager;
  speech: Speaker;                        // exists today
  input: InputManager;
  settings: SettingsStore;
  overlays: OverlayStack;                 // Star Map, Mission Control, dialogs, reward screen, toasts
  go<P>(screen: ScreenId, params: P): Promise<void>;
}
```

Overlays are UI, not screens: the Star Map, Mission Control (Missions, Hangar entry, Journal, Patches, Settings), dialogs, the reward screen and toasts sit on top of whichever screen is active. The Hangar is a screen, because it draws its own 3D scene.

### 4.12 Activities: challenges and mini-games (`src/activities/`)

```ts
export interface ActivityDef {
  id: ActivityId;
  kind: 'flightCourse' | 'lineup' | 'detective' | 'weighIn' | 'messenger' | 'slalom' | 'cometChase' | 'slingshot';
  title: string;
  place?: PlaceId;                         // where it is started from
  available: Condition;                    // e.g. Pilot courses: rank 3 or 2 Cadet stars
  requires?: Capability;
  courses?: CourseId[];                    // flight courses only
}

export interface ActivityResult { activity: ActivityId; key?: string; events: GameEvent[] }

/** Every activity is a screen that ends with a result. The registry maps a kind to its screen. */
export interface ActivityScreen extends Screen<{ def: ActivityDef; course?: CourseDef }> {
  readonly result: Promise<ActivityResult | 'left'>;
}
export const ACTIVITY_SCREENS: Record<ActivityDef['kind'], (ctx: ScreenContext) => ActivityScreen>;

export interface CourseDef {
  id: CourseId; activity: ActivityId; tier: 'cadet' | 'pilot' | 'ace';
  seed: number; length: number;
  rocks: { count: number; minRadius: number; maxRadius: number; drift: number };
  gapMin: number; crystals: number;
  assist: 'full' | 'some' | 'little';      // picks a FlightConfig preset; never from items
  bumpPenaltyMs: number;                   // 2000
  smoothMaxBumps: number;                  // 3
}
/** Pure and seeded: the same course every time, so it can be tested and learned. */
export function buildCourse(def: CourseDef): { rocks: Body[]; crystals: Vec3[]; start: ShipState; finish: Body };
```

### 4.13 Flight with events (`src/flight/flightModel.ts`, extended)

```ts
export interface Contact { body: number; normal: Vec3 }         // index into context.obstacles
export interface FlightStep { state: ShipState; contacts: Contact[]; passed: number[] } // passed: checkpoint indexes

export interface FlightContext {
  target?: Body;
  obstacles?: Body[] | ObstacleIndex;   // a plain list as today, or a spatial grid for courses
  checkpoints?: Body[];                 // capsules, crystals, gates: pass through, no collision
  bounce?: { restitution: number; speedAfter: number };  // challenges: bounce instead of slide
}

/** New. Same physics as stepFlight, plus what happened this step. */
export function stepFlightWithEvents(s: ShipState, i: FlightInput, dt: number, ctx: FlightContext, cfg?: FlightConfig): FlightStep;
/** Unchanged signature, so every existing test and caller keeps working. */
export function stepFlight(s: ShipState, i: FlightInput, dt: number, ctx: FlightContext, cfg?: FlightConfig): ShipState;
export interface ObstacleIndex { near(p: Vec3, radius: number): number[] }   // uniform grid, built once per course
```

### 4.14 Rendering (`src/render/`)

```ts
export interface RendererHost {
  readonly renderer: THREE.WebGLRenderer;          // the only one, as today
  readonly quality: Quality;
  setQuality(q: Quality): void;
  onContextLost(fn: () => void): () => void;       // #31
  onContextRestored(fn: () => void): () => void;
  size(): { width: number; height: number; pixelRatio: number };
}

/** Each 3D scene draws one screen. It gets a frame of plain data and never reads game state itself. */
export interface RenderScene<F> {
  update(frame: F, dt: number): void;
  render(host: RendererHost): void;
  project(p: Vec3): ScreenPoint;                    // for HTML tags and toasts (exists today)
  dispose(): void;
}
export interface SpaceFrame {
  ship: ShipState; boosting: boolean; look: RocketLookView;
  target?: PlaceId; capsules: { id: CapsuleId; position: Vec3 }[];
  rocks?: Body[]; crystals?: { position: Vec3; taken: boolean }[]; bumpAt?: Vec3;
}
export interface RocketLookView { paint: string; decal?: AssetId; exhaust: string; parts?: AssetId; gear?: AssetId }
```

Scenes: `SpaceScene` (exists, extended for capsules, rocks, crystals and looks), `PanoramaScene` (exists: panorama, window and fly-by), `HangarScene` (new: rocket turntable; the astronaut in Phase 2). Each takes a frame and draws it. The flight model, the course builder and the progression code know nothing about them.

### 4.15 Platform services (`src/platform/`)

```ts
// Save
export interface SaveStore {
  read(): SaveData;
  update(change: (s: SaveData) => SaveData): SaveData;   // read stored → merge → change → write (as PR #14 does today)
  onChange(fn: (s: SaveData) => void): () => void;       // also fires on the 'storage' event from another window
  readonly revision: number;
}
export interface SettingsStore {                          // rocketpals.settings, extended
  get(): Settings; set(change: Partial<Settings>): Settings; onChange(fn: (s: Settings) => void): () => void;
}
export interface Settings {
  textSize: 'normal' | 'big' | 'huge';                    // exists
  reducedMotion: 'system' | 'on' | 'off';                 // exists
  volume: { effects: number; music: number; voice: number }; // 0..1
  assist: 'full' | 'some' | 'little';
  boost: 'hold' | 'toggle';
}

// Assets
export interface AssetEntry {
  id: AssetId; type: 'texture' | 'model' | 'image' | 'sound' | 'font';
  url: { high: string; low?: string }; bytes: number; credit: string;   // credit: a CREDITS.md entry id
}
export interface AssetManager {
  acquire<T>(id: AssetId): Promise<T>;   // loads at the current quality, counts users
  release(id: AssetId): void;            // frees GPU memory when the last user releases
  preload(ids: AssetId[]): void;         // low priority, after the first frame
}

// Audio
export type Channel = 'effects' | 'music' | 'voice';
export interface SoundDef { id: SoundId; file: AssetId; channel: Channel; volume: number; caption: string }
export interface AudioManager {
  play(id: SoundId): void;               // silently does nothing before the first tap, or when muted
  music(id: SoundId | null): void;       // Phase 2
  setVolume(channel: Channel, v: number): void;
  unlock(): void;                        // called on the first tap or key
}

// Input
export type Action = 'boost' | 'starMap' | 'menu' | 'back' | 'confirm' | 'listen';
export interface InputSource { read(): Partial<FlightInput>; readonly active: boolean; dispose(): void }
export interface InputManager {
  flight(): FlightInput;                 // all sources merged (as InputController.read() today)
  onAction(a: Action, fn: () => void): () => void;
  isSteering(): boolean;
  setSources(kinds: ('keyboard' | 'touchStick' | 'pointerDrag' | 'gamepad')[]): void;
}
```

## 5. The systems

For each: what it does, what exists today, what changes, the data, and the tests.

### 5.1 Three.js scene architecture
* **Today:** `SpaceScene` creates the renderer and draws space; `PanoramaScene` borrows the renderer; `Game.tick` decides which one renders.
* **Change:** a `RendererHost` (section 4.14) takes ownership of the renderer, the canvas, resizing, the pixel ratio, quality and context loss. Each scene implements `RenderScene` and gets a plain-data frame. The screen that is active asks its scene to render. Only one scene draws a frame, so there is one WebGL context and no hidden drawing.
* **New scenes:** `HangarScene` for the turntable. The asteroid course is drawn by `SpaceScene` with rocks as one `InstancedMesh`, not a new scene, so the rocket, lighting and effects are shared.
* **Look:** tone mapping, the environment map, atmospheres, the ring and the nebula live in `SpaceScene`, switched by quality (VISUAL_DESIGN.md section 5).
* **Tests:** the existing pixel-sampling browser tests; a test that leaving each screen frees its textures (a `renderer.info.memory` count before and after).

### 5.2 Game state management
* **Today:** `Game` holds the ship, the target, the mode, the progress and the settings as private fields.
* **Change:** state is split by how long it lives:

| State | Lives | Owner | Example |
| --- | --- | --- | --- |
| **Content** | the whole run, read-only | `Content` from the loader | worlds, missions, items |
| **Save** | across visits | `SaveStore` | dots found, best times, equipped paint |
| **Derived** | recomputed when the save changes | `deriveProgression` (memoised by `revision`) | XP, rank, stars, unlocks, patches |
| **Session** | until the screen is left | the active screen | the ship, the target, the open quiz run, this visit's camera |
| **Settings** | across visits | `SettingsStore` | text size, volumes, assist |

* **One-way flow:** a screen emits a `GameEvent`; the progression recorder turns it into a save change; the save store notifies; the UI re-renders from the new `ProgressionView`; the reward screen shows the `RewardDiff`. No component edits the save directly except the recorder.
* **Tests:** the recorder is pure (`record(save, event, content) → save`) and unit-tested for every event type.

### 5.3 Mission system
* **Today:** `missions.json` holds one "find N" mission per world; `Game` counts dots found on this visit and sets `missionDone`.
* **Change:** missions are data (`MissionDef`, section 4.7) with a `goal: Condition`. Whether a mission is done is **derived** from the save, never stored. That covers "find 3", Grand Tour steps, side missions, Orbit's requests and rescues with one evaluator. The mission board reads `ProgressionView.missions`; "Go" sets the course to `mission.place`.
* **Rescues** add `RescueDef { near: PlaceId; offset: Vec3; towMass: number; home: PlaceId }`. The tow uses the flight model's `speedResponse` scaled by the mass (lesson: inertia). Finishing emits `rescueDone`.
* **Data checks:** every condition points at real ids; every chapter step exists; text limits as today.

### 5.4 Player progression
* **Change:** `deriveProgression` (section 4.6) computes the rank from XP with the `ranks` table, and stars per place and per course from the save. Nothing about progression is stored except the facts it is built from.
* **Tests:** a full "play everything once" fixture checks the total (about 1,150 XP, rank 7, from GAME_DESIGN.md); ranks never go down for any merge of two saves (a property test with random saves).

### 5.5 XP and rewards
* **XP** = first-time XP for each fact in the save (each dot, capsule, quiz, course star, chapter and so on) + repeat XP from `repeats` (capped at `repeatCap` per activity). Values come from `progression.json`.
* **Repeat counters** are the one place a merge can lose a little: two windows replaying at the same moment keep the higher count, not the sum. That is at most a few XP and never a star, a patch or an item, and it is accepted on purpose.
* **Rewards** are shown, not stored: the reward screen calls `diffProgression(before, after)` around each event and shows stars, XP, rank-up, patches, items and pages. Patches record their first date in `patchDates` the first time they are seen as earned.
* **Tests:** the diff for each event type; no reward is ever random (a test runs each event twice from the same save and gets the same diff).

### 5.6 Customization inventory
* **Unlocked** = items whose `unlock` condition is met (derived). **Equipped** = `save.equipped[slot]` (newest wins on merge). A slot with nothing equipped, or with an item that is not unlocked, falls back to the slot's starter item, so a strange save can never show a locked item.
* **Applying a look:** the Hangar and space screens build a `RocketLookView` from the equipped items and pass it in the render frame. `SpaceScene` recolours the ship's `Trim` material and `Flame` (both exist in `ship.glb`), and puts the decal texture on the hull.
* **Data checks:** each slot has exactly one starter item; every unlock condition is valid; colours meet contrast where they are used behind text (exhaust and paint are not).

### 5.7 Rocket upgrades
* **Upgrades are gear** (section 4.8): equipping one gives a `Capability`. The capabilities of equipped gear go to the screens that use them (the fly-by view shows hidden dots with `telescope`; the activity list shows the Messenger with `radio`).
* **Guard:** a unit test checks that `FlightConfig` is built only from `Settings.assist` and `CourseDef.assist`.

### 5.8 Educational content data
* **Files** in `public/data/` (existing ones extended, new ones added): `planets.json`, `surfaces.json` (arrivals for all 11 places), `quizzes.json` (pools), `capsules.json`, `missions.json`, `chapters.json`, `progression.json`, `items.json`, `patches.json`, `activities.json`, `courses.json`, `sounds.json`, `looks.json`.
* **One loader:** `loadContent()` fetches them in parallel, validates each with today's style of validator (word and sentence limits, NASA sources, `lastChecked` dates, evidence phrases), checks cross-references (every id points at something real), and builds the `Content` maps.
* **Fail soft per entry, not per file:** an invalid question drops that question (or that world's pool), not every world's quiz (#30). The dropped entries go to `content.problems` and the console. The unit tests load the real files and require `problems` to be empty, so a broken entry never ships.
* **Journal pages** are the dots themselves; capsule facts are `capsules.json`; spacecraft cards (Phase 2) are `spacecraft.json` with an `unlock` condition.

### 5.9 Mini-game architecture
* **One shape for all:** an `ActivityDef` in data plus an `ActivityScreen` in code (section 4.12). The screen ends with a result, made of events, so the progression recorder, rewards, sound and the mission board work for every activity with no extra code.
* **Flight courses** (Asteroid Belt Run, later the Ring Slalom and the Comet Chase) share one `FlightCourseScreen`: `buildCourse` (pure, seeded) makes the rocks and crystals, `stepFlightWithEvents` reports bumps and pickups, and a stopwatch counts up. A new course is a new entry in `courses.json`.
* **HTML mini-games** (Planet Lineup, Weigh-in, Messenger) are screens with no 3D of their own, drawn over the paused space scene. Photo Detective runs inside the arrival screen, reusing `PanoramaScene` and the dot positions.
* **Rules for every activity:** a Leave button that keeps what was collected; no countdown; no failure state; Listen on every text.

### 5.10 Planet environments
* **In space:** each place's look comes from `looks.json` (texture, atmosphere, ring) and is drawn by `SpaceScene`. Textures load through the asset manager at the current quality. The asteroid belt is a band of instanced rocks seen from afar, and the course itself when you arrive.
* **On arrival:** `ArrivalDef.kind` picks the view. `panorama` (Mars) and `window` (Earth) exist today. `flyby` is the window view with a cockpit frame and a spacecraft photo, so the 7 new worlds and the Moon need data and photos, not new rendering code. `course` (the belt) starts the Asteroid Belt Run.

### 5.11 Asset loading
* **Today:** the ship GLB loads lazily with a fallback; landing photos load on landing, at 4096 or 2048 px.
* **Change:** one `AssetManager` (section 4.15) loads everything through a manifest (`src/assets/manifest.ts`):
  * Each entry has a high and a low URL, its size in bytes, and its credit.
  * Textures decode off the main thread (`ImageBitmapLoader`) to avoid the freeze on landing (#31).
  * Screens acquire what they need on `enter` and release it on `leave`; the last release frees the GPU memory.
  * After a lost context, the manager uploads the assets still in use again.
  * A missing or broken asset falls back (a generated texture, the placeholder rocket, no sound) and is logged once, never a crash.
* **Tests:** every manifest entry has a file, a size within budget and a `CREDITS.md` entry; the first-play download is under budget (CI, #27).

### 5.12 Audio management
* **Today:** read-aloud only (`audio/speech.ts`, Web Speech). Howler is installed but unused.
* **Change:** an `AudioManager` (section 4.15) loads Howler with a dynamic `import()` after the first tap or key, so it costs nothing before then and no sound can play before the browser allows it.
  * Sounds are data (`sounds.json`): file, channel, volume and a caption.
  * Cues are a small table from events to sounds (`dotFound` → `dot-found`), so game code never calls `play` for feedback.
  * There are three volumes: effects, music and voice. Voice applies to the existing speaker.
  * Every sound has a visual partner, so nothing needs sound to play.
* **Tests:** the cue table covers every event that should make a sound; nothing plays before `unlock()` (unit test with a fake Howler); browser test with audio blocked still plays.

### 5.13 Save and load persistence
* **Today:** `rocketpals.progress` holds per-world flags, with a read-merge-write on every save (PR #14). `rocketpals.settings` holds text size and motion.
* **Change (#29):** the `SaveData` v2 format (section 4.5) and a `SaveStore`:
  * migrates from v1 and from no version, and keeps unknown fields;
  * merges every field by its declared rule, and writes after every recorded event;
  * listens for the `storage` event, so another window's progress shows up here too (it is loaded only once today);
  * never throws, and works in memory when storage is blocked, as today.
* **Kept from today:** the `localStorage` keys, the "stars only go up" guarantee, and no backend (section 1).
* **Tests:** v1 fixtures from today's real saves load with every star; a merge property test with random pairs (never loses a found dot, a flag or a patch date); a two-window browser test, as today; a "newer version" fixture keeps its unknown fields.

### 5.14 Responsive controls
* **Today:** `InputController` merges keyboard and a fixed touch stick into `FlightInput`; the stick shows for `?touch=1`, coarse pointers or after a first touch.
* **Change:** an `InputManager` with separate `InputSource`s:
  * keyboard (as today);
  * touch stick (floating: it appears under the thumb, anywhere in the left half);
  * pointer drag (mouse and touchpad: drag on empty space to steer, for Chromebooks);
  * gamepad (Phase 2).
  * Actions (boost, Star Map, menu, back, confirm, Listen) come from one binding table. Boost honours `Settings.boost` (hold or toggle).
* **Layout stays in CSS** (VISUAL_DESIGN.md breakpoints). Code only decides which sources and controls are on. Focus handling stays in `ui/focus.ts`.
* **Tests:** each source unit-tested with fake events; the existing browser tests for keyboard and touch; new ones for pointer drag and the floating stick at the phone sizes.

## 6. Map from gameplay to code

| Gameplay system (GAME_DESIGN.md) | Exists today | Changes | New modules and data | Issue |
| --- | --- | --- | --- | --- |
| Core loop and screens | `game.ts` modes | Split into screens | `app/screens.ts`, `screens/*` | #32 |
| Welcome, First flight | — | — | `screens/welcomeScreen.ts`, `ui/welcome.ts` | #18, #19 |
| Star Map | `ui/hud.ts` picker | Replaced by an overlay | `ui/starMap.ts`, `data/places` | #19 |
| Cockpit HUD | `ui/hud.ts` stats | Instruments, honest speed | `ui/cockpitHud.ts` | #30, #21 |
| Flying and capsules | `flight/flightModel.ts`, `scene/spaceScene.ts` | Events, checkpoints | `capsules.json`, `core/capsules.ts` | #19 |
| Landing and fly-by | `surface/*`, `ui/surfaceHud.ts` | `flyby` kind, cockpit frame, remembered dots | `surfaces.json` entries | #19 |
| Quizzes and postcards | `quiz/quiz.ts`, `ui/quizPanel.ts` | Pools, levels, seeded draw | `quizzes.json` pools | #19 |
| Missions and Grand Tour | `data/missions.ts` | Conditions, derived | `chapters.json`, `core/conditions.ts`, `ui/missionBoard.ts` | #19, #20 |
| XP, ranks, stars | `core/progress.ts` stars | Derived progression | `core/progression/`, `progression.json` | #20 |
| Reward screen, toasts | — | — | `ui/rewardScreen.ts`, `ui/toast.ts` | #20 |
| Save | `core/progress.ts` | v2 format, schema merge | `core/save/`, `platform/saveStore.ts` | #29 |
| Rocket customization | `ship.glb` `Trim` and `Flame` | Looks in the render frame | `items.json`, `screens/hangarScreen.ts`, `render/hangarScene.ts` | #20 |
| Gear | — | — | `Capability`, `items.json` gear | Phase 2 |
| Astronaut | — | — | astronaut model, `HangarScene` | Phase 2, #23 |
| Asteroid Belt Run | flight obstacles | Bounce, grid, courses | `activities/flightCourse.ts`, `courses.json` | #19 |
| Educational mini-games | — | — | `activities/*`, `activities.json` | Phase 2 |
| Journal, patches | dots, `surfaceHud` ticks | Remembered dots | `ui/journal.ts`, `ui/patchBoard.ts`, `patches.json` | #20 |
| Sound, Listen everywhere | `audio/speech.ts` | Volume for voice | `platform/audio.ts`, `sounds.json` | #34 |
| Quality and context loss | `quality/*` | Host owns renderer | `render/rendererHost.ts` | #31 |
| Assets | `shipModel.ts`, photo loads | Manifest, ref counts | `platform/assets.ts`, `assets/manifest.ts` | #31, #22 |
| Controls | `flight/input.ts` | Sources, actions | `platform/input/*` | #24 |
| Visual system | `style.css` | Tokens, components | `ui/styles/*`, `ui/tokens.ts`, `public/fonts/` | #21 |

## 7. How one action flows through the game

A kid taps the third dot on Mars.

```
SurfaceHud (ui)          ArrivalScreen (screens)        core (pure)                    platform / ui
───────────────          ───────────────────────        ───────────                    ─────────────
tap "Why is Mars red?" ─▶ events.emit({dotFound,
                          dot:'mars/ground'})
                                 │
                                 ├──────────────▶ recorder: record(save, e) ─▶ SaveStore.update(...)
                                 │                 dots ∪ {'mars/ground'}       read → merge → write
                                 │                                               │
                                 │               deriveProgression(save) ◀───────┘ onChange
                                 │               diffProgression(before, after)
                                 │                 = { xpGained: 25, newStars: mars 1,
                                 │                     missionsDone: ['find-3-mars'], newPages: [...] }
                                 │                                               │
                                 ├──────────────▶ AudioCues: 'dotFound' ─▶ AudioManager.play('dot-found')
                                 │                                               │
                                 └──────────────▶ OverlayStack.toast / reward screen ◀┘
                                                  SurfaceHud.setProgress(view) (mission line, stars)
```

No part needs to know about the others: the HUD knows only that a dot was tapped, the recorder knows only the save, and the reward screen knows only the diff.

## 8. How to extend it

| To add | Change | Code? |
| --- | --- | --- |
| A fly-by world's content | `surfaces.json` arrival, `quizzes.json` postcard pool, the photo in the manifest, a `CREDITS.md` line | No |
| A side mission or Orbit's request | `missions.json` entry with a `goal` condition | No |
| A patch | `patches.json` entry with a `condition` | No |
| A rocket paint, decal or exhaust | `items.json` entry (and a decal texture) | No |
| A new course for an existing challenge | `courses.json` entry | No |
| A sound | `sounds.json` entry and a cue | One line in the cue table |
| A new kind of goal (for missions, patches and unlocks) | A new `Condition` variant and its case in `isMet` and `progressOf` | Small, in one file |
| A new mini-game | An `ActivityDef` kind, its `ActivityScreen`, an `activities.json` entry | One new screen |
| A new screen | A `ScreenId` and a `Screen` class | One new screen |
| A new kind of saved fact | A `SaveData` field, its `MergeRule`, a migration step | Small, with tests |

## 9. Testing

| Layer | How | Tools |
| --- | --- | --- |
| Logic (flight, courses, conditions, progression, recorder, save, quiz draw) | Unit and property tests with seeded randomness, as the flight model has today | Vitest |
| Content | The real JSON files load with zero `problems`; every cross-reference resolves; every asset has a credit | Vitest |
| Architecture | Import rules per layer (section 3) | Vitest, reading files |
| Platform | Fake storage, fake Howler, fake speech (exists), fake input events | Vitest |
| Screens and UI | Each flow end to end at the four reference sizes, every text size, reduced motion, low quality, storage blocked, audio blocked, no network calls | Playwright (as today) |
| Rendering | Pixel sampling for key effects (as today); textures freed on leave | Playwright |
| Performance | Bundle and first-play size in CI; frame rate and memory on a real Chromebook at the milestones that change rendering | CI (#27), a person (#28) |

The debug handle (`?debug=1` only, #30) grows with typed hooks the browser tests need (`dockAt`, `emit`, `progression`). It stays in the build, because the browser tests run against the production build, but it only reads state and starts normal game paths; it never edits the save directly.

## 10. Getting there without a rewrite

Each step is one PR, keeps every existing test passing, and leaves the game playable.
1. **Save v2 and `SaveStore`** (#29), behind today's `Game.earn`.
2. **`RendererHost` and the screen manager** (#32, #31): `SpaceScreen` and `ArrivalScreen` take today's code out of `Game` unchanged.
3. **Events, conditions and progression** in `core/`, with today's missions and stars re-expressed as conditions and derived. No visible change; the tests prove it.
4. **`loadContent`** replaces the four loaders in `main.ts`, with per-entry fail-soft.
5. **Tokens and components** (#21, first part) under today's look.
6. **New features**, each through an extension point: Star Map and the reward screen, fly-by content, capsules, the belt course, the Hangar, the Journal and patches, sound.
7. **`InputManager`** when the pointer and floating-stick controls are added (#24).

Folders: new code goes into new folders (`app/`, `screens/`, `activities/`, `render/`, `platform/`, `core/save/`, `core/progression/`). Existing files move only when a PR is already changing them, so history stays easy to follow.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Splitting `Game` breaks subtle behaviour (landing races, focus, quality) | It is done first, with no behaviour change, and the 136 browser tests must pass unchanged (#32) |
| Derived progression gets slow as content grows | Memoised by save revision; the whole game is a few hundred facts. Measured in a unit test with a full save |
| Old tabs overwrite new data | v2 keeps unknown fields and merges by schema; a browser test covers it (#29) |
| Content work (photos, licences, questions) is the real bottleneck | Fly-by worlds need data, not code; each world can ship alone |
| Chromebook performance with new effects | Quality tiers, the budget in VISUAL_DESIGN.md section 11, and measurement (#28) before effects are committed |
| Too many new abstractions at once | Each interface arrives with its first real user, never ahead of it |

## 12. Decisions (approved 2026-11-11)

1. **No backend;** saves stay in `localStorage` (section 1).
2. **Derived progression:** XP, rank, stars, mission and chapter status, patches, unlocks and Journal pages are worked out from saved facts, never stored (section 4.5).
3. **One condition language** for missions, patches and unlocks (section 4.3).
4. **One event stream** that screens publish to; progression, sound and rewards subscribe (section 4.4).
5. **Layer rules enforced by a test** (section 3).
6. **Rocket upgrades are gear with capabilities,** kept away from flight settings by construction (section 4.8).
7. **Every activity is a screen that ends with events** (section 4.12).
8. **Howler loads after the first tap,** with sounds and cues as data (section 5.12).
9. **Repeat counters may lose a few XP** when two windows replay at the same moment; nothing else can be lost (section 5.5).
