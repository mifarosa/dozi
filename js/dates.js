// Date and time helpers shared by the data modules and the screens.
import { locale } from './lang.js';

export const pad2 = (n) => String(n).padStart(2, '0');

export const hhmm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
export const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Weeks start on Monday in every language.
export function startOfWeek(d) {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() + 6) % 7));
}

// Formatters are built per language and reused.
const cache = new Map();
function formatter(options) {
  const key = `${locale()}|${JSON.stringify(options)}`;
  if (!cache.has(key)) cache.set(key, new Intl.DateTimeFormat(locale(), options));
  return cache.get(key);
}
const lazy = (options) => ({ format: (d) => formatter(options).format(d) });

const timeFmt = lazy({ hour: '2-digit', minute: '2-digit' });
export const monthFmt = lazy({ month: 'long', year: 'numeric' });
export const dayFmt = lazy({ day: 'numeric', month: 'long', weekday: 'long' });
export const monthNameFmt = lazy({ month: 'long' });
// "9 Nov 2026" / "9 Kas 2026"
export const dateFmt = lazy({ day: 'numeric', month: 'short', year: 'numeric' });

// "14:05" from a millisecond timestamp.
export const formatTime = (ms) => timeFmt.format(new Date(ms));
