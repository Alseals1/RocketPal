/**
 * Wires Mission Control (src/ui/missionControl.ts) into the game: its Missions and Settings tabs, the pause while it is
 * open, Go, and Escape in space. Kept out of `game.ts`, which stays a short shell (tests/gameShell.test.ts).
 * See decisions/2026-11-21-star-map-and-mission-control.md.
 */
import type { Speaker } from '../core/speaker';
import type { ProgressionView } from '../core/progression';
import type { Settings } from '../core/settings';
import type { Content } from '../data/content';
import type { WorldId } from '../data/ids';
import type { InputManager } from '../platform/input/inputManager';
import type { ArrivalScreen } from '../screens/arrivalScreen';
import type { SpaceScreen } from '../screens/spaceScreen';
import { MissionControl } from '../ui/missionControl';
import { buildMissionRows } from '../ui/missionsModel';
import { MissionsTab } from '../ui/missionsTab';
import { SettingsTab } from '../ui/settingsPanel';
import type { ScreenManager } from './screenManager';
import type { SpaceParams } from './screens';

export interface MissionControlWiring {
  stage: HTMLElement;
  content: Content;
  settings: Settings;
  /** A setting was picked in the Settings tab. */
  onSettings(next: Settings): void;
  progression(): ProgressionView;
  screens: ScreenManager;
  space: SpaceScreen;
  arrival: ArrivalScreen;
  input: InputManager;
  speech: Speaker;
}

export function connectMissionControl(w: MissionControlWiring): { isOpen(): boolean } {
  const { screens, space, arrival } = w;
  const onArrival = () => screens.currentId === 'arrival';

  /** Go: fly to that world. From a world's surface, lift off first. */
  const go = (place: WorldId) => {
    mc.close();
    if (onArrival()) screens.go<SpaceParams>('space', { liftOff: true, course: place }).catch((error) => console.error(error));
    else space.setCourse(place);
  };

  const missions = new MissionsTab(w.speech, go);
  const settings = new SettingsTab(w.settings, w.onSettings, () => mc.close());
  const mc: MissionControl = new MissionControl(w.stage, {
    tabs: [
      { id: 'missions', label: 'Missions', panel: missions.element },
      { id: 'settings', label: 'Settings', panel: settings.element },
    ],
    onOpen: () => {
      w.speech.stop(); // nothing keeps reading behind the sheet
      const here = onArrival() ? arrival.place : space.here;
      missions.show(buildMissionRows({ missions: w.content.missions, view: w.progression(), places: w.content.places, here }));
      screens.setPaused(true);
    },
    onClose: () => screens.setPaused(false),
  });

  // Escape in space opens Mission Control, unless the space HUD has a panel of its own open (Escape closes that).
  // A closing Escape never gets here: the sheet stops it on the document.
  w.input.onAction('menu', () => {
    if (screens.currentId === 'space' && !space.isBusy && !mc.isOpen) mc.open();
  });

  return { isOpen: () => mc.isOpen };
}
