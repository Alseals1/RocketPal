import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { WebRendererHost } from '../src/render/rendererHost';
import type { Quality } from '../src/quality/quality';

/** Just enough of a WebGLRenderer to watch what the host does with it. Vitest runs in Node: no WebGL, no DOM. */
function fakeRenderer() {
  const domElement = Object.assign(new EventTarget(), { style: {} as Record<string, string>, attributes: {} as Record<string, string> });
  const calls = { pixelRatio: [] as number[], size: [] as [number, number, boolean | undefined][], disposed: 0 };
  let ratio = 1;
  const renderer = {
    domElement,
    setPixelRatio: (r: number) => {
      ratio = r;
      calls.pixelRatio.push(r);
    },
    getPixelRatio: () => ratio,
    setSize: (w: number, h: number, updateStyle?: boolean) => calls.size.push([w, h, updateStyle]),
    dispose: () => calls.disposed++,
  };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, calls, domElement };
}

function makeHost(quality: Quality, dpr = 2) {
  const fake = fakeRenderer();
  const made: THREE.WebGLRendererParameters[] = [];
  const root = { dataset: {} as DOMStringMap };
  const appended: unknown[] = [];
  const parent = { appendChild: (el: unknown) => appended.push(el) } as unknown as HTMLElement;
  const host = new WebRendererHost(parent, quality, {
    keepPicture: true,
    createRenderer: (params) => {
      made.push(params);
      return fake.renderer;
    },
    root,
    devicePixelRatio: () => dpr,
  });
  return { host, made, root, appended, ...fake };
}

describe('WebRendererHost', () => {
  it('makes the one renderer with antialiasing from the starting quality, and puts its canvas on the page', () => {
    const high = makeHost('high');
    expect(high.made).toHaveLength(1);
    expect(high.made[0]).toMatchObject({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    expect(high.calls.pixelRatio).toEqual([2]);
    expect(high.appended).toEqual([high.domElement]);
    expect(high.domElement.style).toMatchObject({ width: '100%', height: '100%' });
    expect(high.root.dataset.quality).toBe('high');
    expect(high.host.renderer).toBe(high.renderer);

    const low = makeHost('low');
    expect(low.made[0]).toMatchObject({ antialias: false });
    expect(low.calls.pixelRatio).toEqual([1]);
    expect(low.root.dataset.quality).toBe('low');
  });

  it('dropping to low cuts the pixel ratio to 1, re-applies the size and tells CSS, without a new renderer', () => {
    const { host, made, calls, root } = makeHost('high');
    host.resize(800, 600);
    calls.size.length = 0;
    host.setQuality('low');
    expect(host.quality).toBe('low');
    expect(calls.pixelRatio.at(-1)).toBe(1);
    expect(calls.size).toEqual([[800, 600, false]]);
    expect(root.dataset.quality).toBe('low');
    expect(host.size()).toEqual({ width: 800, height: 600, pixelRatio: 1 });
    expect(made).toHaveLength(1); // antialiasing stays as it started
  });

  it('setting the same quality again does nothing', () => {
    const { host, calls } = makeHost('high');
    host.resize(800, 600);
    const before = { ratio: calls.pixelRatio.length, size: calls.size.length };
    host.setQuality('high');
    expect(calls.pixelRatio).toHaveLength(before.ratio);
    expect(calls.size).toHaveLength(before.size);
  });

  it('resize never goes below 1 pixel, and size() reports width, height and pixel ratio', () => {
    const { host, calls } = makeHost('high');
    host.resize(0, -5);
    expect(calls.size.at(-1)).toEqual([1, 1, false]);
    host.resize(1024, 768);
    expect(host.size()).toEqual({ width: 1024, height: 768, pixelRatio: 2 });
  });

  it('passes a lost and a restored context on to its listeners, and follows them in isContextLost', () => {
    const { host, domElement } = makeHost('high');
    const seen: string[] = [];
    host.onContextLost(() => seen.push('lost'));
    const stop = host.onContextRestored(() => seen.push('restored'));
    expect(host.isContextLost).toBe(false);

    domElement.dispatchEvent(new Event('webglcontextlost'));
    expect(host.isContextLost).toBe(true);
    domElement.dispatchEvent(new Event('webglcontextrestored'));
    expect(host.isContextLost).toBe(false);
    expect(seen).toEqual(['lost', 'restored']);

    stop();
    domElement.dispatchEvent(new Event('webglcontextlost'));
    domElement.dispatchEvent(new Event('webglcontextrestored'));
    expect(seen).toEqual(['lost', 'restored', 'lost']);
  });

  it('dispose frees the renderer and stops listening', () => {
    const { host, domElement, calls } = makeHost('high');
    const seen: string[] = [];
    host.onContextLost(() => seen.push('lost'));
    host.dispose();
    expect(calls.disposed).toBe(1);
    domElement.dispatchEvent(new Event('webglcontextlost'));
    expect(seen).toEqual([]);
    expect(host.isContextLost).toBe(false);
  });
});
