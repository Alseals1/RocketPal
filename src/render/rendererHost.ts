import * as THREE from 'three';
import { rendererOptions, type Quality } from '../quality/quality';

/** The one renderer and everything about it (docs/TECHNICAL_ARCHITECTURE.md 4.14, as written). */
export interface RendererHost {
  readonly renderer: THREE.WebGLRenderer; // the only one, as today
  readonly quality: Quality;
  setQuality(q: Quality): void;
  onContextLost(fn: () => void): () => void; // #31
  onContextRestored(fn: () => void): () => void;
  size(): { width: number; height: number; pixelRatio: number };
}

export interface RendererHostOptions {
  /** Keeps the picture readable after it is drawn. Only for the browser tests, which check the pixels. */
  keepPicture?: boolean;
  /** Makes the renderer. The unit tests pass a fake: Vitest has no WebGL. */
  createRenderer?: (params: THREE.WebGLRendererParameters) => THREE.WebGLRenderer;
  /** Where `data-quality` goes, for CSS. The page's `<html>` by default. */
  root?: { dataset: DOMStringMap };
  devicePixelRatio?: () => number;
}

/**
 * Owns the game's one `WebGLRenderer` and its canvas: resizing, the pixel ratio, quality and a lost graphics context.
 *
 * Antialiasing can only be chosen when the renderer is made, so it follows the starting quality. Dropping to low later
 * cuts the pixel ratio to 1 instead (decisions/2026-11-12-renderer-host-and-quality.md).
 *
 * On a lost context three.js already skips drawing, and on restore it re-uploads textures and geometry from the copies
 * it keeps in memory. The host only passes the two events on.
 */
export class WebRendererHost implements RendererHost {
  readonly renderer: THREE.WebGLRenderer;
  private current: Quality;
  private width = 1;
  private height = 1;
  private lost = false;
  private readonly lostListeners = new Set<() => void>();
  private readonly restoredListeners = new Set<() => void>();
  private readonly root: { dataset: DOMStringMap };
  private readonly dpr: () => number;

  private readonly handleLost = () => {
    this.lost = true;
    for (const fn of [...this.lostListeners]) fn();
  };

  private readonly handleRestored = () => {
    this.lost = false;
    for (const fn of [...this.restoredListeners]) fn();
  };

  constructor(parent: HTMLElement, quality: Quality, options: RendererHostOptions = {}) {
    this.current = quality;
    this.root = options.root ?? document.documentElement;
    this.dpr = options.devicePixelRatio ?? (() => window.devicePixelRatio);
    const create = options.createRenderer ?? ((params) => new THREE.WebGLRenderer(params));
    const { antialias, pixelRatio } = rendererOptions(quality, this.dpr());
    this.renderer = create({ antialias, powerPreference: 'high-performance', preserveDrawingBuffer: options.keepPicture ?? false });
    this.renderer.setPixelRatio(pixelRatio);

    const canvas = this.renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    parent.appendChild(canvas);
    canvas.addEventListener('webglcontextlost', this.handleLost);
    canvas.addEventListener('webglcontextrestored', this.handleRestored);
    this.root.dataset.quality = quality;
  }

  get quality(): Quality {
    return this.current;
  }

  /** True between a lost context and its restore. */
  get isContextLost(): boolean {
    return this.lost;
  }

  /** Changes the pixel ratio (and tells CSS). Antialiasing stays as it started. */
  setQuality(q: Quality): void {
    if (q === this.current) return;
    this.current = q;
    this.renderer.setPixelRatio(rendererOptions(q, this.dpr()).pixelRatio);
    this.renderer.setSize(this.width, this.height, false); // the drawing buffer follows the new ratio at once
    this.root.dataset.quality = q;
  }

  /** The drawing buffer follows the page; the canvas's CSS size stays 100%. */
  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
  }

  size(): { width: number; height: number; pixelRatio: number } {
    return { width: this.width, height: this.height, pixelRatio: this.renderer.getPixelRatio() };
  }

  onContextLost(fn: () => void): () => void {
    this.lostListeners.add(fn);
    return () => this.lostListeners.delete(fn);
  }

  onContextRestored(fn: () => void): () => void {
    this.restoredListeners.add(fn);
    return () => this.restoredListeners.delete(fn);
  }

  dispose(): void {
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.handleLost);
    canvas.removeEventListener('webglcontextrestored', this.handleRestored);
    this.lostListeners.clear();
    this.restoredListeners.clear();
    this.renderer.dispose();
  }
}
