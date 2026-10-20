import './tz.js';
// Decides which reminders to send right now. Pure: no network, no clock of its own.
// It reuses the app's own functions so "already took it today" means exactly the same
// thing here as on the phone.
import { pendingTimes } from '../../js/reminders.js';
import { remainingQ, normalizeMed } from '../../js/store.js';
import { pillsText, translate } from '../../js/i18n.js';
import { toWall, isValidTimeZone } from './wall.js';

const DEFAULT_ZONE = 'Europe/Istanbul';
const HOUR = 60;
// Repeats stop here so nobody is woken at night. The reminder at its own time is always sent.
const LAST_REPEAT_MIN = 22 * HOUR;

const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// Medicine copy whose timestamps are shifted into the user's wall clock.
function inWall(med, timeZone) {
  const m = normalizeMed(med);
  // boxStart is a timestamp too; it must be shifted with the log or boxes would split at the wrong moment.
  return {
    ...m,
    boxStart: m.boxStart ? toWall(m.boxStart, timeZone) : 0,
    log: m.log.map((e) => ({ ...e, t: toWall(e.t, timeZone) })),
  };
}

export function wallDayKey(wallMs) {
  return new Date(wallMs).toISOString().slice(0, 10);
}

// The reminder slot that applies at minute `nowMin` for one reminder time: the time itself (0)
// or one of its hourly repeats (1, 2, ...). Repeats run until the medicine's next reminder time,
// 22:00 or the end of the day, whichever comes first. Null when no slot is current.
function currentSlot(time, allTimes, nowMin, maxLateMin, repeatHourly) {
  const base = minutes(time);
  if (nowMin < base) return null;
  const k = repeatHourly ? Math.floor((nowMin - base) / HOUR) : 0;
  const slot = base + k * HOUR;
  if (nowMin - slot > maxLateMin) return null;
  if (k > 0) {
    const next = allTimes.map(minutes).filter((m) => m > base).sort((a, b) => a - b)[0];
    if (slot > LAST_REPEAT_MIN || (next !== undefined && slot >= next)) return null;
  }
  return k;
}

// Reminders that should be sent at `nowMs` for one user.
//   meds         the user's medicines as stored in the cloud
//   timeZone     IANA zone of the device that asked for notifications
//   maxLateMin   a reminder slot older than this is skipped, so a server restart never replays
//                old reminders
//   repeatHourly a dose that is still not taken is reminded again every hour (see currentSlot)
// Returns [{ key, medId, name, time, repeat, dose, body }]; key is stable for one medicine, slot and day.
// repeat is 0 for the reminder itself and 1, 2, ... for its hourly repeats.
// body is in Turkish; the notifier rewrites it per device from `dose` and `time`.
export function dueReminders({
  uid, meds, timeZone, nowMs, maxLateMin = 30, repeatHourly = true,
}) {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_ZONE;
  const wallNow = new Date(toWall(nowMs, zone));
  const nowMin = wallNow.getUTCHours() * 60 + wallNow.getUTCMinutes();
  const day = wallDayKey(wallNow.getTime());
  const out = [];

  for (const raw of meds || []) {
    if (!raw || !Array.isArray(raw.times) || !raw.times.length) continue;
    const m = inWall(raw, zone);
    if (remainingQ(m) <= 0) continue;
    // Only the minute that "now" falls in or earlier ones; pendingTimes also drops
    // everything already covered by a dose taken today.
    const pending = new Set(pendingTimes(m, wallNow));
    for (const time of raw.times) {
      if (!pending.has(time)) continue;
      const repeat = currentSlot(time, raw.times, nowMin, maxLateMin, repeatHourly);
      if (repeat === null) continue;
      out.push({
        // The first reminder keeps the key it always had; the day stays last (old keys are pruned by it).
        key: `${uid}|${m.id}|${repeat ? `${time}+${repeat}` : time}|${day}`,
        medId: m.id,
        name: m.name,
        time,
        repeat,
        dose: m.dose,
        body: `${translate('tr', repeat ? 'notify.again' : 'notify.amount', { amount: pillsText(m.dose, 'tr'), time })}`,
      });
    }
  }
  return out;
}
