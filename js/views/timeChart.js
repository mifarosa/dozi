// "What time did I take it" chart: one row per day, the day runs left to right.
// Each entry is a mark whose shape AND color tell its kind, so identity never depends on
// color alone. Rows are buttons: tapping one selects that day (the list below it is the
// chart's table view). Returns markup only.
import { esc } from '../html.js';
import { dayFmt, DAY_NAMES } from '../dates.js';
import { dayFraction, assignLanes } from '../timeline.js';
import { KIND_LABELS } from '../history.js';

// The SVG scales to the card. The card is about 264 px wide on the narrowest phone (320 px), so
// a 284 wide viewBox keeps marks near 9 px across and rows near 24 px tall even there.
const W = 284;
const X0 = 48; // left edge of the 24 h axis (room for the day labels)
const X1 = 276;
const ROW_H = 26; // a row is also its tap target
const LANE_H = 11; // vertical step between lanes when marks would overlap
const MARK_W = 13; // the widest mark, used to decide when two marks need separate lanes
const TOP = 22; // room for the hour labels
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

const x = (minutes) => X0 + dayFraction(minutes) * (X1 - X0);
const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// Mark geometry per kind. Shapes are 9-12 units across so they stay at least 8 px on a 320 px phone.
function markSvg(kind, cx, cy, title) {
  const t = `<title>${esc(title)}</title>`;
  const cls = `tc-mark tc-${kind}`;
  switch (kind) {
    case 'supplement':
      return `<rect class="${cls}" x="${(cx - 4.5).toFixed(1)}" y="${cy - 4.5}" width="9" height="9" rx="1">${t}</rect>`;
    case 'tea':
      return `<polygon class="${cls}" points="${cx.toFixed(1)},${cy - 6.5} ${(cx + 6.5).toFixed(1)},${cy} ${cx.toFixed(1)},${cy + 6.5} ${(cx - 6.5).toFixed(1)},${cy}">${t}</polygon>`;
    case 'other':
      return `<polygon class="${cls}" points="${cx.toFixed(1)},${cy - 6} ${(cx + 6).toFixed(1)},${cy + 5} ${(cx - 6).toFixed(1)},${cy + 5}">${t}</polygon>`;
    default:
      return `<circle class="${cls} tc-med" cx="${cx.toFixed(1)}" cy="${cy}" r="5">${t}</circle>`;
  }
}

function legendIcon(kind) {
  const shape = {
    med: '<circle class="tc-med" cx="6" cy="6" r="5"/>',
    supplement: '<rect class="tc-supplement" x="2" y="2" width="8" height="8" rx="1"/>',
    tea: '<polygon class="tc-tea" points="6,0.5 11.5,6 6,11.5 0.5,6"/>',
    other: '<polygon class="tc-other" points="6,1 11,10 1,10"/>',
  }[kind];
  return `<svg class="lg" viewBox="0 0 12 12" aria-hidden="true">${shape}</svg>`;
}

// Row height grows only when marks have to be stacked.
const heightFor = (lanes) => Math.max(ROW_H, lanes * LANE_H + 6);

function rowHtml(row, top, { selectedDay, todayKey, laid }) {
  const rowH = heightFor(laid.lanes);
  const mid = top + rowH / 2;
  const names = row.items.map((it) => `${clock(it.minutes)} ${it.name}`);
  const label = `${dayFmt.format(row.date)}: ${names.length ? names.join(', ') : 'kayıt yok'}`;
  const cls = ['tc-row', row.key === selectedDay ? 'sel' : '', row.key === todayKey ? 'is-today' : ''].join(' ');
  const weekday = DAY_NAMES[(row.date.getDay() + 6) % 7];
  const planned = row.planned.map((m) => (
    `<line class="tc-plan" x1="${x(m).toFixed(1)}" x2="${x(m).toFixed(1)}" y1="${top + 4}" y2="${top + rowH - 4}"/>`
  )).join('');
  const marks = laid.items.map((it) => (
    markSvg(it.kind, x(it.minutes), mid + (it.lane - (laid.lanes - 1) / 2) * LANE_H, `${clock(it.minutes)} · ${it.name} · ${it.detail}`)
  )).join('');
  return `<g class="${cls}" data-day="${row.key}" tabindex="0" role="button" aria-label="${esc(label)}">
    ${laid.band ? `<rect class="tc-band" x="0" y="${top}" width="${W}" height="${rowH}"/>` : ''}
    <rect class="tc-hit" x="0" y="${top}" width="${W}" height="${rowH}"/>
    <text class="tc-day" x="${X0 - 8}" y="${mid + 3.5}">${row.date.getDate()} ${weekday}</text>
    ${planned}${marks}
  </g>`;
}

// rows: from timeline.js. kinds: which kinds to list in the legend.
// planned: true when the rows carry planned reminder times (drawn as hairline ticks).
export function timeChartHtml({
  rows, selectedDay = null, todayKey, kinds, planned = false, label,
}) {
  const minGap = (MARK_W / (X1 - X0)) * 1440;
  let cursor = TOP;
  const placed = rows.map((r, i) => {
    const laid = { ...assignLanes(r.items, minGap), band: i % 2 === 1 };
    const top = cursor;
    cursor += heightFor(laid.lanes);
    return { r, top, laid };
  });
  const height = cursor + 6;
  const grid = HOURS.map((h) => {
    const gx = (X0 + (h / 24) * (X1 - X0)).toFixed(1);
    return `<line class="tc-grid" x1="${gx}" x2="${gx}" y1="${TOP - 4}" y2="${height - 6}"/>
      <text class="tc-axis" x="${gx}" y="12" text-anchor="middle">${String(h).padStart(2, '0')}</text>`;
  }).join('');
  const body = placed.map(({ r, top, laid }) => rowHtml(r, top, { selectedDay, todayKey, laid })).join('');
  // One series needs no legend box; two or more always get one.
  const keys = kinds.length > 1 ? kinds.map((k) => `<span>${legendIcon(k)}${KIND_LABELS[k]}</span>`) : [];
  if (planned) keys.push('<span><svg class="lg" viewBox="0 0 12 12" aria-hidden="true"><line class="tc-plan" x1="6" x2="6" y1="1" y2="11"/></svg>Hatırlatma saati</span>');
  return `<svg class="tc" viewBox="0 0 ${W} ${height}" role="group" aria-label="${esc(label)}">${grid}${body}</svg>
    ${keys.length ? `<div class="cal-legend tc-legend">${keys.join('')}</div>` : ''}`;
}
