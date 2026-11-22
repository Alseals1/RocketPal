/**
 * Mission Control (docs/VISUAL_DESIGN.md 7.2 and 7.6, decision 6): one menu button, top right, opens a glass sheet with
 * tabs. The game pauses behind it (the caller does that in `onOpen` and `onClose`). Only working tabs are shown.
 *
 * Keys follow `openDialog`: the sheet listens on the document, answers only while its scrim is the topmost one, keeps
 * Tab inside, and stops a closing Escape there, so the game's own Escape (`menu`, on `window`) never sees it and
 * cannot open the sheet again.
 */
import { createButton, ICONS } from './components/button';
import { createTabs, type TabDef, type Tabs } from './components/tabs';
import { focusGameArea, keepTabInside } from './focus';

export interface MissionControlOptions {
  tabs: TabDef[];
  /** Before the sheet shows: pause the game, refresh the tabs. */
  onOpen(): void;
  /** After the sheet has gone: resume the game. */
  onClose(): void;
}

const TITLE_ID = 'mission-control-title';

export class MissionControl {
  readonly menuButton: HTMLButtonElement;
  private readonly scrim: HTMLElement;
  private readonly sheet: HTMLElement;
  private readonly tabs: Tabs;
  private open_ = false;

  constructor(private readonly parent: HTMLElement, private readonly options: MissionControlOptions) {
    this.menuButton = createButton({ kind: 'icon', label: 'Mission Control', icon: ICONS.menu });
    this.menuButton.classList.add('menu-button');
    this.menuButton.dataset.testid = 'menu-button';
    this.menuButton.setAttribute('aria-haspopup', 'dialog');
    this.menuButton.setAttribute('aria-expanded', 'false');
    this.menuButton.addEventListener('click', () => (this.open_ ? this.close() : this.open()));

    this.scrim = document.createElement('div');
    this.scrim.className = 'rp-scrim mission-control-scrim';
    this.scrim.addEventListener('click', (e) => {
      if (e.target === this.scrim) this.close(); // a tap outside the sheet
    });

    this.sheet = document.createElement('div');
    this.sheet.className = 'rp-glass rp-glass--sheet mission-control';
    this.sheet.dataset.testid = 'mission-control';
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-modal', 'true');
    this.sheet.setAttribute('aria-labelledby', TITLE_ID);

    const head = document.createElement('div');
    head.className = 'mission-control__head';
    const title = document.createElement('h2');
    title.className = 'mission-control__title';
    title.id = TITLE_ID;
    title.textContent = 'Mission Control';
    const closeButton = createButton({ kind: 'icon', label: 'Close Mission Control', icon: ICONS.close });
    closeButton.dataset.testid = 'mission-control-close';
    closeButton.addEventListener('click', () => this.close());
    head.append(title, closeButton);

    this.tabs = createTabs({ label: 'Mission Control', tabs: options.tabs });
    this.tabs.element.classList.add('mission-control__tabs');
    this.sheet.append(head, this.tabs.element);
    this.scrim.append(this.sheet);
    parent.append(this.menuButton);
  }

  get isOpen(): boolean {
    return this.open_;
  }

  /** Opens on the first tab (Missions), with focus on it. */
  open(): void {
    if (this.open_) return;
    this.open_ = true;
    this.options.onOpen();
    this.menuButton.setAttribute('aria-expanded', 'true');
    this.tabs.select(this.options.tabs[0].id);
    this.scrim.removeAttribute('data-open');
    this.parent.append(this.scrim);
    document.addEventListener('keydown', this.onKey);
    this.tabs.select(this.tabs.selected, true);
    // The next frame starts the transition from the closed state (scale 0.98, transparent).
    requestAnimationFrame(() => {
      if (this.open_) this.scrim.setAttribute('data-open', '');
    });
  }

  /** Focus goes to the game area, not back to the menu button: Space is the boost key (see `focusGameArea`). */
  close(): void {
    if (!this.open_) return;
    this.open_ = false;
    document.removeEventListener('keydown', this.onKey);
    this.scrim.remove();
    this.menuButton.setAttribute('aria-expanded', 'false');
    this.options.onClose();
    focusGameArea(this.parent);
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    const scrims = document.querySelectorAll('.rp-scrim');
    if (scrims[scrims.length - 1] !== this.scrim) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    } else if (e.key === 'Tab') {
      e.stopPropagation(); // a card left open under the sheet must not pull Tab back to itself
      keepTabInside(this.sheet, e);
    }
  };
}
