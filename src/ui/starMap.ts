/**
 * The Star Map (docs/VISUAL_DESIGN.md 7.4, decision 4): a glass sheet over the still-moving space scene with one track of
 * worlds from the Sun outwards. Choosing a node opens its detail panel; **Set course** (or a second tap on the node)
 * flies there. **Show real distances** re-spaces the track. What it shows comes from `buildStarMapModel`
 * (src/ui/starMapModel.ts). See decisions/2026-11-21-star-map-and-mission-control.md.
 *
 * Keys follow `openDialog`: the sheet listens on the document, answers only while its scrim is the topmost one, keeps
 * Tab inside, and stops Escape there, so the game's own Escape (`menu`, on `window`) never sees it.
 */
import { createButton, ICONS } from './components/button';
import { createChip } from './components/chip';
import { createStarRow, type StarRow } from './components/starRow';
import { focusGameArea, keepTabInside } from './focus';
import { nextNodeIndex, type StarMapModel, type StarMapNode } from './starMapModel';

export interface StarMapOptions {
  /** Set course was chosen: the map has closed already. */
  onSetCourse(id: string): void;
}

const TITLE_ID = 'star-map-title';
const DETAIL_TITLE_ID = 'star-map-detail-title';
const NOTE_EVEN = 'Sizes and distances are not to scale.';
/** Honest about the squeeze: the inner worlds keep a minimum gap so they can still be tapped (realSpacing). */
const NOTE_REAL = 'Real distances! The worlds near the Sun are squeezed together so you can tap them. Sizes are not to scale.';

/** The nodes come in one by one the first time the map opens in a session (7.4). */
let staggerShown = false;

export class StarMap {
  private readonly scrim: HTMLElement;
  private readonly sheet: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly track: HTMLOListElement;
  private readonly detail: HTMLElement;
  private readonly detailTitle: HTMLElement;
  private readonly detailHook: HTMLElement;
  private readonly detailDistance: HTMLElement;
  private readonly detailStars: StarRow;
  private readonly detailHere: HTMLElement;
  private readonly setCourseButton: HTMLButtonElement;
  private readonly note: HTMLElement;
  private nodes: StarMapNode[] = [];
  private buttons: HTMLButtonElement[] = [];
  /** The node whose detail panel is open. */
  private selected: number | null = null;
  /** The node that holds the track's one Tab stop. */
  private focusAt = 0;
  private real = false;
  private open_ = false;
  /** The button that opened the map: its `aria-expanded` follows the map. */
  private opener: HTMLElement | null = null;

