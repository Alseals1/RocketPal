import { createSpeaker } from './audio/speech';
import type { PlanetData, World } from './data/planets';
import type { MissionData } from './data/missions';
import type { QuizData } from './data/quizzes';
import type { SurfaceData } from './data/surfaces';
import { InputController } from './flight/input';
import { starsFor } from './core/progress';
import { createSaveStore, type SaveStore } from './platform/saveStore';
import { browserStorage, effectiveReducedMotion, saveSettings, type Settings } from './core/settings';
import { FrameMonitor } from './quality/monitor';
import { chooseQuality, initialQuality, type Quality } from './quality/quality';
import { layoutWorlds } from './scene/layout';
import { SpaceScene } from './scene/spaceScene';
import { SettingsPanel, applySettingsToPage } from './ui/settingsPanel';
import type { GameData, ScreenContext } from './app/screens';
import { ScreenManager } from './app/screenManager';
import { SpaceScreen } from './screens/spaceScreen';
import { ArrivalScreen } from './screens/arrivalScreen';

const QUALITY_CHECK_EVERY_MS = 2000;

interface Options {
  /** 'high' or 'low' from the page address, to force a quality (and turn off the automatic chooser). */
  forcedQuality?: Quality;
  touchControls: boolean;
  surfaces: SurfaceData;
  missions: MissionData;
  quizzes: QuizData;
  settings: Settings;
  debug: boolean;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * The shell around the screens. It owns what every screen shares: the renderer (through `SpaceScene`, until #31),
 * the frame loop, quality, settings, the save store and speech. Each frame goes to the active screen.
 */
export class Game {
  private readonly scene: SpaceScene;
  private readonly input: InputController;
  private readonly monitor = new FrameMonitor();
  private readonly screens: ScreenManager;
  private readonly space: SpaceScreen;
  private readonly arrival: ArrivalScreen;

  private quality: Quality;
  private reportedError = false;
  private settingsPanel?: SettingsPanel;
  /** Stars and missions done so far, remembered in this browser only. */
  private readonly save: SaveStore;
  private readonly speaker = createSpeaker();
  private settings: Settings;
  private reducedMotion: boolean;
  private readonly systemMotion = matchMedia(REDUCED_MOTION_QUERY);
  private lastFrame = 0;
  private lastQualityCheck = 0;

  constructor(root: HTMLElement, data: PlanetData, private readonly options: Options) {
    const layouts = layoutWorlds(data.worlds);
    const gameData: GameData = {
      layouts,
      surfaces: new Map(options.surfaces.surfaces.map((s) => [s.worldId, s])),
      missions: new Map(options.missions.missions.map((m) => [m.worldId, m])),
      quizzes: new Map(options.quizzes.quizzes.map((q) => [q.worldId, q.questions])),
    };
    this.save = createSaveStore(browserStorage(), window);
    this.quality = options.forcedQuality ?? initialQuality(readHardwareHints());
    this.settings = options.settings;
    this.reducedMotion = effectiveReducedMotion(this.settings.reducedMotion, this.systemMotion.matches);

    const stage = document.createElement('div');
    stage.className = 'stage';
    root.appendChild(stage);

    this.scene = new SpaceScene(stage, layouts, this.quality, this.reducedMotion, options.debug);
    this.input = new InputController(
      stage,
      options.touchControls,
      () => (this.settingsPanel?.isOpen ?? false) || this.arrival.isCardOpen,
    );
    const ctx: ScreenContext = {
      save: this.save,
      speech: this.speaker,
      go: (id, params) => this.screens.go(id, params),
      stage,
      scene: this.scene,
      controls: this.input,
      data: gameData,
      quality: () => this.quality,
      reducedMotion: () => this.reducedMotion,
      isCovered: () => this.settingsPanel?.isOpen ?? false,
    };
    this.space = new SpaceScreen(ctx); // its HUD goes on the page before the settings panel, as before
    this.arrival = new ArrivalScreen(ctx);
    this.screens = new ScreenManager([this.space, this.arrival], 'space');

    this.settingsPanel = new SettingsPanel(stage, this.settings, (next) => this.changeSettings(next));
    // "Same as my computer" keeps following the computer if it changes while we are playing.
    this.systemMotion.addEventListener('change', () => this.changeSettings(this.settings, false));

    const resize = () => {
      this.scene.setSize(stage.clientWidth, stage.clientHeight);
      this.screens.resize(stage.clientWidth, stage.clientHeight);
    };
    new ResizeObserver(resize).observe(stage);
    resize();

    if (options.debug) this.exposeDebugHandle();
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Called when the player picks something in the settings panel (or the computer's motion setting changes). */
  private changeSettings(next: Settings, save = true): void {
    this.settings = next;
    if (save) saveSettings(next, browserStorage());
    this.reducedMotion = applySettingsToPage(next, this.systemMotion.matches);
    this.scene.setReducedMotion(this.reducedMotion);
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
    this.screens.update(dt, now);
    this.qualityCheck(now);
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

  private exposeDebugHandle(): void {
    const { space, arrival, scene } = this;
    (window as unknown as Record<string, unknown>).rocketPals = {
      getShip: () => space.shipState,
      getTargetId: () => space.target,
      getQuality: () => this.quality,
      isGlowVisible: () => scene.glowVisible,
      hasShipModel: () => scene.hasShipModel,
      getFps: () => this.monitor.fps(),
      getWorld: (id: string): World | undefined => space.world(id),
      isReducedMotion: () => scene.isReducedMotion, // read from the scene itself, so tests cover the wiring
      getSettings: () => this.settings,
      getMode: () => (this.screens.currentId === 'arrival' ? 'surface' : 'space'), // the tests' name for the arrival screen
      getLook: () => arrival.lookState,
      isLookTurning: () => arrival.isLookTurning,
      getViewFov: () => arrival.viewFov(),
      setBackdrop: (color: number) => arrival.setBackdrop(color),
      getFound: () => arrival.foundCount,
      getStars: (worldId: string) => starsFor(this.save.read(), worldId),
      hasPanorama: () => arrival.hasPanorama,
      dockAt: (id: string) => space.dockAt(id),
      pickTarget: (id: string) => space.pickTarget(id),
      setAutopilot: (on: boolean) => space.setAutopilot(on),
      getRenderMemory: () => ({ ...scene.webglRenderer.info.memory }),
    };
  }
}

function readHardwareHints() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return { deviceMemory: nav.deviceMemory, hardwareConcurrency: nav.hardwareConcurrency };
}
