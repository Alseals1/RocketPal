/**
 * Chip: docs/VISUAL_DESIGN.md section 6. A small pill with an icon or dot and text: a world chip (with
 * the world's colour dot, always next to its name) or a status chip ("+20 XP"). Not pressable.
 */

export interface ChipOptions {
  text: string;
  /** A world id, for example 'mars' for `--world-mars`: makes a world chip with a colour dot. */
  world?: string;
  /** A status chip (gold text) instead of a world chip. */
  status?: boolean;
}

export function createChip({ text, world, status = false }: ChipOptions): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = `rp-chip ${status ? 'rp-chip--status' : 'rp-chip--world'}`;
  if (world) {
    chip.style.setProperty('--rp-world', `var(--world-${world})`);
    const dot = document.createElement('span');
    dot.className = 'rp-chip__dot';
    dot.setAttribute('aria-hidden', 'true');
    chip.append(dot);
  }
  const label = document.createElement('span');
  label.textContent = text;
  chip.append(label);
  return chip;
}
