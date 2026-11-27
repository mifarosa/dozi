// "Taken two days in a row": when a medicine was taken on each of the last two days, the app asks on
// the third day whether it is going to be taken today. Pure functions, shared by the app and the
// notification server (which runs them on wall-clock timestamps, like the other reminder logic).
import { startOfDay, addDays, dayKey, pad2 } from './dates.js';
import { remainingQ } from './store.js';

const ASK_FROM = 8 * 60; // never ask before 08:00 ...
const ASK_UNTIL = 22 * 60; // ... or after 22:00, whenever the doses were taken
const NEAR_MIN = 60; // a reminder time this close to the ask time already does the asking

const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const minToHhmm = (min) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

// Minute of the day of the first intake between two moments, or null when there was none.
function firstIntakeMin(m, from, to) {
  const times = m.log.filter((e) => e.q > 0 && e.t >= from && e.t < to).map((e) => e.t);
  if (!times.length) return null;
  const d = new Date(Math.min(...times));
  return d.getHours() * 60 + d.getMinutes();
}

// The question to ask now about one medicine, or null.
//   { time: 'HH:MM' }   the moment to ask: the earlier of the last two days' first intakes, kept within
//                        08:00-22:00. Asking at the earlier one means the question comes before the dose.
// Nothing is asked when the medicine is on the shelf or used up, was taken today (before the ask time too),
// was already answered "not today" (`learnNo`), or missed a day: the streak has to be the last two days.
export function learnedAsk(m, now = new Date()) {
  if (!m || m.shelved || remainingQ(m) <= 0) return null;
  const today = startOfDay(now).getTime();
  if (m.learnNo === dayKey(now)) return null;
  if (m.log.some((e) => e.q > 0 && e.t >= today)) return null;
  const d1 = startOfDay(addDays(now, -1)).getTime();
  const d2 = startOfDay(addDays(now, -2)).getTime();
  const a = firstIntakeMin(m, d1, today);
  const b = firstIntakeMin(m, d2, d1);
  if (a === null || b === null) return null;
  const ask = Math.min(ASK_UNTIL, Math.max(ASK_FROM, Math.min(a, b)));
  if ((m.times || []).some((t) => Math.abs(minutesOf(t) - ask) <= NEAR_MIN)) return null;
  if (now.getHours() * 60 + now.getMinutes() < ask) return null;
  return { time: minToHhmm(ask) };
}
