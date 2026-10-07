// Calendar data: turns medicine intakes and free-form drinks into one timeline.
import { dayKey } from './reminders.js';
import { formatPills } from './store.js';

// Free-form things people drink or take besides their prescribed medicines.
export const EXTRA_KINDS = {
  supplement: 'Vitamin / takviye',
  tea: 'Bitki çayı',
  other: 'Diğer',
};

export const KIND_LABELS = { med: 'İlaç', ...EXTRA_KINDS };
const KIND_ORDER = ['med', 'supplement', 'tea', 'other'];

export const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Weeks start on Monday, like the rest of the Turkish calendar UI.
export function startOfWeek(d) {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(day, -((day.getDay() + 6) % 7));
}

// Every intake and extra, newest first.
export function buildEntries(meds, extras) {
  const entries = [];
  for (const m of meds) {
    for (const e of m.log) {
      entries.push({
        t: e.t, key: dayKey(new Date(e.t)), name: m.name, kind: 'med',
        detail: `${formatPills(e.q)} hap`, medId: m.id,
      });
    }
  }
  for (const x of extras) {
    const kind = EXTRA_KINDS[x.kind] ? x.kind : 'other';
    entries.push({
      t: x.t, key: dayKey(new Date(x.t)), name: x.name, kind,
      detail: EXTRA_KINDS[kind], extraId: x.id,
    });
  }
  return entries.sort((a, b) => b.t - a.t);
}

export function groupByDay(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!map.has(e.key)) map.set(e.key, []);
    map.get(e.key).push(e);
  }
  return map;
}

// Distinct kinds present on a day, in a stable order, for the calendar dots.
export function dayKinds(items) {
  const present = new Set(items.map((e) => e.kind));
  return KIND_ORDER.filter((k) => present.has(k));
}

export function monthEntries(entries, year, month) {
  return entries.filter((e) => {
    const d = new Date(e.t);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

// Most recently used extra names (case-insensitive unique), for one-tap logging.
export function recentExtras(extras, limit = 6) {
  const seen = new Set();
  const out = [];
  for (const x of [...extras].sort((a, b) => b.t - a.t)) {
    const key = x.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: x.name, kind: EXTRA_KINDS[x.kind] ? x.kind : 'other' });
    if (out.length === limit) break;
  }
  return out;
}

// A date + time from the form; a moment in the future can't have happened yet.
export function resolveExtraTime(date, time, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  const t = /^(\d{2}):(\d{2})$/.exec(time || '');
  if (!m || !t) return now.getTime();
  const at = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(t[1]), Number(t[2]));
  return at.getTime() > now.getTime() ? now.getTime() : at.getTime();
}
