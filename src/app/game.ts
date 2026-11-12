import { createSpeaker } from '../audio/speech';
import type { Content } from '../data/content';
import { InputController } from '../flight/input';
import { createSaveStore, type SaveStore } from '../platform/saveStore';
import { browserStorage, effectiveReducedMotion, saveSettings, type Settings } from '../core/settings';
import { FrameMonitor } from '../quality/monitor';
import { chooseQuality } from '../quality/quality';
import type { WebRendererHost } from '../render/rendererHost';
import { layoutWorlds } from '../scene/layout';
import { SpaceScene } from '../scene/spaceScene';
import { SettingsPanel, applySettingsToPage } from '../ui/settingsPanel';
import type { ScreenContext } from './screens';
import type { GameOptions } from './gameOptions';
import { ScreenManager } from './screenManager';
import { exposeDebugHandle } from './debugHandle';
import { createRendererHost, watchContextLoss } from './rendering';
import { SpaceScreen } from '../screens/spaceScreen';
import { ArrivalScreen } from '../screens/arrivalScreen';

const QUALITY_CHECK_EVERY_MS = 2000;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * The shell around the screens. It owns what every screen shares: the renderer host, the frame loop, quality,
 * settings, the save store and speech. Each frame goes to the active screen.
 */
export class Game {
  private readonly host: WebRendererHost;
  private readonly scene: SpaceScene;
  private readonly input: InputController;
  private readonly monitor = new FrameMonitor();
  private readonly screens: ScreenManager;
  private readonly space: SpaceScreen;
  private readonly arrival: ArrivalScreen;

  /** The graphics card dropped the picture: screens wait until it is back. */
  private paused = false;
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

  /** `content` is everything from public/data/, already checked. Worlds are in file order, which the layout spreads them by. */
  constructor(root: HTMLElement, content: Content, private readonly options: GameOptions) {
    const layouts = layoutWorlds([...content.worlds.values()]);
    this.save = createSaveStore(browserStorage(), window);
    this.settings = options.settings;
    this.reducedMotion = effectiveReducedMotion(this.settings.reducedMotion, this.systemMotion.matches);

    const stage = document.createElement('div');
    stage.className = 'stage';
    root.appendChild(stage);

    const host = (this.host = createRendererHost(stage, options));
    this.scene = new SpaceScene(host, layouts, host.quality, this.reducedMotion);
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
      renderer: host,
      scene: this.scene,
      controls: this.input,
      content,
      layouts,
      reducedMotion: () => this.reducedMotion,
      isCovered: () => this.settingsPanel?.isOpen ?? false,
    };
    this.space = new SpaceScreen(ctx); // its HUD goes on the page before the settings panel, as before
    this.arrival = new ArrivalScreen(ctx);
    this.screens = new ScreenManager([this.space, this.arrival], 'space');

    this.settingsPanel = new SettingsPanel(stage, this.settings, (next) => this.changeSettings(next));
    // "Same as my computer" keeps following the computer if it changes while we are playing.
    this.systemMotion.addEventListener('change', () => this.changeSettings(this.settings, false));

    watchContextLoss(host, stage, (lost) => {
      this.paused = lost;
      this.lastFrame = 0; // the wait is neither a slow frame nor a long step
    });

    const resize = () => {
      host.resize(stage.clientWidth, stage.clientHeight);
      this.scene.setSize(stage.clientWidth, stage.clientHeight);
      this.screens.resize(stage.clientWidth, stage.clientHeight);
    };
    new ResizeObserver(resize).observe(stage);
    resize();

    if (options.debug) {
      const { scene, monitor, screens, space, arrival, save } = this;
      exposeDebugHandle({ host, scene, monitor, screens, space, arrival, save, settings: () => this.settings });
    }
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
    if (this.paused) return;
    const dt = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 0.1) : 1 / 60;
    if (this.lastFrame) this.monitor.add(now - this.lastFrame);
    this.lastFrame = now;
    this.screens.update(dt, now);
    this.qualityCheck(now);
  }

  private qualityCheck(now: number): void {
    if (this.options.forcedQuality || now - this.lastQualityCheck <= QUALITY_CHECK_EVERY_MS) return;
    this.lastQualityCheck = now;
    const next = chooseQuality(this.monitor.samples(), this.host.quality);
    if (next !== this.host.quality) {
      this.host.setQuality(next);
      this.scene.applyQuality(next);
    }
  }
}
