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
