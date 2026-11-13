/**
 * Patch: docs/VISUAL_DESIGN.md section 6. A round, embroidered-style badge in a world or category
 * colour. Earned: full colour and the date. Not yet: an outline and what earns it. The words say which,
 * so colour is never the only sign.
 */

export interface PatchOptions {
  name: string;
  /** A world id ('mars' for `--world-mars`), or a token name such as 'signal-gold' or 'holo-cyan'. */
  color: string;
  earned: boolean;
  /** When it was earned, in words ("12 November 2026"). */
  date?: string;
  /** What earns it, in words ("Find 3 things on Mars"). */
  condition?: string;
  /** An inline SVG from the game's code, drawn in the patch. */
  icon?: string;
}

export function createPatch({ name, color, earned, date, condition, icon }: PatchOptions): HTMLElement {
  const patch = document.createElement('figure');
  patch.className = 'rp-patch';
  patch.dataset.state = earned ? 'earned' : 'not-yet';
  const token = color.includes('-') ? color : `world-${color}`;
  patch.style.setProperty('--rp-patch', `var(--${token})`);

  const disc = document.createElement('span');
  disc.className = 'rp-patch__disc';
  disc.setAttribute('aria-hidden', 'true');
  if (icon) disc.innerHTML = icon;

  const caption = document.createElement('figcaption');
  caption.className = 'rp-patch__caption';
  const title = document.createElement('span');
  title.className = 'rp-patch__name';
  title.textContent = name;
  const detail = document.createElement('span');
  detail.className = 'rp-patch__detail';
  detail.textContent = earned ? (date ? `Earned ${date}` : 'Earned') : `Not yet: ${condition ?? 'keep exploring'}`;
  caption.append(title, detail);

  patch.append(disc, caption);
  return patch;
}
