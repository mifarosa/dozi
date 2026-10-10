import './tz.js';

// Offset in ms between a time zone's wall clock and UTC at a given instant.
export function tzOffsetMs(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wallAsUtc - Math.floor(ms / 1000) * 1000;
}

// Shift an instant so that, read in UTC, it shows the wall clock of `timeZone`.
export const toWall = (ms, timeZone) => ms + tzOffsetMs(ms, timeZone);

export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return typeof timeZone === 'string' && timeZone.length > 0;
  } catch {
    return false;
  }
}