  constructor(private readonly parent: HTMLElement, private readonly options: StarMapOptions) {
    this.scrim = document.createElement('div');
    this.scrim.className = 'rp-scrim star-map-scrim';
    this.scrim.addEventListener('click', (e) => {
      if (e.target === this.scrim) this.close(); // a tap outside the sheet
    });

    this.sheet = document.createElement('div');
    this.sheet.className = 'rp-glass rp-glass--sheet star-map';
    this.sheet.dataset.testid = 'star-map';
    this.sheet.dataset.scale = 'even';
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-modal', 'true');
    this.sheet.setAttribute('aria-labelledby', TITLE_ID);

    const head = document.createElement('div');
    head.className = 'star-map__head';
    const title = document.createElement('h2');
    title.className = 'star-map__title';
    title.id = TITLE_ID;
    title.textContent = 'Star Map';
    this.toggle = document.createElement('button');
    this.toggle.type = 'button';
    this.toggle.className = 'star-map__toggle rp-pressable';
    this.toggle.dataset.testid = 'real-distance-toggle';
    this.toggle.setAttribute('role', 'switch');
    this.toggle.setAttribute('aria-checked', 'false');
    this.toggle.innerHTML = '<span class="star-map__switch" aria-hidden="true"></span><span>Show real distances</span>';
    this.toggle.addEventListener('click', () => this.setReal(!this.real));
    const closeButton = createButton({ kind: 'icon', label: 'Close the Star Map', icon: ICONS.close });
    closeButton.dataset.testid = 'star-map-close';
    closeButton.addEventListener('click', () => this.close());
    head.append(title, this.toggle, closeButton);

    const scroller = document.createElement('div');
    scroller.className = 'star-map__scroller';
    this.track = document.createElement('ol');
    this.track.className = 'star-map__track';
    this.track.setAttribute('aria-label', 'Worlds from the Sun outwards');
    this.track.addEventListener('keydown', (e) => this.onTrackKey(e));
    scroller.append(this.track);

    const foot = document.createElement('div');
    foot.className = 'star-map__foot';
    this.note = document.createElement('p');
    this.note.className = 'star-map__note';
    this.note.dataset.testid = 'scale-note';
    this.note.textContent = NOTE_EVEN;

    this.detail = document.createElement('section');
    this.detail.className = 'rp-glass star-map__detail';
    this.detail.dataset.testid = 'star-map-detail';
    this.detail.setAttribute('aria-labelledby', DETAIL_TITLE_ID);
    this.detail.hidden = true;
    this.detailTitle = document.createElement('h3');
    this.detailTitle.className = 'star-map__detail-title';
    this.detailTitle.id = DETAIL_TITLE_ID;
    this.detailHook = document.createElement('p');
    this.detailHook.className = 'star-map__hook';
    this.detailDistance = document.createElement('p');
    this.detailDistance.className = 'star-map__distance';
    this.detailDistance.dataset.testid = 'star-map-distance';
    this.detailStars = createStarRow(0);
    this.detailHere = createChip({ text: 'You are here', status: true });
    this.detailHere.classList.add('star-map__here');
    this.setCourseButton = createButton({ kind: 'primary', label: 'Set course' });
    this.setCourseButton.dataset.testid = 'set-course';
    this.setCourseButton.addEventListener('click', () => {
      if (this.selected !== null) this.setCourse(this.selected);
    });
    const actions = document.createElement('div');
    actions.className = 'star-map__actions';
    actions.append(this.detailStars.element, this.detailHere, this.setCourseButton);
    // The words scroll when there is little room; the star row and Set course stay in view under them.
    const body = document.createElement('div');
    body.className = 'star-map__detail-body';
    body.append(this.detailTitle, this.detailHook, this.detailDistance);
    this.detail.append(body, actions);
    foot.append(this.note, this.detail);

    this.sheet.append(head, scroller, foot);
    this.scrim.append(this.sheet);
  }

  get isOpen(): boolean {
    return this.open_;
  }

  /** Shows the map with focus on the target, else the world you are at, else the Sun. */
  open(model: StarMapModel, opener?: HTMLElement): void {
    if (this.open_) return;
    this.open_ = true;
    this.opener = opener ?? null;
    this.nodes = model.nodes;
    this.selected = null;
    this.detail.hidden = true;
    this.renderTrack();
    this.scrim.removeAttribute('data-open');
    this.parent.append(this.scrim);
    this.opener?.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', this.onKey);
    const target = this.nodes.findIndex((n) => n.isTarget);
    const here = this.nodes.findIndex((n) => n.isHere);
    this.moveFocus(target >= 0 ? target : here >= 0 ? here : 0);
    requestAnimationFrame(() => {
      if (this.open_) this.scrim.setAttribute('data-open', '');
    });
  }

  /** Focus goes to the game area, not back to the button: Space is the boost key (see `focusGameArea`). */
  close(): void {
    if (!this.open_) return;
    this.open_ = false;
    document.removeEventListener('keydown', this.onKey);
    this.scrim.remove();
    this.opener?.setAttribute('aria-expanded', 'false');
    focusGameArea(this.parent);
  }

