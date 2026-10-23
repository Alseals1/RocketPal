import { createSpeaker } from './audio/speech';
import type { PlanetData, World } from './data/planets';
import type { Surface, SurfaceData } from './data/surfaces';
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
import { browserStorage, effectiveReducedMotion, saveSettings, type Settings } from './core/settings';
import { FrameMonitor } from './quality/monitor';
import { chooseQuality, initialQuality, type Quality } from './quality/quality';
import {
  formatDistanceKm,
  formatDuration,
  formatSpeed,
  lightTravelSeconds,
  realDistanceRemainingKm,
  realSpeedKmPerSec,
} from './scale/readout';
import { planLeg } from './scale/leg';
import { layoutWorlds, type BodyLayout } from './scene/layout';
import { SPACE_VIEW_LABEL, SpaceScene } from './scene/spaceScene';
import { PanoramaScene } from './surface/panoramaScene';
import { LookController } from './surface/look';
import { Hud } from './ui/hud';
import { SurfaceHud } from './ui/surfaceHud';
import { SettingsPanel, applySettingsToPage } from './ui/settingsPanel';

const START_POSITION = { x: 0, y: 40, z: 330 }; // near the Sun, facing it
const STATS_EVERY_MS = 250;
const QUALITY_CHECK_EVERY_MS = 2000;
const AUTOPILOT_INPUT: FlightInput = { turn: 0, pitch: 0, boost: true };

