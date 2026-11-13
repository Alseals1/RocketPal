import type { ArrivalParams, Screen, ScreenContext, SpaceParams } from '../app/screens';
import { findMissionAt, type MissionDef } from '../data/missions';
import type { QuizQuestionData } from '../data/quizzes';
import type { DotId, WorldId } from '../data/ids';
import type { Surface } from '../data/surfaces';
import { diffProgression } from '../core/progression';
import type { LookState } from '../surface/geometry';
import { windowLookLimits, viewHorizontalFov } from '../surface/geometry';
import { PanoramaScene } from '../surface/panoramaScene';
import { LookController } from '../surface/look';
import { photoSize } from '../quality/quality';
import { SPACE_VIEW_LABEL } from '../scene/spaceScene';
import { SurfaceHud } from '../ui/surfaceHud';

/**
 * Standing on a world, looking at a real photograph. Everything it shows is built when you arrive and freed when you
 * leave: the HUD (and its listeners), the look controls, and the picture on the graphics card.
 */
export class ArrivalScreen implements Screen<ArrivalParams> {
  readonly id = 'arrival';
  /** Kept between visits, like the renderer it draws with. It holds nothing on the graphics card once disposed. */
  private panorama?: PanoramaScene;
  private look?: LookController;
  private surfaceHud?: SurfaceHud;
  private activeSurface?: Surface;
  private stopWatchingSave?: () => void;
  /** Counts visits. A picture that finishes loading after the player has left belongs to an old visit and is dropped. */
  private visit = 0;
  /** Between `enter` and `leave`. */
  private visiting = false;

  constructor(private readonly ctx: ScreenContext) {}

  /** Shows the "Landing on..." HUD at once, then loads the picture. Rejects if it cannot be loaded. */
  async enter({ surface }: ArrivalParams): Promise<void> {
    const { ctx } = this;
    const visit = ++this.visit;
    this.visiting = true;
    ctx.renderer.renderer.domElement.setAttribute('aria-label', surface.description);
    ctx.stage.classList.add('is-surface');
    ctx.controls.suspendTouchControls(true);

    this.activeSurface = surface;
    const hud = new SurfaceHud(
      ctx.stage,
      surface,
      {
        onBack: () => void ctx.go<SpaceParams>('space', { liftOff: true }),
        onTurnTo: (az, el) => {
          const view = this.panorama?.viewFov();
          if (view) this.look?.turnToShow(az, el, view, ctx.reducedMotion());
        },
        onDotFound: (id) => this.dotFound(surface.worldId, id),
        onQuizFinished: (perfect) => this.quizFinished(surface.worldId, perfect),
      },
      ctx.speech,
      this.missionExtras(surface.worldId),
    );
    this.surfaceHud = hud;
    // Another window of the game earned something: show it here too, without a reload.
    this.stopWatchingSave = ctx.save.onChange(() => hud.setProgress(this.progressView(surface.worldId)));
    hud.setProgress(this.progressView(surface.worldId));
    hud.show();
    hud.setLoading(true);

    const panorama = (this.panorama ??= new PanoramaScene(ctx.renderer.renderer));
    panorama.setSize(ctx.stage.clientWidth, ctx.stage.clientHeight);
    // A window view, low quality, or a graphics card that cannot hold a 4096 picture, gets the small one.
    const size = photoSize(surface.kind, ctx.renderer.quality, panorama.maxTextureSize);
    try {
      const url = size === 'low' ? surface.images.low : surface.images.high;
      if (surface.kind === 'window') await panorama.loadWindow(url, surface.photo!);
      else await panorama.load(url);
    } catch (error) {
      if (visit !== this.visit) return; // the player has already left: nothing to fall back from
      throw error; // the space screen shows the plain landing card instead
    }
    if (visit !== this.visit) {
      // It arrived after the player left. If nobody is standing on a world now, do not keep it in memory.
      // (If they have already landed somewhere new, that visit owns the picture: leave it alone.)
      if (!this.visiting) panorama.dispose();
      return;
    }

    this.look = new LookController(surface.start);
    this.updateLookLimits();
    this.look.attach(ctx.renderer.renderer.domElement, () => ctx.stage.clientHeight, () => panorama.verticalFov);
    hud.setLoading(false);
  }