  private renderTrack(): void {
    const count = this.nodes.length;
    this.sheet.style.setProperty('--count', String(count)); // the track's length (overlays.css)
    const stagger = !staggerShown;
    staggerShown = true;
    this.track.classList.toggle('is-entering', stagger);
    this.buttons = this.nodes.map((node, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `star-map__node star-map__node--${node.size} rp-pressable`;
      button.dataset.world = node.id;
      button.dataset.testid = `star-map-node-${node.id}`;
      button.dataset.stars = String(node.stars);
      button.setAttribute('aria-label', node.label);
      button.setAttribute('aria-pressed', 'false');
      button.tabIndex = -1;
      button.style.setProperty('--rp-world', `var(--world-${node.color})`);
      button.classList.toggle('is-target', node.isTarget);
      button.classList.toggle('is-here', node.isHere);
      button.classList.toggle('is-next', node.isNext);

      const picture = document.createElement('span');
      picture.className = 'star-map__thumb';
      if (node.thumbnail) {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = node.thumbnail;
        picture.append(img);
      }
      const name = document.createElement('span');
      name.className = 'star-map__name';
      name.textContent = node.name;
      const stars = createStarRow(node.stars).element;
      stars.setAttribute('aria-hidden', 'true');
      stars.removeAttribute('role');
      button.append(picture, name, stars);
      if (node.isHere) button.append(pin('You are here', 'star-map__pin'));
      if (node.isNext) button.append(pin('NEXT', 'star-map__pin star-map__pin--next'));
      button.addEventListener('click', (e) => this.onNodePress(i, e.detail === 0));
      // Keyboard focus only: scrolling under a finger or mouse mid-press would move the node away and lose the tap
      // (a tapped node is scrolled into view once it is chosen, in `select`).
      button.addEventListener('focus', () => {
        if (button.matches(':focus-visible')) button.scrollIntoView({ block: 'nearest', inline: 'center' });
      });

      const item = document.createElement('li');
      item.className = 'star-map__item';
      item.style.setProperty('--even', String(node.even));
      item.style.setProperty('--real', String(node.real));
      item.style.setProperty('--i', String(i));
      item.append(button);
      return button;
    });
    this.track.replaceChildren(...this.buttons.map((b) => b.parentElement!));
  }

  /** A tap (or click) selects; a second tap on the selected node sets course. Enter or Space opens the panel. */
  private onNodePress(i: number, fromKeyboard: boolean): void {
    this.moveFocus(i, false);
    if (!fromKeyboard && this.selected === i && !this.nodes[i].isHere) {
      this.setCourse(i);
      return;
    }
    this.select(i);
    if (fromKeyboard && !this.nodes[i].isHere) this.setCourseButton.focus();
  }

  private select(i: number): void {
    this.selected = i;
    const node = this.nodes[i];
    this.buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    this.detail.style.setProperty('--rp-world', `var(--world-${node.color})`);
    this.detailTitle.textContent = node.name;
    this.detailHook.textContent = node.hook;
    this.detailDistance.textContent = node.distanceLine;
    this.detailStars.set(node.stars);
    this.detailHere.hidden = !node.isHere;
    this.setCourseButton.hidden = node.isHere;
    this.detail.hidden = false;
    // On a phone the panel takes room from the track: keep the chosen node in sight. Centred, like the snap points.
    this.buttons[i].scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  private closeDetail(): void {
    if (this.selected === null) return;
    const at = this.selected;
    this.selected = null;
    this.detail.hidden = true;
    this.buttons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    this.moveFocus(at);
  }

  private setCourse(i: number): void {
    const id = this.nodes[i].id;
    this.close();
    this.options.onSetCourse(id);
  }

  private setReal(on: boolean): void {
    this.real = on;
    this.sheet.dataset.scale = on ? 'real' : 'even';
    this.toggle.setAttribute('aria-checked', String(on));
    this.note.textContent = on ? NOTE_REAL : NOTE_EVEN;
  }

  /** The track is one Tab stop: only the node with focus is in the Tab order. */
  private moveFocus(i: number, focus = true): void {
    this.focusAt = i;
    this.buttons.forEach((b, j) => (b.tabIndex = j === i ? 0 : -1));
    if (focus) this.buttons[i]?.focus();
  }

  private onTrackKey(e: KeyboardEvent): void {
    const next = nextNodeIndex(this.focusAt, e.key, this.buttons.length);
    if (next === undefined) return;
    e.preventDefault();
    this.moveFocus(next);
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    const scrims = document.querySelectorAll('.rp-scrim');
    if (scrims[scrims.length - 1] !== this.scrim) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (this.selected !== null) this.closeDetail();
      else this.close();
    } else if (e.key === 'Tab') {
      e.stopPropagation();
      keepTabInside(this.sheet, e);
    }
  };
}

function pin(text: string, className: string): HTMLElement {
  const el = document.createElement('span');
  el.className = className;
  el.setAttribute('aria-hidden', 'true'); // the node's name already says it
  el.textContent = text;
  return el;
}
