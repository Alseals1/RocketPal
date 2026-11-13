import type { FlightInput } from '../../flight/flightModel';

export type SourceKind = 'keyboard' | 'touchStick' | 'pointerDrag' | 'gamepad';

/** One way of steering (docs/TECHNICAL_ARCHITECTURE.md 4.15, as written). */
export interface InputSource {
  read(): Partial<FlightInput>;
  readonly active: boolean;
  dispose(): void;
}

/**
 * What the `InputManager` also needs from each of its own sources. Internal to `platform/input/`; the 4.15
 * `InputSource` is unchanged. `active` is true while the source is switched on by `setSources`.
 */
export interface ManagedSource extends InputSource {
  readonly kind: SourceKind;
  /** True while the player is steering with this source (used to cancel autopilot). */
  isSteering(): boolean;
  /** Lets go of every key, finger and button this source holds. */
  release(): void;
  /** Switched off, a source reads nothing and fires no action. */
  setEnabled(on: boolean): void;
}