  /** Puts the screen back the way space wants it and frees everything this visit used. */
  async leave(): Promise<void> {
    const { ctx } = this;
    this.visit++; // any picture still loading is now out of date
    this.visiting = false;
    ctx.renderer.renderer.domElement.setAttribute('aria-label', SPACE_VIEW_LABEL);
    ctx.stage.classList.remove('is-surface');
    ctx.speech.stop();
    this.look?.detach();
    this.look = undefined;
    this.panorama?.dispose();
    this.stopWatchingSave?.();
    this.stopWatchingSave = undefined;
    this.surfaceHud?.destroy();
    this.surfaceHud = undefined;
    this.activeSurface = undefined;
    ctx.controls.suspendTouchControls(false);
  }

  pause(): void {} // nothing pauses a screen yet
  resume(): void {}

  /** Looks around with the same keys as flying: left and right turn, up and down tilt. Waits until the picture is in. */
  update(dt: number): void {
    const { panorama, look } = this;
    if (!panorama?.isLoaded || !look) return;
    const input = this.ctx.controls.read();
    look.step(dt, { turn: input.turn, tilt: input.pitch });
    panorama.setLook(look.state);
    this.surfaceHud?.update((azimuth, elevation) => panorama.project(azimuth, elevation));
    panorama.render();
  }

  resize(width: number, height: number): void {
    this.panorama?.setSize(width, height);
    this.updateLookLimits(); // a taller or wider screen can look further round a window view
  }

  // For the debug handle and the game's key handling.
  get lookState(): LookState | undefined {
    return this.look?.state;
  }

  get isLookTurning(): boolean {
    return this.look?.isTurning ?? false;
  }

  viewFov(): { horizontalFov: number; verticalFov: number } | undefined {
    return this.panorama?.viewFov();
  }

  setBackdrop(color: number): void {
    this.panorama?.setBackdrop(color);
  }

  get foundCount(): number {
    return this.surfaceHud?.foundCount ?? 0;
  }

  get hasPanorama(): boolean {
    return this.panorama?.isLoaded ?? false;
  }

  /** A fact card or the quiz is open (so the game's own keys wait). */
  get isCardOpen(): boolean {
    return this.surfaceHud?.isCardOpen ?? false;
  }

  /** The mission and quiz for a world, if both exist. A world without them just has no mission. */
  private missionExtras(worldId: string): { mission: MissionDef; questions: QuizQuestionData[] } | undefined {
    const mission = findMissionAt(this.ctx.content, worldId);
    const questions = this.ctx.content.quizzes.get(worldId as WorldId)?.questions;
    return mission && questions ? { mission, questions } : undefined;
  }

  /** The world's mission and stars, worked out from the save. */
  private progressView(worldId: string) {
    const view = this.ctx.progression();
    const mission = findMissionAt(this.ctx.content, worldId);
    return { missionDone: (mission && view.missions.get(mission.id)?.done) ?? false, stars: view.stars.byPlace.get(worldId as WorldId) ?? 0 };
  }

  /** A dot found for the first time this visit: record it and show the progress. True when it finished the mission. */
  private dotFound(worldId: string, id: string): boolean {
    const before = this.ctx.progression();
    this.ctx.events.emit({ type: 'dotFound', dot: `${worldId}/${id}` as DotId }); // the recorder saves it before emit returns
    const diff = diffProgression(before, this.ctx.progression());
    this.surfaceHud?.setProgress(this.progressView(worldId));
    const mission = findMissionAt(this.ctx.content, worldId);
    return mission !== undefined && diff.missionsDone.includes(mission.id);
  }

  /** The quiz was finished: record it and show the new stars. Returns the stars on this world. */
  private quizFinished(worldId: string, perfect: boolean): number {
    this.ctx.events.emit({ type: 'quizFinished', place: worldId as WorldId, firstTryAll: perfect });
    const progress = this.progressView(worldId);
    this.surfaceHud?.setProgress(progress);
    return progress.stars;
  }

  /** In a window view you can only look as far as the photo reaches past the screen; a 360 degree picture has no limit. */
  private updateLookLimits(): void {
    const surface = this.activeSurface;
    if (!this.look || !this.panorama) return;
    if (surface?.kind !== 'window' || !surface.photo) {
      this.look.setLimits(undefined);
      return;
    }
    // The photo faces azimuth 0. The screen sees the camera's field of view, which depends on the screen's shape.
    const view = this.panorama.viewFov();
    const { clientWidth, clientHeight } = this.ctx.stage;
    this.look.setLimits(
      windowLookLimits(
        { horizontalFov: surface.photo.horizontalFov, verticalFov: surface.photo.verticalFov },
        { horizontalFov: viewHorizontalFov(view.verticalFov, clientWidth / Math.max(1, clientHeight)), verticalFov: view.verticalFov },
        0,
      ),
    );
  }
}
