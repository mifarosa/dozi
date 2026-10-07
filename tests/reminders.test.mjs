import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimes, pendingTimes, dueMeds, unnotifiedTimes, resolveTakeTime, dayComplete,
} from '../js/reminders.js';

const at = (h, m = 0) => new Date(2026, 9, 6, h, m);
const med = (log = [], over = {}) => ({
  id: 'm', dose: 4, perDay: 2, blisters: 1, perBlister: 10, startQ: 0, times: ['08:00', '20:00'], fired: {}, log, ...over,
});

test('parseTimes keeps valid, unique, sorted times', () => {
  assert.deepEqual(parseTimes(['20:00', '', '08:00', '20:00', '8:0']), ['08:00', '20:00']);
});

test('a time is pending once it has passed and no dose covers it', () => {
  assert.deepEqual(pendingTimes(med(), at(7, 59)), []);
  assert.deepEqual(pendingTimes(med(), at(8, 0)), ['08:00']);
  assert.deepEqual(pendingTimes(med(), at(21, 0)), ['08:00', '20:00']);
});

test('a dose taken before the reminder still covers it', () => {
  const early = med([{ t: at(7, 0).getTime(), q: 4 }]);
  assert.deepEqual(pendingTimes(early, at(8, 30)), []);
  // One dose is not enough for two passed times, so the passed times stay pending.
  assert.deepEqual(pendingTimes(early, at(21, 0)), ['08:00', '20:00']);
});

test('dueMeds skips finished medicines', () => {
  const finished = med([], { id: 'done', startQ: 40 });
  assert.deepEqual(dueMeds([med(), finished], at(9)).map((m) => m.id), ['m']);
});

test('unnotifiedTimes remembers what was announced today only', () => {
  assert.deepEqual(unnotifiedTimes(med([], { fired: { '08:00': '2026-10-06' } }), at(9)), []);
  assert.deepEqual(unnotifiedTimes(med([], { fired: { '08:00': '2026-10-05' } }), at(9)), ['08:00']);
});

test('resolveTakeTime: empty and future times mean now', () => {
  const now = at(14, 20);
  assert.equal(resolveTakeTime('', now), now.getTime());
  assert.equal(resolveTakeTime('09:15', now), at(9, 15).getTime());
  assert.equal(resolveTakeTime('18:00', now), now.getTime());
});

test('dayComplete once dose x times per day is taken', () => {
  assert.equal(dayComplete(med([{ t: at(8).getTime(), q: 4 }]), at(10)), false);
  assert.equal(dayComplete(med([{ t: at(8).getTime(), q: 8 }]), at(10)), true);
});
