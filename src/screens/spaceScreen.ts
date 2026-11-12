import type { ArrivalParams, Screen, ScreenContext, SpaceParams } from '../app/screens';
import type { WorldId } from '../data/ids';
import type { World } from '../data/planets';
import { arrivalWording } from '../data/surfaces';
import { DEFAULT_FLIGHT, createShip, dockDistance, stepFlight, type Body, type FlightInput, type ShipState } from '../flight/flightModel';
import {
  formatDistanceKm,
  formatDuration,
  formatSpeed,
  lightTravelSeconds,
  pretendSpeedNote,
  realDistanceRemainingKm,
  realSpeedKmPerSec,
  REAL_ROCKET_COMPARISON,
} from '../scale/readout';
import { planLeg } from '../scale/leg';
import type { BodyLayout } from '../scene/layout';
import { Hud } from '../ui/hud';

const START_POSITION = { x: 0, y: 40, z: 330 }; // near the Sun, facing it
const STATS_EVERY_MS = 250;
const AUTOPILOT_INPUT: FlightInput = { turn: 0, pitch: 0, boost: true };

/**
 * Flying the rocket between the worlds. The ship, the target and the space HUD last for the whole run: during a visit
 * to a world the HUD is hidden (the `is-surface` class), not destroyed, so `enter` and `leave` only do the per-visit part.
 */
export class SpaceScreen implements Screen<SpaceParams> {
  readonly id = 'space';
  private readonly layouts: BodyLayout[];
  private readonly hud: Hud;
  private ship: ShipState;
  private targetId: string | null = null;
  /** The world the rocket is right next to, if any. You cannot pick it as a destination. */
  private here: string | null = null;
  private autopilot = false;
  private lastStats = 0;
  private sceneLeg = 1;
  private legKm = 0;

  constructor(private readonly ctx: ScreenContext) {
    this.layouts = ctx.layouts;
    this.ship = this.startFacing('earth');
    this.hud = new Hud(ctx.stage, this.layouts, {
      onSelect: (id) => this.pickTarget(id),
      onAutopilot: (on) => this.setAutopilot(on),
      onFlyAgain: () => this.flyAgain(), // the plain landing card: no screen to change
      isCovered: () => ctx.isCovered(),
    });
    this.refreshHere();
    this.hud.setAutopilot(false);

    // The Blender rocket (and the code that reads it) loads after the first frame.
    // If it cannot load, the simple rocket stays and the game carries on.
    requestAnimationFrame(() => {
      import('../scene/shipModel')
        .then(({ loadShipModel }) => loadShipModel())
        .then((ship) => ctx.scene.useShipModel(ship))
        .catch((error) => console.warn('Rocket model not loaded, keeping the simple rocket.', error));
    });
  }

  /** `liftOff`: after landing, lift off again. On start there is nothing to do. */
  async enter({ liftOff }: SpaceParams): Promise<void> {
    if (liftOff) this.flyAgain();
  }

  /** Nothing of its own to free: the ship and HUD stay for the run, and the scene belongs to the game. */
  async leave(): Promise<void> {}

  pause(): void {} // nothing pauses a screen yet
  resume(): void {}

  resize(width: number, height: number): void {
    this.hud.setViewport(width, height);
  }

  update(dt: number, now: number): void {
    const { controls, scene } = this.ctx;
    if (this.autopilot && controls.isSteering()) this.setAutopilot(false);
    const input = this.autopilot ? AUTOPILOT_INPUT : controls.read();

    const wasDocked = this.ship.docked;
    const targetLayout = this.targetId ? this.layout(this.targetId) : undefined;
    this.ship = stepFlight(this.ship, input, dt, {
      target: targetLayout ? this.body(targetLayout) : undefined,
      obstacles: this.layouts.filter((l) => l !== targetLayout).map((l) => this.body(l)),
    });
    if (this.ship.docked && !wasDocked && targetLayout) this.onDocked(targetLayout);

    scene.update(dt, this.ship, input.boost);
    this.hud.updateTags(
      (l) => scene.project(l.position),
      (l) => distance(this.ship.position, l.position),
    );
    scene.render();

    if (now - this.lastStats > STATS_EVERY_MS) {
      this.lastStats = now;
      this.refreshHere();
      this.updateStats();
    }
  }

  // For the debug handle.
  get shipState(): ShipState {
    return this.ship;
  }

  get target(): string | null {
    return this.targetId;
  }

  world(id: string): World | undefined {
    return this.layout(id)?.world;
  }

  pickTarget(id: string): void {
    const layout = this.layout(id);
    if (!layout || this.ship.docked || id === this.here) return;
    this.targetId = id;
    this.autopilot = false;
    this.hud.setAutopilot(false);

    // The trip starts from the world nearest the rocket right now, wherever it is.
    const leg = planLeg(this.ship.position, this.layouts, id);
    this.legKm = leg.legKm;
    this.sceneLeg = leg.sceneLeg;
    this.hud.setPlaces(this.here, id);
    this.updateStats();
  }

