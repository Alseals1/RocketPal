/**
 * Rank badge: docs/VISUAL_DESIGN.md section 6. A hexagon with the rank number, the rank's name beside
 * it, and a holographic edge. A new rank shimmers once (a single light sweep, never a loop); the
 * shimmer is off on low quality and with reduced motion.
 */

export interface RankBadgeOptions {
  rank: number;
  name: string;
  isNew?: boolean;
}

export function createRankBadge({ rank, name, isNew = false }: RankBadgeOptions): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'rp-rank';
  if (isNew) badge.dataset.new = '';

  const hex = document.createElement('span');
  hex.className = 'rp-rank__hex';
  hex.setAttribute('aria-hidden', 'true');
  const inner = document.createElement('span');
  inner.className = 'rp-rank__inner';
  inner.textContent = String(rank);
  const shine = document.createElement('span');
  shine.className = 'rp-rank__shine';
  hex.append(inner, shine);

  const words = document.createElement('span');
  words.className = 'rp-rank__words';
  const number = document.createElement('span');
  number.className = 'rp-rank__number';
  number.textContent = `Rank ${rank}`;
  const title = document.createElement('span');
  title.className = 'rp-rank__name';
  title.textContent = name;
  words.append(number, title);

  badge.append(hex, words);
  return badge;
}
