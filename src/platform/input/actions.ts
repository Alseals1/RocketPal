/**
 * The actions the player can ask for, and the keys that ask for them (docs/TECHNICAL_ARCHITECTURE.md 4.15,
 * VISUAL_DESIGN.md "Keyboard"). Screens subscribe with `InputManager.onAction`. Nothing subscribes yet: the
 * Star Map, Mission Control and the dialogs that use them come later.
 */
export type Action = 'boost' | 'starMap' | 'menu' | 'back' | 'confirm' | 'listen';

/** `KeyboardEvent.code` values for each action. Escape is both `menu` (in space) and `back` (in a sheet): the screen decides. */
export const ACTION_KEYS: Record<Action, readonly string[]> = {
  boost: ['Space'],
  starMap: ['KeyM'],
  menu: ['Escape'],
  back: ['Escape'],
  confirm: ['Enter', 'NumpadEnter'],
  listen: [], // only the Listen buttons, no key
};

const ALL_ACTIONS = Object.keys(ACTION_KEYS) as Action[];

/** The actions a key asks for, in table order. */
export function actionsForKey(code: string): Action[] {
  return ALL_ACTIONS.filter((a) => ACTION_KEYS[a].includes(code));
}