  setAutopilot(on: boolean): void {
    if (on && (!this.targetId || this.ship.docked)) return;
    this.autopilot = on;
    this.hud.setAutopilot(on);
  }

  /** For the browser tests only (page address has ?debug=1): dock at a world straight away, through the normal landing path. */
  dockAt(id: string): void {
    const layout = this.layout(id);
    if (!layout || this.ship.docked) return;
    this.targetId = id;
    const dock = dockDistance(this.body(layout));
    this.ship = {
      ...createShip({ x: layout.position.x + dock, y: layout.position.y, z: layout.position.z }),
      speed: 0,
      docked: true,
    };
    this.onDocked(layout);
  }

  /** After landing: lift off again, facing away from the world you visited. */
  private flyAgain(): void {
    const layout = this.layout(this.targetId ?? '');
    if (!layout) return;
    const away = {
      x: this.ship.position.x - layout.position.x,
      y: this.ship.position.y - layout.position.y,
      z: this.ship.position.z - layout.position.z,
    };
    this.ship = {
      ...createShip(this.ship.position, Math.atan2(-away.x, -away.z), 0),
      speed: DEFAULT_FLIGHT.cruiseSpeed,
    };
    this.targetId = null;
    this.autopilot = false;
    this.hud.hideLanded();
    this.hud.setAutopilot(false);
    this.refreshHere();
    this.updateStats();
  }

  /** The rocket has docked: stand on the world if it has a real photograph, or show the plain landing card. */
  private onDocked(layout: BodyLayout): void {
    this.autopilot = false;
    this.hud.setAutopilot(false);
    const surface = this.ctx.content.arrivals.get(layout.world.id as WorldId);
    const showLanded = () => this.hud.showLanded(layout.world.name, arrivalWording(layout.world.id));
    if (!surface) {
      showLanded();
      return;
    }
    this.ctx.go<ArrivalParams>('arrival', { surface }).catch((error) => {
      console.error(error);
      showLanded(); // the picture could not be loaded: fall back to the plain landing card
    });
  }

  /** Finds the world the rocket is right next to (if any), so the picker can say "you're here". */
  private refreshHere(): void {
    let found: string | null = null;
    for (const layout of this.layouts) {
      if (distance(this.ship.position, layout.position) <= dockDistance(this.body(layout)) * 3) {
        found = layout.world.id;
        break;
      }
    }
    if (found !== this.here) {
      this.here = found;
      this.hud.setPlaces(this.here, this.targetId);
    }
  }

  private updateStats(): void {
    const layout = this.targetId ? this.layout(this.targetId) : undefined;
    if (!layout) {
      this.hud.setStats({ title: 'Where to, pilot?', distance: 'Tap "Where to?" and pick a world.', light: '', speed: '', speedNote: '', comparison: '' });
      return;
    }
    if (this.ship.docked) {
      const distance = arrivalWording(layout.world.id) === 'flyingPast' ? 'Great flying!' : 'Great landing!';
      this.hud.setStats({ title: `You are at ${layout.world.name}`, distance, light: '', speed: '', speedNote: '', comparison: '' });
      return;
    }
    const sceneRemaining = Math.max(0, distance(this.ship.position, layout.position) - dockDistance(this.body(layout)));
    const km = realDistanceRemainingKm(this.legKm, sceneRemaining, this.sceneLeg);
    const pretendSpeed = realSpeedKmPerSec(this.ship.speed, this.legKm, this.sceneLeg);
    this.hud.setStats({
      title: `Flying to ${layout.world.name}`,
      speedNote: pretendSpeedNote(pretendSpeed),
      comparison: REAL_ROCKET_COMPARISON,
      distance: `${formatDistanceKm(km)} to go`,
      light: km > 0 ? `Light needs ${formatDuration(lightTravelSeconds(km))} to get there` : 'You are here!',
      speed: `Pretend speed: ${formatSpeed(pretendSpeed)}`,
    });
  }

  /** The rocket starts near the Sun, looking out toward the planets instead of at the Sun. */
  private startFacing(id: string): ShipState {
    const look = this.layout(id)?.position;
    if (!look) return createShip(START_POSITION);
    const dx = look.x - START_POSITION.x;
    const dy = look.y - START_POSITION.y;
    const dz = look.z - START_POSITION.z;
    return createShip(START_POSITION, Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
  }

  private layout(id: string): BodyLayout | undefined {
    return this.layouts.find((l) => l.world.id === id);
  }

  private body(layout: BodyLayout): Body {
    return { position: layout.position, radius: layout.radius };
  }
}

function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
