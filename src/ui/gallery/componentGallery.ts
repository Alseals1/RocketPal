/**
 * The component test page (gallery/components.html): every docs/VISUAL_DESIGN.md section 6 component in
 * every state, for the browser tests and for people to look at. Built only when RP_GALLERY=1, never part
 * of the game.
 *
 * Query: ?scale=1|1.25|1.5 (text size), ?quality=high|low, ?motion=reduced.
 */
import '../styles/tokens.css';
import '../styles/components.css';
import './gallery.css';
import { createButton, ICONS } from '../components/button';
import { openDialog } from '../components/dialog';
import { createSegmented } from '../components/segmented';
import { createToaster } from '../components/toast';
import { createChip } from '../components/chip';
import { createHotspot } from '../components/hotspot';
import { createInstrument } from '../components/instrument';
import { createOrbitDock } from '../components/orbitDock';
import { createPatch } from '../components/patch';
import { createProgressBar } from '../components/progressBar';
import { createRankBadge } from '../components/rankBadge';
import { createStarRow } from '../components/starRow';
import { createTile, type TileState } from '../components/tile';

const params = new URLSearchParams(location.search);
const scale = ['1', '1.25', '1.5'].includes(params.get('scale') ?? '') ? params.get('scale')! : '1';
const root = document.documentElement;
root.style.setProperty('--ui-scale', scale);
root.dataset.quality = params.get('quality') === 'low' ? 'low' : 'high';
root.dataset.reducedMotion = String(params.get('motion') === 'reduced');

const gallery = document.getElementById('gallery')!;

const title = document.createElement('h1');
title.textContent = 'Rocket Pals components';
gallery.append(title);

/** A titled section for one component. */
function section(name: string, heading: string): HTMLElement {
  const el = document.createElement('section');
  el.className = 'gallery-section';
  el.dataset.component = name;
  const h = document.createElement('h2');
  h.textContent = heading;
  const row = document.createElement('div');
  row.className = 'gallery-row';
  el.append(h, row);
  gallery.append(el);
  return row;
}

/** Gives an element a test id and returns it. */
function tid<T extends HTMLElement>(el: T, id: string): T {
  el.dataset.testid = id;
  return el;
}

// ---- Glass panel, over a dark space picture and over pure white ----
{
  const row = section('glass', 'Glass panel');
  for (const backdrop of ['space', 'white'] as const) {
    const strip = document.createElement('div');
    strip.className = `gallery-backdrop gallery-backdrop--${backdrop}`;
    for (const kind of ['hud', 'card', 'sheet', 'dialog'] as const) {
      const panel = tid(document.createElement('div'), `glass-${kind}-${backdrop}`);
      panel.className = `rp-glass rp-glass--${kind}`;
      const p = document.createElement('p');
      p.textContent = `${kind[0].toUpperCase()}${kind.slice(1)} panel. Text stays easy to read.`;
      panel.append(p);
      strip.append(panel);
    }
    row.append(strip);
  }
}

// ---- Buttons ----
{
  const row = section('buttons', 'Buttons');
  row.append(
    tid(createButton({ kind: 'primary', label: 'Fly!' }), 'button-primary'),
    tid(createButton({ kind: 'secondary', label: 'Back to space' }), 'button-secondary'),
    tid(createButton({ kind: 'icon', label: 'Listen', icon: ICONS.listen }), 'button-icon'),
    tid(createButton({ kind: 'icon', label: 'Menu', icon: ICONS.menu }), 'button-icon-menu'),
  );
  const disabledPrimary = tid(createButton({ kind: 'primary', label: 'Set course' }), 'button-primary-disabled');
  const disabledSecondary = tid(createButton({ kind: 'secondary', label: 'Not now' }), 'button-secondary-disabled');
  disabledPrimary.disabled = true;
  disabledSecondary.disabled = true;
  row.append(disabledPrimary, disabledSecondary);
}

// ---- Segmented control ----
{
  const row = section('segmented', 'Segmented control');
  const status = tid(document.createElement('p'), 'segmented-value');
  const control = createSegmented({
    label: 'Text size',
    options: [
      { value: 'normal', label: 'Normal' },
      { value: 'big', label: 'Big' },
      { value: 'huge', label: 'Extra big' },
    ],
    value: 'normal',
    onChange: (value) => (status.textContent = value),
  });
  tid(control.element, 'segmented');
  control.element.style.width = 'min(100%, 28em)';
  status.textContent = control.value;
  row.append(control.element, status);
}

// ---- Dialog ----
{
  const row = section('dialog', 'Dialog');
  const opener = tid(createButton({ kind: 'secondary', label: 'Open a fact card' }), 'dialog-open');
  const result = tid(document.createElement('p'), 'dialog-result');
  opener.addEventListener('click', () => {
    openDialog({
      title: 'The edge of Jezero Crater',
      body: 'Those far-away hills are the rim of Jezero Crater. Long ago, rivers poured into this crater and made a lake.',
      source: "Facts from NASA's website.",
      world: 'mars',
      opener,
      actions: [
        { label: 'Listen', kind: 'secondary', onPress: () => ((result.textContent = 'listen'), false) },
        { label: 'Got it', kind: 'primary', onPress: () => void (result.textContent = 'got it') },
      ],
    });
  });
  row.append(opener, result);
}