interface Options {
  /** 'high' or 'low' from the page address, to force a quality (and turn off the automatic chooser). */
  forcedQuality?: Quality;
  touchControls: boolean;
  surfaces: SurfaceData;
  settings: Settings;
  debug: boolean;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export class Game {
  private readonly layouts: BodyLayout[];
  private readonly scene: SpaceScene;
  private readonly hud: Hud;
  private readonly input: InputController;
  private readonly monitor = new FrameMonitor();

  private ship: ShipState = createShip(START_POSITION, 0, 0);
  private quality: Quality;
  private targetId: string | null = null;
  /** The world the rocket is right next to, if any. You cannot pick it as a destination. */
  private here: string | null = null;
  private reportedError = false;
  private settingsPanel?: SettingsPanel;
  private readonly stage: HTMLElement;
  private readonly surfaces: Map<string, Surface>;
  private readonly speaker = createSpeaker();
  private mode: 'space' | 'surface' = 'space';
  private panorama?: PanoramaScene;
  private look?: LookController;
  private surfaceHud?: SurfaceHud;
  private surfaceHudFor?: string;
  /** Counts visits to a surface. A picture that finishes loading after the player has left belongs to an old visit and is dropped. */
  private visit = 0;
  private settings: Settings;
  private reducedMotion: boolean;
  private readonly systemMotion = matchMedia(REDUCED_MOTION_QUERY);
  private autopilot = false;
  private lastFrame = 0;
  private lastStats = 0;
  private lastQualityCheck = 0;
  private sceneLeg = 1;
  private legKm = 0;

  constructor(root: HTMLElement, data: PlanetData, private readonly options: Options) {
    this.layouts = layoutWorlds(data.worlds);
    this.surfaces = new Map(options.surfaces.surfaces.map((s) => [s.worldId, s]));
    this.ship = this.startFacing('earth');
    this.quality = options.forcedQuality ?? initialQuality(readHardwareHints());
    this.settings = options.settings;
    this.reducedMotion = effectiveReducedMotion(this.settings.reducedMotion, this.systemMotion.matches);

    const stage = document.createElement('div');
    stage.className = 'stage';
    root.appendChild(stage);
    this.stage = stage;

    this.scene = new SpaceScene(stage, this.layouts, this.quality, this.reducedMotion, options.debug);
    this.input = new InputController(
      stage,
      options.touchControls,
      () => (this.settingsPanel?.isOpen ?? false) || (this.surfaceHud?.isCardOpen ?? false),
    );
    this.hud = new Hud(stage, this.layouts, {
      onSelect: (id) => this.pickTarget(id),
      onAutopilot: (on) => this.setAutopilot(on),
      onFlyAgain: () => this.flyAgain(),
    });
    this.refreshHere();
    this.hud.setAutopilot(false);

    this.settingsPanel = new SettingsPanel(stage, this.settings, (next) => this.changeSettings(next));
    // "Same as my computer" keeps following the computer if it changes while we are playing.
    this.systemMotion.addEventListener('change', () => this.changeSettings(this.settings, false));

    const resize = () => {
      this.scene.setSize(stage.clientWidth, stage.clientHeight);
      this.hud.setViewport(stage.clientWidth, stage.clientHeight);
      this.panorama?.setSize(stage.clientWidth, stage.clientHeight);
    };
    new ResizeObserver(resize).observe(stage);
    resize();

    if (options.debug) this.exposeDebugHandle();
    requestAnimationFrame((t) => this.frame(t));
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

  /** Called when the player picks something in the settings panel (or the computer's motion setting changes). */
  private changeSettings(next: Settings, save = true): void {
    this.settings = next;
    if (save) saveSettings(next, browserStorage());
    this.reducedMotion = applySettingsToPage(next, this.systemMotion.matches);
    this.scene.setReducedMotion(this.reducedMotion);
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
    this.targetId = null;
    this.autopilot = false;
    this.hud.hideLanded();
    this.hud.setAutopilot(false);
    this.refreshHere();
    this.updateStats();
  }

  private frame(now: number): void {
    try {
      this.tick(now);
    } catch (error) {
      // One bad frame must not freeze the game. Say so once, then keep flying.
      if (!this.reportedError) {
        this.reportedError = true;
        console.error(error);
      }
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  private tick(now: number): void {
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
    if (this.ship.docked && !wasDocked && targetLayout) this.onDocked(targetLayout);

    if (this.mode === 'surface' && this.panorama?.isLoaded && this.look) {
      this.surfaceTick(dt);
      this.qualityCheck(now);
      return;
    }

    this.scene.update(dt, this.ship, input.boost);
    this.hud.updateTags(
      (l) => this.scene.project(l.position),
      (l) => distance(this.ship.position, l.position),
    );
    this.scene.render();

    if (now - this.lastStats > STATS_EVERY_MS) {
      this.lastStats = now;
      this.refreshHere();
      this.updateStats();
    }
    this.qualityCheck(now);
  }

  /** The rocket has docked: stand on the world if it has a real photograph, or show the plain landing card. */
  private onDocked(layout: BodyLayout): void {
    this.autopilot = false;
    this.hud.setAutopilot(false);
    const surface = this.surfaces.get(layout.world.id);
    if (surface) void this.enterSurface(layout, surface);
    else this.hud.showLanded(layout.world.name);
  }

  /** For the browser tests only (page address has ?debug=1): dock at a world straight away, through the normal landing path. */
  private debugDockAt(id: string): void {
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

  private qualityCheck(now: number): void {
    if (this.options.forcedQuality || now - this.lastQualityCheck <= QUALITY_CHECK_EVERY_MS) return;
    this.lastQualityCheck = now;
    const next = chooseQuality(this.monitor.samples(), this.quality);
    if (next !== this.quality) {
      this.quality = next;
      this.scene.applyQuality(next);
    }
  }

  /** Standing on a world, looking at a real photograph. */
  private surfaceTick(dt: number): void {
    const panorama = this.panorama!;
    const look = this.look!;
    const input = this.input.read(); // the same keys: left and right turn, up and down tilt
    look.step(dt, { turn: input.turn, tilt: input.pitch });
    panorama.setLook(look.state);
    this.surfaceHud?.update((azimuth, elevation) => panorama.project(azimuth, elevation));
    panorama.render();
  }

  /** The rocket has docked at a world with a real photograph: go and stand in it. */
  private async enterSurface(layout: BodyLayout, surface: Surface): Promise<void> {
    const visit = ++this.visit;
    this.mode = 'surface';
    this.scene.setCanvasLabel(`A real 360 degree photo of ${surface.title}, taken by a NASA rover. Drag to look around.`);
    this.stage.classList.add('is-surface');
    this.input.suspendTouchControls(true);

    if (!this.surfaceHud || this.surfaceHudFor !== surface.worldId) {
      this.surfaceHud?.hide();
      this.surfaceHud = new SurfaceHud(
        this.stage,
        surface,
        { onBack: () => this.leaveSurface(), onTurnTo: (az, el) => this.look?.turnTo(az, el, this.reducedMotion) },
        this.speaker,
      );
      this.surfaceHudFor = surface.worldId;
    }
    const hud = this.surfaceHud;
    hud.reset();
    hud.show();
    hud.setLoading(true);

    const panorama = (this.panorama ??= new PanoramaScene(this.scene.webglRenderer));
    panorama.setSize(this.stage.clientWidth, this.stage.clientHeight);
    // Low quality, or a graphics card that cannot hold a 4096 picture, gets the small one.
    const small = this.quality === 'low' || panorama.maxTextureSize < 4096;
    try {
      await panorama.load(small ? surface.images.low : surface.images.high);
    } catch (error) {
      if (visit !== this.visit) return; // the player has already left: nothing to fall back from
      console.error(error);
      this.leaveSurfaceScreen();
      this.hud.showLanded(layout.world.name); // fall back to the plain "You landed" card
      return;
    }
    if (visit !== this.visit) {
      // It arrived after the player left. If nobody is standing on a surface now, do not keep it in memory.
      // (If they have already landed somewhere new, that visit owns the picture: leave it alone.)
      if (this.mode !== 'surface') panorama.dispose();
      return;
    }

    this.look = new LookController(surface.start);
    this.look.attach(this.scene.canvas, () => this.stage.clientHeight, panorama.verticalFov);
    hud.setLoading(false);
  }

  /** "Back to space" on a surface: put the screen back and lift off. */
  private leaveSurface(): void {
    this.leaveSurfaceScreen();
    this.flyAgain();
  }

  private leaveSurfaceScreen(): void {
    this.visit++; // any picture still loading is now out of date
    this.mode = 'space';
    this.scene.setCanvasLabel(SPACE_VIEW_LABEL);
    this.stage.classList.remove('is-surface');
    this.speaker.stop();
    this.look?.detach();
    this.look = undefined;
    this.panorama?.dispose();
    this.surfaceHud?.hide();
    this.input.suspendTouchControls(false);
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
      isReducedMotion: () => this.scene.isReducedMotion, // read from the scene itself, so tests cover the wiring
      getSettings: () => this.settings,
      getMode: () => this.mode,
      getLook: () => this.look?.state,
      isLookTurning: () => this.look?.isTurning ?? false,
      getFound: () => this.surfaceHud?.foundCount ?? 0,
      hasPanorama: () => this.panorama?.isLoaded ?? false,
      dockAt: (id: string) => this.debugDockAt(id),
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
