// Reminder logic. Dozi is a static PWA with no server, so reminders can only
// fire while the app is open or kept alive in the background by the browser.
import { takenTodayQ } from './store.js';

const pad = (n) => String(n).padStart(2, '0');

export const hhmm = (now) => `${pad(now.getHours())}:${pad(now.getMinutes())}`;
export const dayKey = (now) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export function parseTimes(values) {
  const valid = values.filter((v) => /^\d{2}:\d{2}$/.test(v));
  return [...new Set(valid)].sort();
}

// Reminder times that have already passed today and whose dose is not yet taken.
// A time counts as covered when the quarters taken today reach one dose per passed time.
export function pendingTimes(m, now = new Date()) {
  const times = m.times || [];
  const passed = times.filter((t) => t <= hhmm(now));
  if (!passed.length) return [];
  return takenTodayQ(m, now) >= passed.length * m.dose ? [] : passed;
}

// Pending times that have not been announced with a notification today.
export function unnotifiedTimes(m, now = new Date()) {
  const key = dayKey(now);
  const fired = m.fired || {};
  return pendingTimes(m, now).filter((t) => fired[t] !== key);
}

// Timestamp for an intake. An empty field means "now"; a time later than now
// can't have happened yet, so it also falls back to now.
export function resolveTakeTime(value, now = new Date()) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return now.getTime();
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(match[1]), Number(match[2]));
  return at.getTime() > now.getTime() ? now.getTime() : at.getTime();
}

// True once today's total dose (dose × times per day) has been taken.
export function dayComplete(m, now = new Date()) {
  return takenTodayQ(m, now) >= m.dose * m.perDay;
}
