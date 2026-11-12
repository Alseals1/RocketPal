import { starsFor } from '../core/progress';
import type { Settings } from '../core/settings';
import type { World } from '../data/planets';
import type { SaveStore } from '../platform/saveStore';
import type { FrameMonitor } from '../quality/monitor';
import type { Quality } from '../quality/quality';
import type { SpaceScene } from '../scene/spaceScene';
import type { ArrivalScreen } from '../screens/arrivalScreen';
import type { SpaceScreen } from '../screens/spaceScreen';
import type { ScreenManager } from './screenManager';

export interface DebugSources {
  scene: SpaceScene;
  monitor: FrameMonitor;
  screens: ScreenManager;
  space: SpaceScreen;
  arrival: ArrivalScreen;
  save: SaveStore;
  quality(): Quality;
  settings(): Settings;
}

/**
 * `window.rocketPals`, for the browser tests only (page address has ?debug=1). Members are only ever added
 * (docs/TECHNICAL_ARCHITECTURE.md section 9): the tests rely on every name and what it means.
 */
export function exposeDebugHandle({ scene, monitor, screens, space, arrival, save, quality, settings }: DebugSources): void {
  (window as unknown as Record<string, unknown>).rocketPals = {
    getShip: () => space.shipState,
    getTargetId: () => space.target,
    getQuality: () => quality(),
    isGlowVisible: () => scene.glowVisible,
    hasShipModel: () => scene.hasShipModel,
    getFps: () => monitor.fps(),
    getWorld: (id: string): World | undefined => space.world(id),
    isReducedMotion: () => scene.isReducedMotion, // read from the scene itself, so tests cover the wiring
    getSettings: () => settings(),
    getMode: () => (screens.currentId === 'arrival' ? 'surface' : 'space'), // the tests' name for the arrival screen
    getLook: () => arrival.lookState,
    isLookTurning: () => arrival.isLookTurning,
    getViewFov: () => arrival.viewFov(),
    setBackdrop: (color: number) => arrival.setBackdrop(color),
    getFound: () => arrival.foundCount,
    getStars: (worldId: string) => starsFor(save.read(), worldId),
    hasPanorama: () => arrival.hasPanorama,
    dockAt: (id: string) => space.dockAt(id),
    pickTarget: (id: string) => space.pickTarget(id),
    setAutopilot: (on: boolean) => space.setAutopilot(on),
    /** What is on the graphics card now (textures, geometries), to check a leaving screen frees its own. */
    getRenderMemory: () => ({ ...scene.webglRenderer.info.memory }),
  };
}
