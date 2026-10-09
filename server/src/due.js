import './tz.js';
// Decides which reminders to send right now. Pure: no network, no clock of its own.
// It reuses the app's own functions so "already took it today" means exactly the same
// thing here as on the phone.
import { pendingTimes } from '../../js/reminders.js';
import { remainingQ, formatPills, normalizeMed } from '../../js/store.js';
import { toWall, isValidTimeZone } from './wall.js';

const DEFAULT_ZONE = 'Europe/Istanbul';

const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// Medicine copy whose timestamps are shifted into the user's wall clock.
function inWall(med, timeZone) {
  const m = normalizeMed(med);
  return { ...m, log: m.log.map((e) => ({ ...e, t: toWall(e.t, timeZone) })) };
}

export function wallDayKey(wallMs) {
  return new Date(wallMs).toISOString().slice(0, 10);
}

// Reminders that should be sent at `nowMs` for one user.
//   meds         the user's medicines as stored in the cloud
//   timeZone     IANA zone of the device that asked for notifications
//   maxLateMin   a time older than this is skipped, so a late subscription or a
//                server restart never replays the morning's reminders in the evening
// Returns [{ key, medId, name, time, body }]; key is stable for one medicine, time and day.
export function dueReminders({ uid, meds, timeZone, nowMs, maxLateMin = 30 }) {
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
      const late = nowMin - minutes(time);
      if (late < 0 || late > maxLateMin) continue;
      out.push({
        key: `${uid}|${m.id}|${time}|${day}`,
        medId: m.id,
        name: m.name,
        time,
        body: `${formatPills(m.dose)} hap · ${time}`,
      });
    }
  }
  return out;
}
