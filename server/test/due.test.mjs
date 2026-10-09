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
  assert.equal(due([med()], '2026-10-07T20:00:00', { maxLateMin: 30 }).length, 0);
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
  const nowMs = ist('2026-10-07T08:05:00'); // 05:05 UTC
  assert.equal(dueReminders({ uid: 'u', meds: [med()], timeZone: IST, nowMs }).length, 1);
  assert.equal(dueReminders({ uid: 'u', meds: [med()], timeZone: 'UTC', nowMs }).length, 0);
  assert.equal(dueReminders({ uid: 'u', meds: [med()], timeZone: 'Asia/Tokyo', nowMs }).length, 0);
  // 08:05 in Tokyo is 23:05 UTC the evening before
  const tokyo = new Date('2026-10-07T08:05:00+09:00').getTime();
  assert.equal(dueReminders({ uid: 'u', meds: [med()], timeZone: 'Asia/Tokyo', nowMs: tokyo }).length, 1);
});

test('an unknown time zone falls back to Istanbul instead of crashing', () => {
  const r = dueReminders({ uid: 'u', meds: [med()], timeZone: 'Nope/Nowhere', nowMs: ist('2026-10-07T08:05:00') });
  assert.equal(r.length, 1);
});

test('pills left of a partly used medicine are still reminded', () => {
  assert.equal(due([med({ startQ: 39 })], '2026-10-07T08:05:00').length, 1); // one quarter left
});
