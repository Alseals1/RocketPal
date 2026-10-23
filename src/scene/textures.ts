import * as THREE from 'three';
import type { World } from '../data/planets';

const WIDTH = 256;
const HEIGHT = 128;

// A tiny seeded random number generator so every world always looks the same.
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

const BANDED = ['jupiter', 'saturn', 'uranus', 'neptune'];

/** A small made-up surface for a world. These are placeholders until real textures are added (see ASSETS.md). */
export function makeWorldTexture(world: World): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const g = canvas.getContext('2d')!;
  const rand = seeded([...world.id].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7));

  g.fillStyle = world.id === 'earth' ? '#2f6db5' : world.color;
  g.fillRect(0, 0, WIDTH, HEIGHT);

  if (BANDED.includes(world.id)) {
    for (let y = 0; y < HEIGHT; ) {
      const h = 6 + rand() * 16;
      g.fillStyle = shade(world.color, (rand() - 0.5) * 0.18);
      g.fillRect(0, y, WIDTH, h);
      y += h;
    }
    if (world.id === 'jupiter') {
      g.fillStyle = '#b5543c'; // the Great Red Spot
      g.beginPath();
      g.ellipse(170, 78, 16, 9, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else if (world.id === 'earth') {
    g.fillStyle = '#4c9a52';
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.ellipse(rand() * WIDTH, 25 + rand() * 80, 14 + rand() * 24, 8 + rand() * 14, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#f4f7fb'; // polar ice
    g.fillRect(0, 0, WIDTH, 8);
    g.fillRect(0, HEIGHT - 8, WIDTH, 8);
  } else if (world.id === 'venus') {
    for (let i = 0; i < 14; i++) {
      g.fillStyle = shade(world.color, (rand() - 0.5) * 0.14);
      g.fillRect(0, rand() * HEIGHT, WIDTH, 4 + rand() * 10);
    }
  } else if (world.kind !== 'star') {
    // Rocky worlds: craters and patches.
    for (let i = 0; i < 40; i++) {
      g.fillStyle = shade(world.color, (rand() - 0.5) * 0.22);
      g.beginPath();
      g.arc(rand() * WIDTH, rand() * HEIGHT, 2 + rand() * 9, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    // The Sun: bright swirls.
    for (let i = 0; i < 160; i++) {
      g.fillStyle = shade(world.color, (rand() - 0.4) * 0.12);
      g.beginPath();
      g.arc(rand() * WIDTH, rand() * HEIGHT, 1.5 + rand() * 5, 0, Math.PI * 2);
      g.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A soft round glow, used for the Sun and for atmospheres. */
export function makeGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
