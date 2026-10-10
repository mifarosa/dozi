// Data for the "what time did I take it" chart: one row per day, one mark per entry.
// Pure; the drawing lives in views/timeChart.js.
import { dayKey, addDays, startOfDay } from './dates.js';

export const minuteOfDay = (ms) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

// Position along the 24 hour axis, 0..1.
export const dayFraction = (minutes) => Math.min(1, Math.max(0, minutes / 1440));

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function rowFor(date, byDay, planned) {
  const key = dayKey(date);
  const items = (byDay.get(key) || []).slice().sort((a, b) => a.t - b.t)
    .map((e) => ({ ...e, minutes: minuteOfDay(e.t) }));
  return { key, date, items, planned: planned.map(toMinutes) };
}

function groupByKey(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!map.has(e.key)) map.set(e.key, []);
    map.get(e.key).push(e);
  }
  return map;
}

// Every day of a month, oldest first. The current month stops at today: days that have
// not happened yet carry no information and only make the chart longer.
export function monthRows(entries, year, month, now = new Date(), planned = []) {
  const byDay = groupByKey(entries);
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const today = startOfDay(now);
  const end = last > today && year === today.getFullYear() && month === today.getMonth() ? today : last;
  const rows = [];
  for (let d = first; d <= end; d = addDays(d, 1)) rows.push(rowFor(d, byDay, planned));
  return rows;
}

// The last `days` days ending today, oldest first.
export function lastDaysRows(entries, days, now = new Date(), planned = []) {
  const byDay = groupByKey(entries);
  const today = startOfDay(now);
  const rows = [];
  for (let i = days - 1; i >= 0; i--) rows.push(rowFor(addDays(today, -i), byDay, planned));
  return rows;
}

// Marks that would touch sideways get their own lane (a thin track inside the row), so several
// things taken together at 08:00 all stay visible instead of hiding each other.
// items must be sorted by time; minGap is the least distance, in minutes, that keeps two marks apart.
export function assignLanes(items, minGap) {
  const lastAt = []; // minutes of the last mark placed in each lane
  const placed = items.map((it) => {
    let lane = lastAt.findIndex((at) => it.minutes - at >= minGap);
    if (lane === -1) lane = lastAt.length;
    lastAt[lane] = it.minutes;
    return { ...it, lane };
  });
  return { items: placed, lanes: Math.max(1, lastAt.length) };
}

export const hasMarks = (rows) => rows.some((r) => r.items.length > 0);
