import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runOutDate, runOuts, runOutsByDay, daysUntil,
} from '../js/runout.js';
import { dayKey } from '../js/dates.js';

const now = new Date(2026, 9, 20, 10, 0); // 20 Oct 2026, 10:00
const at = (d, h = 8) => new Date(2026, 9, d, h, 0).getTime();
// 28 pills, one a day: 112 quarters.
const med = (over = {}) => ({
  id: 'a', name: 'Vitamin D', blisters: 2, perBlister: 14, startQ: 0, dose: 4, perDay: 1, log: [], ...over,
});
const key = (m, when = now) => dayKey(runOutDate(m, when));

test('with today\'s dose still to take, the last pill is on day N-1', () => {
  assert.equal(key(med()), '2026-11-16'); // 28 doses: 20 Oct + 27 days
});

test('once today\'s dose is taken, the pills left start tomorrow', () => {
  const taken = med({ log: [{ t: at(20), q: 4 }] }); // 27 pills left, today covered
  assert.equal(key(taken), '2026-11-16'); // tomorrow + 26 days: the same last day
});

test('a part-used pill and bigger or repeated doses', () => {
  assert.equal(key(med({ startQ: 2 })), '2026-11-16'); // 27.5 pills left: still the 28th day
  assert.equal(key(med({ perDay: 2 })), '2026-11-02'); // 14 days of 2: 20 Oct + 13 days
  assert.equal(key(med({ dose: 2 })), '2026-12-14'); // half pills: 56 days, 20 Oct + 55
});

test('it runs out today when only today\'s dose is left, and not at all when empty', () => {
  const lastOne = med({ startQ: 108 }); // 4 quarters left
  assert.equal(key(lastOne), '2026-10-20');
  assert.equal(runOutDate(med({ startQ: 112 }), now), null);
  assert.equal(runOutDate(med({ dose: 0 }), now), null);
});

test('only intakes since the current box count', () => {
  const second = med({ boxStart: at(10), log: [{ t: at(5), q: 100 }, { t: at(12), q: 8 }] });
  assert.equal(key(second), '2026-11-14'); // 26 pills left
});

test('runOuts is sorted soonest first and skips empty boxes', () => {
  const list = runOuts([med({ id: 'b', name: 'B', startQ: 100 }), med({ id: 'c', name: 'C', startQ: 112 }), med()], now);
  assert.deepEqual(list.map((r) => r.med.name), ['B', 'Vitamin D']);
});

test('runOutsByDay groups medicines that end the same day', () => {
  const map = runOutsByDay([med({ name: 'A' }), med({ id: 'b', name: 'B' }), med({ id: 'c', name: 'C', startQ: 100 })], now);
  assert.deepEqual(map.get('2026-11-16'), ['A', 'B']);
  assert.equal(map.size, 2);
});

test('daysUntil counts calendar days, not 24 hour blocks', () => {
  assert.equal(daysUntil(new Date(2026, 9, 20, 23, 59), now), 0);
  assert.equal(daysUntil(new Date(2026, 9, 21, 0, 1), now), 1);
  assert.equal(daysUntil(new Date(2026, 10, 16), now), 27);
});
