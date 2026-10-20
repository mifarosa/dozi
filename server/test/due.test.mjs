import '../src/tz.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tzOffsetMs, toWall, isValidTimeZone } from '../src/wall.js';
import { dueReminders } from '../src/due.js';

const IST = 'Europe/Istanbul'; // UTC+3 all year
// An instant given as Istanbul wall-clock time.
const ist = (iso) => new Date(`${iso}+03:00`).getTime();
const med = (over = {}) => ({
  id: 'm1', name: 'Vitamin D', blisters: 1, perBlister: 10, dose: 4, perDay: 1, startQ: 0,
  times: ['08:00'], fired: {}, log: [], ...over,
});
const due = (meds, iso, extra = {}) => dueReminders({
  uid: 'u1', meds, timeZone: IST, nowMs: ist(iso), ...extra,
});

test('time zone helpers', () => {
  assert.equal(tzOffsetMs(ist('2026-10-07T12:00:00'), IST), 3 * 3600 * 1000);
  assert.equal(new Date(toWall(ist('2026-10-07T12:00:00'), IST)).getUTCHours(), 12);
  assert.equal(isValidTimeZone('Europe/Istanbul'), true);
  assert.equal(isValidTimeZone('Mars/Olympus'), false);
  assert.equal(isValidTimeZone(''), false);
});

test('sends at the reminder minute and stays quiet before it', () => {
  assert.equal(due([med()], '2026-10-07T07:59:59').length, 0);
  const [r] = due([med()], '2026-10-07T08:00:10');
  assert.equal(r.name, 'Vitamin D');
  assert.equal(r.time, '08:00');
  assert.equal(r.body, '1 hap · 08:00');
  assert.equal(r.key, 'u1|m1|08:00|2026-10-07');
});

test('a dose already taken today (even earlier than the reminder) means no reminder', () => {
  const early = med({ log: [{ t: ist('2026-10-07T07:10:00'), q: 4 }] });
  assert.equal(due([early], '2026-10-07T08:05:00').length, 0);
  const late = med({ log: [{ t: ist('2026-10-07T08:02:00'), q: 4 }] });
  assert.equal(due([late], '2026-10-07T08:05:00').length, 0);
});

test('yesterday\'s dose does not count today, judged on the user\'s own midnight', () => {
  // 23:30 on the 6th in Istanbul is 20:30 UTC. It must still count as the 6th, not today.
  const yesterday = med({ log: [{ t: ist('2026-10-06T23:30:00'), q: 4 }] });
  assert.equal(due([yesterday], '2026-10-07T08:05:00').length, 1);
});

test('a time more than maxLateMin ago is skipped (no morning replay in the evening)', () => {
  assert.equal(due([med()], '2026-10-07T08:31:00').length, 0);
  assert.equal(due([med()], '2026-10-07T08:30:00').length, 1);
  assert.equal(due([med()], '2026-10-07T20:00:00', { maxLateMin: 30, repeatHourly: false }).length, 0);
});

test('two daily times: each is judged on its own', () => {
  const two = med({ perDay: 2, times: ['08:00', '20:00'], log: [{ t: ist('2026-10-07T08:03:00'), q: 4 }] });
  assert.equal(due([two], '2026-10-07T08:10:00').length, 0);
  assert.deepEqual(due([two], '2026-10-07T20:05:00').map((r) => r.time), ['20:00']);
});

test('finished medicines and medicines without times are ignored', () => {
  assert.equal(due([med({ startQ: 40 })], '2026-10-07T08:05:00').length, 0);
  assert.equal(due([med({ times: [] })], '2026-10-07T08:05:00').length, 0);
  assert.equal(due([{ id: 'x', name: 'broken' }, null], '2026-10-07T08:05:00').length, 0);
});

test('the same instant is a different wall clock in another time zone', () => {
  // Hourly repeats are off here: this is about which wall clock the first reminder follows.
  const first = (timeZone, nowMs) => dueReminders({
    uid: 'u', meds: [med()], timeZone, nowMs, repeatHourly: false,
  }).length;
  const nowMs = ist('2026-10-07T08:05:00'); // 05:05 UTC
  assert.equal(first(IST, nowMs), 1);
  assert.equal(first('UTC', nowMs), 0);
  assert.equal(first('Asia/Tokyo', nowMs), 0);
  // 08:05 in Tokyo is 23:05 UTC the evening before
  const tokyo = new Date('2026-10-07T08:05:00+09:00').getTime();
  assert.equal(first('Asia/Tokyo', tokyo), 1);
});

test('an unknown time zone falls back to Istanbul instead of crashing', () => {
  const r = dueReminders({ uid: 'u', meds: [med()], timeZone: 'Nope/Nowhere', nowMs: ist('2026-10-07T08:05:00') });
  assert.equal(r.length, 1);
});

