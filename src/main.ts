import './style.css';
import { loadContent } from './data/content';
import { browserStorage } from './core/settings';
import { createSettingsStore } from './platform/settingsStore';
import { Game } from './game';
import { isDebugOn } from './app';
import type { Quality } from './quality/quality';
import { applySettingsToPage } from './ui/settingsPanel';

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
  // Apply saved text size and motion choice before anything is drawn, so nothing jumps.
  const settings = createSettingsStore(browserStorage());
  applySettingsToPage(settings.get(), matchMedia('(prefers-reduced-motion: reduce)').matches);
  // One loader for every data file. A broken entry, or a file other than planets.json that cannot be loaded, is left
  // out (and logged) and the game still flies and lands. Only unusable planet data stops it, below.
  loadContent()
    .then((content) => {
      new Game(root, content, {
        forcedQuality: forced === 'low' || forced === 'high' ? (forced as Quality) : undefined,
        touchControls: params.has('touch') || matchMedia('(pointer: coarse)').matches,
        settings,
        debug: isDebugOn(params),
      });
    })
    .catch((error) => {
      console.error(error);
      showProblem('Oh no! Rocket Pals could not start. Please reload the page and try again.');
    });
}
