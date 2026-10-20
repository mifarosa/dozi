// When will a box run out? Pure; used by the calendar and the medicine screen.
import { remainingQ, takenTodayQ } from './store.js';
import { startOfDay, addDays, dayKey } from './dates.js';

// The day the last pill is taken, assuming the usual dose every day from now on. Today counts
// only for the dose still to take: once today's doses are in, the pills left start tomorrow.
// Null when the box is already empty.
export function runOutDate(m, now = new Date()) {
  const left = remainingQ(m);
  const perDayQ = m.dose * m.perDay;
  if (left <= 0 || perDayQ <= 0) return null;
  const today = startOfDay(now);
  const needToday = Math.max(0, perDayQ - takenTodayQ(m, now));
  if (left <= needToday) return today;
  return addDays(today, Math.ceil((left - needToday) / perDayQ));
}

// Every medicine that still has pills, with its run-out day, soonest first.
export function runOuts(meds, now = new Date()) {
  return meds
    .map((med) => ({ med, date: runOutDate(med, now) }))
    .filter((r) => r.date)
    .sort((a, b) => a.date - b.date || a.med.name.localeCompare(b.med.name));
}

// Run-out medicine names by day key, for marking the calendar grid.
export function runOutsByDay(meds, now = new Date()) {
  const map = new Map();
  for (const { med, date } of runOuts(meds, now)) {
    const key = dayKey(date);
    map.set(key, [...(map.get(key) || []), med.name]);
  }
  return map;
}

// Whole days from today to `date` (0 = today).
export const daysUntil = (date, now = new Date()) => (
  Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86400000)
);