test('pills left of a partly used medicine are still reminded', () => {
  assert.equal(due([med({ startQ: 39 })], '2026-10-07T08:05:00').length, 1); // one quarter left
});

test('a new box brings reminders back; an emptied one stays quiet until it is replaced', () => {
  // one blister of 4 pills, one a day; the box was emptied on Oct 4th at 08:00
  const base = { blisters: 1, perBlister: 4, startQ: 0 };
  const log = [1, 2, 3, 4].map((d) => ({ t: ist(`2026-10-0${d}T08:00:00`), q: 4 }));
  const emptied = med({ ...base, log });
  assert.equal(due([emptied], '2026-10-05T08:05:00').length, 0);
  // a new box opened right after the last pill, today's dose not taken yet
  const next = med({ ...base, blisters: 2, log, boxStart: ist('2026-10-04T08:00:00') + 1 });
  assert.equal(due([next], '2026-10-05T08:05:00').length, 1);
  // today's dose already taken in the new box
  const taken = { ...next, log: [...log, { t: ist('2026-10-05T07:50:00'), q: 4 }] };
  assert.equal(due([taken], '2026-10-05T08:05:00').length, 0);
});

test('boxStart is judged on the user\'s wall clock, not in UTC', () => {
  // The new box starts at 00:30 Istanbul time on the 5th (= 21:30 UTC on the 4th).
  // A dose logged at 00:10 Istanbul on the 5th is still part of the old box, but it was
  // taken today, so today's reminder must stay quiet.
  const log = [
    { t: ist('2026-10-04T08:00:00'), q: 8 }, { t: ist('2026-10-05T00:10:00'), q: 8 },
  ];
  const m = med({ blisters: 1, perBlister: 4, startQ: 0, log, boxStart: ist('2026-10-05T00:30:00'), times: ['08:00'] });
  assert.equal(due([m], '2026-10-05T08:05:00').length, 0, 'the 00:10 dose already covers today');
  const m2 = { ...m, log: [log[0]] };
  assert.equal(due([m2], '2026-10-05T08:05:00').length, 1);
});

test('a dose that is still not taken is reminded again every hour', () => {
  const at = (iso) => due([med()], iso).map((r) => [r.time, r.repeat, r.key.split('|')[2]]);
  assert.deepEqual(at('2026-10-07T08:05:00'), [['08:00', 0, '08:00']]);
  assert.deepEqual(at('2026-10-07T08:45:00'), []); // between slots: nothing is due
  assert.deepEqual(at('2026-10-07T09:00:30'), [['08:00', 1, '08:00+1']]);
  assert.deepEqual(at('2026-10-07T13:10:00'), [['08:00', 5, '08:00+5']]);
  assert.match(due([med()], '2026-10-07T09:00:30')[0].body, /Hâlâ alınmadı/);
  assert.doesNotMatch(due([med()], '2026-10-07T08:05:00')[0].body, /Hâlâ/);
});

test('repeats stop once the dose is taken, even a late one', () => {
  const taken = med({ log: [{ t: ist('2026-10-07T10:20:00'), q: 4 }] });
  assert.equal(due([taken], '2026-10-07T11:00:30').length, 0);
  assert.equal(due([med({ log: [{ t: ist('2026-10-07T10:20:00'), q: 2 }] })], '2026-10-07T11:00:30').length, 1);
});

test('no repeats at night, and each repeat is its own key', () => {
  assert.equal(due([med()], '2026-10-07T22:00:30').length, 1);
  assert.equal(due([med()], '2026-10-07T23:00:30').length, 0);
  assert.equal(due([med({ times: ['23:00'] })], '2026-10-07T23:05:00').length, 1); // its own time is always sent
  const keys = ['09:00:30', '10:00:30', '11:00:30'].map((t) => due([med()], `2026-10-07T${t}`)[0].key);
  assert.equal(new Set(keys).size, 3);
  assert.ok(keys.every((k) => k.endsWith('|2026-10-07')), 'the day stays last so old keys can be pruned');
});

test('repeats of one time stop when the next reminder time of that medicine comes', () => {
  const two = med({ perDay: 2, times: ['08:00', '14:00'] });
  assert.deepEqual(due([two], '2026-10-07T13:05:00').map((r) => r.key.split('|')[2]), ['08:00+5']);
  // At 14:05 the 14:00 reminder is due; the morning one no longer repeats.
  assert.deepEqual(due([two], '2026-10-07T14:05:00').map((r) => r.key.split('|')[2]), ['14:00']);
  assert.deepEqual(due([two], '2026-10-07T15:05:00').map((r) => r.key.split('|')[2]), ['14:00+1']);
});

test('repeats can be turned off', () => {
  assert.equal(due([med()], '2026-10-07T10:05:00', { repeatHourly: false }).length, 0);
  assert.equal(due([med()], '2026-10-07T08:05:00', { repeatHourly: false }).length, 1);
});
