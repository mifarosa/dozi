// Blister drawing: one pie per pill, grouped by blister.
import { QUARTERS, cellQuarters, formatPills } from '../store.js';

// One pill: a circle whose remaining share is drawn as a filled pie.
export function pillSvg(usedQ) {
  const left = QUARTERS - usedQ;
  if (left === QUARTERS) {
    return '<svg viewBox="0 0 20 20" class="pill"><circle cx="10" cy="10" r="8.5" class="pill-full"/></svg>';
  }
  if (left === 0) {
    return '<svg viewBox="0 0 20 20" class="pill"><circle cx="10" cy="10" r="8.5" class="pill-empty"/></svg>';
  }
  // Remaining part is a pie slice that starts at 12 o'clock and runs clockwise.
  const angle = (left / QUARTERS) * Math.PI * 2;
  const x = 10 + 8.5 * Math.sin(angle);
  const y = 10 - 8.5 * Math.cos(angle);
  const large = left > QUARTERS / 2 ? 1 : 0;
  return `<svg viewBox="0 0 20 20" class="pill">
    <circle cx="10" cy="10" r="8.5" class="pill-empty"/>
    <path d="M10 10 L10 1.5 A8.5 8.5 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" class="pill-full"/>
  </svg>`;
}

// Quarter pills still left in blister number b (0-based).
function blisterLeftQ(m, b) {
  let left = 0;
  for (let p = 0; p < m.perBlister; p++) {
    left += QUARTERS - cellQuarters(m, b * m.perBlister + p);
  }
  return left;
}

export function blisterHtml(m, b) {
  const cells = [];
  for (let p = 0; p < m.perBlister; p++) {
    const index = b * m.perBlister + p;
    cells.push(`<div class="cell" title="${b + 1}. blister, ${p + 1}. hap">${pillSvg(cellQuarters(m, index))}</div>`);
  }
  const left = Math.max(0, blisterLeftQ(m, b));
  return `<div class="blister">
    <div class="blister-head"><span>${b + 1}. blister</span><span>${formatPills(left)} kaldı</span></div>
    <div class="cells">${cells.join('')}</div>
  </div>`;
}
