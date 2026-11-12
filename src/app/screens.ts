/**
 * Screens (docs/TECHNICAL_ARCHITECTURE.md 4.11). Each screen owns one part of the game (flying in space, standing on a
 * world) and builds and frees its own things. `Game` keeps what is shared and hands each frame to the active screen.
 *
 * `ScreenId` and `Screen` are 4.11 as written. `ScreenContext` holds only what exists today: the members that match
 * 4.11 keep its names, and each stand-in has a different name, so nobody takes it for the 4.11 contract.
 * See decisions/2026-11-11-screen-split.md.
 */
import type { Speaker } from '../audio/speech';
import type { Content } from '../data/content';
import type { Surface } from '../data/surfaces';
import type { InputManager } from '../platform/input/inputManager';
import type { SaveStore } from '../platform/saveStore';
import type { RendererHost } from '../render/rendererHost';
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

export interface ScreenContext {
  save: SaveStore; // 4.11
  speech: Speaker; // 4.11
  go<P>(screen: ScreenId, params: P): Promise<void>; // 4.11
  input: InputManager; // 4.11 (#41)
  content: Content; // 4.11 (#38)
  renderer: RendererHost; // 4.11 (#31): the one WebGLRenderer, its canvas, quality and a lost context
  // Stand-ins, each replaced when its 4.11 member arrives:
  /** Where screens add their HTML. → `overlays` (OverlayStack) */
  stage: HTMLElement;
  /** The space picture. → a `RenderScene` (4.14) when frames arrive. */
  scene: SpaceScene;
  /** Where each world sits in space, worked out once from `content.worlds`. → part of the space `RenderScene` (4.14) */
  layouts: BodyLayout[];
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
