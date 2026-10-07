import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPills, startQuarters, totalQ, consumedQ, remainingQ, cellQuarters,
  takenTodayQ, daysLeft, normalizeMed,
} from '../js/store.js';

const med = (over = {}) => ({
  blisters: 2, perBlister: 14, dose: 4, perDay: 1, startQ: 0, log: [], ...over,
});
const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).getTime();

test('formatPills writes whole and fractional pills', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 6, 9].map(formatPills), ['0', '¼', '½', '¾', '1', '1½', '2¼']);
});

test('startQuarters turns "where I left off" into consumed quarters', () => {
  assert.equal(startQuarters(1, 1, 0, 14), 0); // fresh first pill
  assert.equal(startQuarters(1, 3, 2, 14), 10); // 2 whole pills + half of the third used
  assert.equal(startQuarters(2, 1, 0, 14), 56); // second blister, untouched
});

test('totals, consumption and remaining', () => {
  const m = med({ startQ: 10, log: [{ t: 1, q: 4 }, { t: 2, q: 2 }] });
  assert.equal(totalQ(m), 112);
  assert.equal(consumedQ(m), 16);
  assert.equal(remainingQ(m), 96);
});

test('consumption never exceeds the box', () => {
  const m = med({ startQ: 110, log: [{ t: 1, q: 8 }] });
  assert.equal(consumedQ(m), 112);
  assert.equal(remainingQ(m), 0);
});

test('cellQuarters shows a partly used pill', () => {
  const m = med({ startQ: 10 }); // pills 0 and 1 gone, pill 2 half used
  assert.deepEqual([0, 1, 2, 3].map((i) => cellQuarters(m, i)), [4, 4, 2, 0]);
});

test('takenTodayQ counts only today', () => {
  const now = new Date(2026, 9, 7, 12);
  const m = med({ log: [{ t: at(6, 23, 59), q: 4 }, { t: at(7, 0, 0), q: 2 }, { t: at(7, 8), q: 1 }] });
  assert.equal(takenTodayQ(m, now), 3);
});

test('daysLeft divides what is left by the daily amount', () => {
  assert.equal(daysLeft(med({ startQ: 0 })), 28);
  assert.equal(daysLeft(med({ dose: 2, perDay: 2, startQ: 0 })), 28);
  assert.equal(daysLeft(med({ dose: 0 })), 0);
});

test('normalizeMed fills fields older saves lack', () => {
  const m = normalizeMed({ id: 'a', name: 'X' });
  assert.deepEqual([m.times, m.fired, m.log], [[], {}, []]);
  assert.deepEqual(normalizeMed({ id: 'a', times: ['08:00'] }).times, ['08:00']);
});
