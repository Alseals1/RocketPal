// Draws the Star Map's planet thumbnails (#42) in the browser, for tools/make-thumbnails.ts. Each one is a round disc
// cut from the world's own procedural texture (src/scene/textures.ts), shaded as if lit from the upper left, so the
// thumbnails match the 3D scene. Dev-only: tools/thumbnails.html loads this through Vite's dev server.
import { makeWorldTexture } from '../src/scene/textures';
import type { World } from '../src/data/planets';

const SIZE = 128;
const QUALITY = 0.85;
/** The night side is dark blue, not black (docs/VISUAL_DESIGN.md 7.2). */
const NIGHT = 'rgba(11, 16, 38, 0.72)';

function drawDisc(g: CanvasRenderingContext2D, world: World, radius: number): void {
  const c = SIZE / 2;
  const texture = makeWorldTexture(world);
  const source = texture.image as HTMLCanvasElement;
  g.save();
  g.beginPath();
  g.arc(c, c, radius, 0, Math.PI * 2);
  g.clip();
  // One face of the sphere: half the texture's width across the disc.
  g.drawImage(source, source.width * 0.25, 0, source.width / 2, source.height, c - radius, c - radius, radius * 2, radius * 2);
  if (world.kind !== 'star') {
    const light = g.createRadialGradient(c - radius * 0.45, c - radius * 0.45, radius * 0.1, c, c, radius * 1.15);
    light.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    light.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
    light.addColorStop(0.8, 'rgba(11, 16, 38, 0.35)');
    light.addColorStop(1, NIGHT);
    g.fillStyle = light;
    g.fillRect(0, 0, SIZE, SIZE);
  }
  g.restore();
  texture.dispose();
}

function drawRing(g: CanvasRenderingContext2D, color: string, front: boolean): void {
  const c = SIZE / 2;
  g.save();
  g.translate(c, c);
  g.rotate(-0.35);
  g.lineWidth = 7;
  g.strokeStyle = color;
  g.globalAlpha = 0.85;
  g.beginPath();
  // The back half is drawn before the planet and the front half after it.
  g.ellipse(0, 0, 60, 16, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
  g.stroke();
  g.restore();
}

function thumbnail(world: World): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d')!;
  const c = SIZE / 2;
  if (world.kind === 'star') {
    const glow = g.createRadialGradient(c, c, 30, c, c, c);
    glow.addColorStop(0, 'rgba(255, 210, 110, 0.8)');
    glow.addColorStop(1, 'rgba(255, 183, 3, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, SIZE, SIZE);
    drawDisc(g, world, 46);
  } else if (world.id === 'saturn') {
    drawRing(g, '#e8d6a8', false);
    drawDisc(g, world, 36);
    drawRing(g, '#e8d6a8', true);
  } else {
    drawDisc(g, world, 58);
  }
  return canvas.toDataURL('image/webp', QUALITY);
}

async function makeThumbnails(): Promise<Record<string, string>> {
  const data = (await (await fetch('/data/planets.json')).json()) as { worlds: World[] };
  const out: Record<string, string> = {};
  for (const world of data.worlds) out[world.id] = thumbnail(world);
  return out;
}

(window as unknown as { makeThumbnails: typeof makeThumbnails }).makeThumbnails = makeThumbnails;
