/**
 * Mission Control's Missions tab (docs/VISUAL_DESIGN.md 7.6): every mission as a row, with its world and how far along
 * it is, and Go on the ones you can fly to. The rows come from `buildMissionRows` (src/ui/missionsModel.ts).
 */
import type { Speaker } from '../core/speaker';
import { createButton } from './components/button';
import { createTile } from './components/tile';
import { bindListen, type ListenBinding } from './listen';
import { NO_MISSIONS_TEXT, missionsListenText, type MissionRow } from './missionsModel';
import type { WorldId } from '../data/ids';

export class MissionsTab {
  readonly element: HTMLElement;
  private readonly list: HTMLOListElement;
  private readonly listen: ListenBinding;
  private rows: MissionRow[] = [];

  constructor(speaker: Speaker, private readonly onGo: (place: WorldId) => void) {
    this.element = document.createElement('div');
    this.element.className = 'missions-tab';
    this.element.dataset.testid = 'missions-panel';

    const head = document.createElement('div');
    head.className = 'missions-tab__head';
    const title = document.createElement('h3');
    title.className = 'missions-tab__title';
    title.textContent = 'Your missions';
    const listenButton = document.createElement('button');
    listenButton.type = 'button';
    listenButton.className = 'rp-button rp-button--secondary rp-pressable';
    listenButton.dataset.testid = 'missions-listen';
    head.append(title, listenButton);

    this.list = document.createElement('ol');
    this.list.className = 'missions-tab__list';
    this.element.append(head, this.list);
    this.listen = bindListen(listenButton, speaker, () => missionsListenText(this.rows));
  }

  /** Shows these rows (called each time Mission Control opens). */
  show(rows: MissionRow[]): void {
    this.rows = rows;
    this.listen.refresh();
    if (rows.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'missions-tab__empty';
      empty.textContent = NO_MISSIONS_TEXT;
      this.list.replaceChildren(empty);
      return;
    }
    this.list.replaceChildren(...rows.map((row) => this.rowElement(row)));
  }

  private rowElement(row: MissionRow): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'mission-row';
    item.dataset.mission = row.id;
    item.dataset.status = row.status;
    item.dataset.testid = `mission-${row.id}`;
    const line = row.placeName ? `${row.placeName} · ${row.line}` : row.line;
    const tile = createTile({ title: row.title, line, state: row.status === 'done' ? 'done' : 'rest', static: true });
    if (row.go === 'primary') tile.element.classList.add('is-next');
    item.append(tile.element);
    if (row.go && row.place) {
      const place = row.place;
      const go = createButton({ kind: row.go, label: 'Go' });
      go.classList.add('mission-row__go');
      go.dataset.testid = `mission-go-${row.id}`;
      go.setAttribute('aria-label', `Go to ${row.placeName}`);
      go.addEventListener('click', () => this.onGo(place));
      item.append(go);
    }
    return item;
  }
}
