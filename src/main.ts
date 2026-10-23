import './style.css';
import { loadPlanets } from './data/planets';
import { loadSurfaces } from './data/surfaces';
import { browserStorage, loadSettings } from './core/settings';
import { Game } from './game';
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
  const settings = loadSettings(browserStorage());
  applySettingsToPage(settings, matchMedia('(prefers-reduced-motion: reduce)').matches);
  loadPlanets()
    .then(async (data) => {
      // If the landing pictures' data cannot be loaded, the game still flies and lands: worlds just show the plain card.
      const surfaces = await loadSurfaces(data.worlds.map((w) => w.id)).catch((error) => {
        console.error(error);
        return { lastChecked: '', surfaces: [] };
      });
      new Game(root, data, {
        surfaces,
        forcedQuality: forced === 'low' || forced === 'high' ? (forced as Quality) : undefined,
        touchControls: params.has('touch') || matchMedia('(pointer: coarse)').matches,
        settings,
        debug: params.has('debug'),
      });
    })
    .catch((error) => {
      console.error(error);
      showProblem('Oh no! Rocket Pals could not start. Please reload the page and try again.');
    });
}