// ---- Toast ----
{
  const row = section('toast', 'Toast');
  const toaster = createToaster(document.body);
  tid(toaster.element, 'toast-region');
  const push = tid(createButton({ kind: 'secondary', label: 'Show a toast' }), 'toast-push');
  push.addEventListener('click', () => toaster.push('+3 XP Capsule fact'));
  row.append(push);
}

// ---- Tile ----
{
  const row = section('tile', 'Tile');
  row.style.display = 'grid';
  row.style.gridTemplateColumns = 'repeat(auto-fill, minmax(min(15em, 100%), 1fr))';
  const tiles: [TileState, string, string, string?][] = [
    ['rest', 'Earth', 'Our home'],
    ['selected', 'Mars', 'The red planet'],
    ['locked', 'Jupiter', 'The biggest planet', 'Find 3 things on Mars'],
    ['done', 'Moon', 'Visited'],
    ['new', 'Saturn', 'Rings of ice'],
  ];
  for (const [state, title, line, condition] of tiles) {
    const tile = createTile({ title, line, state, condition, picture: '/images/orbit-neutral.png' });
    row.append(tid(tile.element, `tile-${state}`));
  }
}

// ---- Chip ----
{
  const row = section('chip', 'Chip');
  row.append(tid(createChip({ text: 'Mars', world: 'mars' }), 'chip-world'), tid(createChip({ text: 'Neptune', world: 'neptune' }), 'chip-world-neptune'), tid(createChip({ text: '+20 XP', status: true }), 'chip-status'));
}

// ---- Instrument ----
{
  const row = section('instrument', 'Instrument');
  row.append(
    tid(createInstrument({ label: 'Speed', value: '1,284', unit: 'km/s' }).element, 'instrument'),
    tid(createInstrument({ label: 'Distance', value: '78.3', unit: 'million km', bar: 0.4, highlighted: true }).element, 'instrument-highlighted'),
    tid(createInstrument({ label: 'Time', value: '01:23.4' }).element, 'instrument-stopwatch'),
  );
}

// ---- Progress bar ----
{
  const row = section('progress', 'Progress bar');
  row.style.flexDirection = 'column';
  row.style.alignItems = 'stretch';
  const xp = createProgressBar({ label: 'XP to the next rank', value: 40, max: 100, valueText: (v, m) => `${v} of ${m} XP` });
  const chapter = createProgressBar({ label: 'Chapter progress', value: 2, max: 5, ticks: 5 });
  row.append(tid(xp.element, 'progress-xp'), tid(chapter.element, 'progress-chapter'));
}

// ---- Star row ----
{
  const row = section('stars', 'Star row');
  for (const n of [0, 1, 2, 3]) row.append(tid(createStarRow(n).element, `stars-${n}`));
  const earning = createStarRow(1);
  const earn = tid(createButton({ kind: 'secondary', label: 'Earn a star' }), 'stars-earn');
  let earned = 1;
  earn.addEventListener('click', () => earning.set((earned = Math.min(3, earned + 1))));
  row.append(tid(earning.element, 'stars-earning'), earn);
}

// ---- Rank badge ----
{
  const row = section('rank', 'Rank badge');
  row.append(tid(createRankBadge({ rank: 2, name: 'Junior Pilot' }), 'rank'), tid(createRankBadge({ rank: 3, name: 'Star Navigator', isNew: true }), 'rank-new'));
}

// ---- Patch ----
{
  const row = section('patch', 'Patch');
  row.append(
    tid(createPatch({ name: 'Mars explorer', color: 'mars', earned: true, date: '12 November 2026', icon: ICONS.tick }), 'patch-earned'),
    tid(createPatch({ name: 'Earth watcher', color: 'earth', earned: false, condition: 'Find 3 things from the Space Station', icon: ICONS.info }), 'patch-not-yet'),
  );
}

// ---- Orbit dock ----
{
  const row = section('orbit', 'Orbit dock');
  row.style.flexDirection = 'column';
  row.style.alignItems = 'flex-start';
  const heard = tid(document.createElement('p'), 'orbit-heard');
  const talking = createOrbitDock({ text: "Hi, I'm Orbit! Tap the glowing dots.", onListen: (t) => (heard.textContent = t) });
  const happy = createOrbitDock({ text: 'You found it! Great looking.', state: 'happy', onListen: (t) => (heard.textContent = t) });
  const idle = createOrbitDock({ onListen: (t) => (heard.textContent = t) });
  row.append(tid(talking.element, 'orbit-talking'), tid(happy.element, 'orbit-happy'), tid(idle.element, 'orbit-idle'), heard);
}

// ---- Hotspot ----
{
  const row = section('hotspot', 'Hotspot');
  row.classList.add('gallery-backdrop', 'gallery-backdrop--space');
  row.style.paddingBottom = '3em'; // room for the found label chip
  const pressed = tid(document.createElement('p'), 'hotspot-pressed');
  const fresh = createHotspot({ label: 'The edge of Jezero Crater', onPress: () => (pressed.textContent = 'new') });
  const found = createHotspot({ label: 'Dust devil', state: 'found', onPress: () => (pressed.textContent = 'found') });
  row.append(tid(fresh.element, 'hotspot-new'), tid(found.element, 'hotspot-found'), pressed);
}
