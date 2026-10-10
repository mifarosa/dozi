// Boxes and late entries. A medicine is bought box by box: when one runs out the next
// one starts, while every intake stays in the history. Pure logic, no DOM.
import { totalQ, remainingQ } from './store.js';
import { dayKey, startOfDay } from './dates.js';
import { resolveExtraTime } from './history.js';

const DAY_MS = 86400000;

// When the current box was emptied: the time of the intake that used its last pill.
// Null while pills are left (or when it was emptied by editing the position).
export function boxEndedAt(m) {
  if (remainingQ(m) > 0) return null;
  const since = m.boxStart || 0;
  let used = m.startQ;
  const inBox = m.log.filter((e) => e.t >= since).sort((a, b) => a.t - b.t);
  for (const e of inBox) {
    used += e.q;
    if (used >= totalQ(m)) return e.t;
  }
  return null;
}

// Should the app ask about switching to a new box? Only when the box ran out on an earlier
// day (not today) and the person has not said "later" today.
// Returns { daysAgo } or null.
export function newBoxPrompt(m, now = new Date()) {
  if (remainingQ(m) > 0) return null;
  if (m.askedBox === dayKey(now)) return null;
  const ended = boxEndedAt(m);
  const daysAgo = ended == null
    ? 1
    : Math.round((startOfDay(now).getTime() - startOfDay(new Date(ended)).getTime()) / DAY_MS);
  return daysAgo >= 1 ? { daysAgo } : null;
}

// "dün bitti", "3 gün önce bitti"
export function endedLabel(daysAgo) {
  return daysAgo === 1 ? 'dün bitti' : `${daysAgo} gün önce bitti`;
}

// Fields to merge into the medicine when a new box is opened.
//   firstDoseAt  time of a dose taken today that belongs in the new box
// After an emptied box the new one starts right after its last pill, so a dose logged
// later for the days since then lands in the new box. In the middle of a box it starts now.
export function startNewBox(m, { blisters, perBlister, firstDoseAt = null, now = Date.now() }) {
  const ended = boxEndedAt(m);
  let boxStart = remainingQ(m) === 0 && ended != null ? ended + 1 : now;
  if (firstDoseAt != null) boxStart = Math.min(boxStart, firstDoseAt);
  const firstLog = m.log.length ? Math.min(...m.log.map((e) => e.t)) : null;
  return {
    boxes: [...(m.boxes || []), {
      from: m.boxStart || firstLog, to: ended ?? now, blisters: m.blisters, perBlister: m.perBlister,
    }],
    boxStart,
    startQ: 0,
    blisters,
    perBlister,
    askedBox: null,
  };
}

// A forgotten dose for an earlier day. Returns the entry to add, or null when the current
// box has no pills left for it. A dose dated before the current box came out of an older one,
// so it is not limited by what is left now.
export function backfillEntry(m, { date, time, q, now = new Date() }) {
  const t = resolveExtraTime(date, time, now);
  const inCurrentBox = t >= (m.boxStart || 0);
  const amount = inCurrentBox ? Math.min(q, remainingQ(m)) : q;
  return amount > 0 ? { t, q: amount } : null;
}
