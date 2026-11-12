/**
 * Screens (docs/TECHNICAL_ARCHITECTURE.md 4.11). Each screen owns one part of the game (flying in space, standing on a
 * world) and builds and frees its own things. `Game` keeps what is shared and hands each frame to the active screen.
 *
 * `ScreenId` and `Screen` are 4.11 as written. `ScreenContext` holds only what exists today: the members that match
 * 4.11 keep its names, and each stand-in has a different name, so nobody takes it for the 4.11 contract.
 * See decisions/2026-11-11-screen-split.md.
 */
import type { Speaker } from '../audio/speech';
import type { Mission } from '../data/missions';
import type { QuizQuestionData } from '../data/quizzes';
import type { Surface } from '../data/surfaces';
import type { InputController } from '../flight/input';
import type { SaveStore } from '../platform/saveStore';
import type { Quality } from '../quality/quality';
import type { BodyLayout } from '../scene/layout';
import type { SpaceScene } from '../scene/spaceScene';

export type ScreenId = 'welcome' | 'space' | 'arrival' | 'activity' | 'hangar';

export interface Screen<P = unknown> {
  readonly id: ScreenId;
  enter(params: P): Promise<void>; // acquire assets, build UI, start listening
  update(dt: number, now: number): void; // every frame while active and not paused
  resize(width: number, height: number): void;
  pause(): void;
  resume(): void; // Mission Control and dialogs pause the screen
  leave(): Promise<void>; // stop listening, release assets, remove UI
}

/** The game's content, read once at start. Stand-in for 4.11 `content` (Content, #38). */
export interface GameData {
  layouts: BodyLayout[];
  surfaces: Map<string, Surface>;
  missions: Map<string, Mission>;
  quizzes: Map<string, QuizQuestionData[]>;
}

export interface ScreenContext {
  save: SaveStore; // 4.11
  speech: Speaker; // 4.11
  go<P>(screen: ScreenId, params: P): Promise<void>; // 4.11
  // Stand-ins, each replaced when its 4.11 member arrives:
  /** Where screens add their HTML. → `overlays` (OverlayStack) */
  stage: HTMLElement;
  /** Owns the one WebGLRenderer and its canvas. → `renderer` (RendererHost, #31) */
  scene: SpaceScene;
  /** Keyboard and touch. → `input` (InputManager, #24) */
  controls: InputController;
  /** → `content` (Content, #38) */
  data: GameData;
  /** The quality the game draws at now. → `renderer.quality` (#31) */
  quality(): Quality;
  /** → `settings` (SettingsStore) */
  reducedMotion(): boolean;
  /** True while a panel (settings) covers the screen, so its own dialogs leave the keys alone. → `overlays` (OverlayStack) */
  isCovered(): boolean;
}

/** `SpaceScreen`: `liftOff` lifts off from the world just visited (Back to space, Fly again). */
export interface SpaceParams {
  liftOff?: boolean;
}

/** `ArrivalScreen`: the world's photograph and its dots. */
export interface ArrivalParams {
  surface: Surface;
}
