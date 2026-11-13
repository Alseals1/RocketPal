import { ASSET_ENTRIES } from '../assets/manifest';
import { RefCountedAssetManager } from '../platform/assets';
import { initialQuality, prefersLowAssets } from '../quality/quality';
import { modelLoader, textureLoader } from '../render/assetLoaders';
import { WebRendererHost } from '../render/rendererHost';
import { SPACE_VIEW_LABEL } from '../scene/spaceScene';
import { ContextLostNotice } from '../ui/contextLostNotice';
import type { GameOptions } from './gameOptions';

/** Makes the game's one renderer on the stage, at the starting quality, with its canvas described for screen readers. */
export function createRendererHost(stage: HTMLElement, options: GameOptions): WebRendererHost {
  const quality = options.forcedQuality ?? initialQuality(readHardwareHints());
  const host = new WebRendererHost(stage, quality, { keepPicture: options.debug });
  host.renderer.domElement.setAttribute('role', 'img');
  host.renderer.domElement.setAttribute('aria-label', SPACE_VIEW_LABEL);
  return host;
}

/**
 * If the graphics card drops the picture, the game waits (`setLost(true)`) behind a kid-friendly notice, and carries
 * on when the picture is back (`setLost(false)`).
 */
export function watchContextLoss(host: WebRendererHost, stage: HTMLElement, setLost: (lost: boolean) => void): void {
  const notice = new ContextLostNotice(stage);
  host.onContextLost(() => {
    setLost(true);
    notice.show();
  });
  host.onContextRestored(() => {
    setLost(false);
    notice.hide();
  });
}

/** The game's one asset manager: the manifest, the render loaders, and the host's quality and lost-context events. */
export function createGameAssets(host: WebRendererHost): RefCountedAssetManager {
  return new RefCountedAssetManager({
    entries: ASSET_ENTRIES,
    loaders: { texture: textureLoader, model: modelLoader },
    prefersLow: () => prefersLowAssets(host.quality, host.renderer.capabilities.maxTextureSize),
    onContextRestored: (fn) => host.onContextRestored(fn),
  });
}

function readHardwareHints() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return { deviceMemory: nav.deviceMemory, hardwareConcurrency: nav.hardwareConcurrency };
}
