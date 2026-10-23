import type { PlanetData, World } from './data/planets';
import {
  DEFAULT_FLIGHT,
  createShip,
  dockDistance,
  stepFlight,
  type Body,
  type FlightInput,
  type ShipState,
} from './flight/flightModel';
import { InputController } from './flight/input';
import { FrameMonitor } from './quality/monitor';
import { chooseQuality, initialQuality, type Quality } from './quality/quality';
import {
  distanceBetweenKm,
  formatDistanceKm,
  formatDuration,
  formatSpeed,
  lightTravelSeconds,
  realDistanceRemainingKm,
  realSpeedKmPerSec,
} from './scale/readout';
import { layoutWorlds, type BodyLayout } from './scene/layout';
import { SpaceScene } from './scene/spaceScene';
import { Hud } from './ui/hud';

const START_POSITION = { x: 0, y: 40, z: 330 }; // near the Sun, facing it
const STATS_EVERY_MS = 250;
const QUALITY_CHECK_EVERY_MS = 2000;
const AUTOPILOT_INPUT: FlightInput = { turn: 0, pitch: 0, boost: true };

interface Options {
  /** 'high' or 'low' from the page address, to force a quality (and turn off the automatic chooser). */
  forcedQuality?: Quality;
  touchControls: boolean;
  reducedMotion: boolean;
  debug: boolean;
}

export class Game {
  private readonly layouts: BodyLayout[];
  private readonly scene: SpaceScene;
  private readonly hud: Hud;
  private readonly input: InputController;
  private readonly monitor = new FrameMonitor();

  private ship: ShipState = createShip(START_POSITION, 0, 0);
  private quality: Quality;
  private targetId: string | null = null;
  private currentId: string | null = 'sun';
  private autopilot = false;
  private lastFrame = 0;
  private lastStats = 0;
  private lastQualityCheck = 0;
  private sceneLeg = 1;
  private legKm = 0;

  constructor(root: HTMLElement, data: PlanetData, private readonly options: Options) {
    this.layouts = layoutWorlds(data.worlds);
    this.ship = this.startFacing('earth');
    this.quality = options.forcedQuality ?? initialQuality(readHardwareHints());

    const stage = document.createElement('div');
    stage.className = 'stage';
    root.appendChild(stage);

    this.scene = new SpaceScene(stage, this.layouts, this.quality, options.reducedMotion);
    this.input = new InputController(stage, options.touchControls);
    this.hud = new Hud(stage, this.layouts, {
      onSelect: (id) => this.pickTarget(id),
      onAutopilot: (on) => this.setAutopilot(on),
      onFlyAgain: () => this.flyAgain(),
    });
    this.hud.setPlaces(this.currentId, null);
    this.hud.setAutopilot(false);

    const resize = () => this.scene.setSize(stage.clientWidth, stage.clientHeight);
    new ResizeObserver(resize).observe(stage);
    resize();

    if (options.debug) this.exposeDebugHandle();
    requestAnimationFrame((t) => this.frame(t));
  }

  pickTarget(id: string): void {
    const layout = this.layout(id);
    if (!layout || this.ship.docked || id === this.currentId) return;
    this.targetId = id;
    this.autopilot = false;
    this.hud.setAutopilot(false);

    // The "leg" is the trip from the world you last visited. Real km and scene units are scaled together.
    const from = this.layout(this.currentId ?? 'sun')!;
    this.legKm = distanceBetweenKm(from.world, layout.world);
    this.sceneLeg = Math.max(1, distance(from.position, layout.position) - dockDistance(this.body(layout)));
    this.hud.setPlaces(this.currentId, id);
    this.updateStats();
  }

  setAutopilot(on: boolean): void {
    if (on && (!this.targetId || this.ship.docked)) return;
    this.autopilot = on;
    this.hud.setAutopilot(on);
  }

  /** After landing: lift off again, facing away from the world you visited. */
  flyAgain(): void {
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
    this.currentId = layout.world.id;
    this.targetId = null;
    this.autopilot = false;
    this.hud.hideLanded();
    this.hud.setAutopilot(false);
    this.hud.setPlaces(this.currentId, null);
    this.updateStats();
  }

  private frame(now: number): void {
    const dt = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 0.1) : 1 / 60;
    if (this.lastFrame) this.monitor.add(now - this.lastFrame);
    this.lastFrame = now;

    if (this.autopilot && this.input.isSteering()) this.setAutopilot(false);
    const input = this.autopilot ? AUTOPILOT_INPUT : this.input.read();

    const wasDocked = this.ship.docked;
    const targetLayout = this.targetId ? this.layout(this.targetId) : undefined;
    this.ship = stepFlight(this.ship, input, dt, {
      target: targetLayout ? this.body(targetLayout) : undefined,
      obstacles: this.layouts.filter((l) => l !== targetLayout).map((l) => this.body(l)),
    });
    if (this.ship.docked && !wasDocked && targetLayout) {
      this.autopilot = false;
      this.hud.setAutopilot(false);
      this.hud.showLanded(targetLayout.world.name);
    }

    this.scene.update(dt, this.ship, input.boost);
    this.hud.updateTags(
      (l) => this.scene.project(l.position),
      (l) => distance(this.ship.position, l.position),
    );
    this.scene.render();

    if (now - this.lastStats > STATS_EVERY_MS) {
      this.lastStats = now;
      this.updateStats();
    }
    if (!this.options.forcedQuality && now - this.lastQualityCheck > QUALITY_CHECK_EVERY_MS) {
      this.lastQualityCheck = now;
      const next = chooseQuality(this.monitor.samples(), this.quality);
      if (next !== this.quality) {
        this.quality = next;
        this.scene.applyQuality(next);
      }
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  private updateStats(): void {
    const layout = this.targetId ? this.layout(this.targetId) : undefined;
    if (!layout) {
      this.hud.setStats({ title: 'Where to, pilot?', distance: 'Tap "Where to?" and pick a world.', light: '', speed: '', showNote: false });
      return;
    }
    if (this.ship.docked) {
      this.hud.setStats({ title: `You are at ${layout.world.name}`, distance: 'Great landing!', light: '', speed: '', showNote: false });
      return;
    }
    const sceneRemaining = Math.max(0, distance(this.ship.position, layout.position) - dockDistance(this.body(layout)));
    const km = realDistanceRemainingKm(this.legKm, sceneRemaining, this.sceneLeg);
    const pretendSpeed = realSpeedKmPerSec(this.ship.speed, this.legKm, this.sceneLeg);
    this.hud.setStats({
      title: `Flying to ${layout.world.name}`,
      showNote: true,
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

  private exposeDebugHandle(): void {
    (window as unknown as Record<string, unknown>).rocketPals = {
      getShip: () => this.ship,
      getTargetId: () => this.targetId,
      getQuality: () => this.quality,
      isGlowVisible: () => this.scene.glowVisible,
      getFps: () => this.monitor.fps(),
      getWorld: (id: string): World | undefined => this.layout(id)?.world,
      pickTarget: (id: string) => this.pickTarget(id),
      setAutopilot: (on: boolean) => this.setAutopilot(on),
    };
  }
}

function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function readHardwareHints() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return { deviceMemory: nav.deviceMemory, hardwareConcurrency: nav.hardwareConcurrency };
}
