/**
 * Tabs: docs/VISUAL_DESIGN.md sections 6 and 7.6. A row of tab buttons over one panel each (ARIA tabs). One Tab stop for
 * the row; Left and Right move and select (wrapping), Home and End go to the first and last. Only the selected panel
 * shows. On a narrow screen the row scrolls sideways.
 */
import { nextRadioIndex } from './radioKeys';

export interface TabDef {
  id: string;
  label: string;
  panel: HTMLElement;
}

export interface TabsOptions {
  /** The tab list's name for screen readers, for example "Mission Control". */
  label: string;
  tabs: TabDef[];
  /** The id of the tab shown first. The first tab when absent. */
  selected?: string;
  onChange?: (id: string) => void;
}

export interface Tabs {
  element: HTMLElement;
  /** Shows a tab (no `onChange`). `focus` also moves keyboard focus to its button. */
  select(id: string, focus?: boolean): void;
  get selected(): string;
  /** The selected tab's button, to put focus on. */
  get selectedTab(): HTMLButtonElement;
}

/** Keys that move along a horizontal tab row. Up and Down are left to the panel (Missions moves between rows). */
const TAB_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

let nextId = 0;

export function createTabs({ label, tabs, selected, onChange }: TabsOptions): Tabs {
  const prefix = `rp-tabs-${++nextId}`;
  const root = document.createElement('div');
  root.className = 'rp-tabs';

  const list = document.createElement('div');
  list.className = 'rp-tabs__list';
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-label', label);
  root.append(list);

  const buttons = tabs.map((tab) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-tabs__tab rp-pressable';
    button.id = `${prefix}-tab-${tab.id}`;
    button.dataset.tab = tab.id;
    button.dataset.testid = `tab-${tab.id}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `${prefix}-panel-${tab.id}`);
    button.textContent = tab.label;
    button.addEventListener('click', () => choose(tab.id, true));
    list.append(button);

    tab.panel.classList.add('rp-tabs__panel');
    tab.panel.id = `${prefix}-panel-${tab.id}`;
    tab.panel.setAttribute('role', 'tabpanel');
    tab.panel.setAttribute('aria-labelledby', button.id);
    root.append(tab.panel);
    return button;
  });

  let current = '';

  function choose(id: string, notify: boolean): void {
    const index = Math.max(0, tabs.findIndex((t) => t.id === id));
    const changed = tabs[index].id !== current;
    current = tabs[index].id;
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1; // roving tab stop: Tab reaches the row once
      tabs[i].panel.hidden = i !== index;
    });
    if (notify && changed) onChange?.(current);
  }

  list.addEventListener('keydown', (e) => {
    if (!TAB_KEYS.has(e.key)) return;
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const next = nextRadioIndex(at, e.key, buttons.length);
    if (next === undefined) return;
    e.preventDefault();
    e.stopPropagation(); // the arrows must not steer the rocket
    buttons[next].focus();
    buttons[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    choose(tabs[next].id, true);
  });

  choose(selected ?? tabs[0]?.id ?? '', false);
  return {
    element: root,
    select(id, focus = false) {
      choose(id, false);
      if (focus) buttons[tabs.findIndex((t) => t.id === current)].focus({ preventScroll: true });
    },
    get selected() {
      return current;
    },
    get selectedTab() {
      return buttons[tabs.findIndex((t) => t.id === current)];
    },
  };
}
