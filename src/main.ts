import './style.css';
import { loadPlanets } from './data/planets';
import { Game } from './game';
import type { Quality } from './quality/quality';

const root = document.getElementById('game-canvas')!;
const params = new URLSearchParams(location.search);
const forced = params.get('quality');

function showProblem(message: string): void {
  root.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'problem';
  p.textContent = message;
  root.appendChild(p);
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

if (!hasWebGL()) {
  showProblem("This browser can't show 3D yet. Try Chrome or Firefox, or ask a grown-up to help!");
} else {
  start();
}

function start(): void {
  loadPlanets()
    .then((data) => {
      new Game(root, data, {
        forcedQuality: forced === 'low' || forced === 'high' ? (forced as Quality) : undefined,
        touchControls: params.has('touch') || matchMedia('(pointer: coarse)').matches,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        debug: params.has('debug'),
      });
    })
    .catch((error) => {
      console.error(error);
      showProblem('Oh no! Rocket Pals could not start. Please reload the page and try again.');
    });
}
