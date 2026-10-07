import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pad2, hhmm, dayKey, startOfDay, addDays, startOfWeek,
} from '../js/dates.js';

test('pad2 and the key formats', () => {
  assert.equal(pad2(7), '07');
  assert.equal(hhmm(new Date(2026, 9, 7, 8, 5)), '08:05');
  assert.equal(dayKey(new Date(2026, 0, 3)), '2026-01-03');
});

test('startOfDay drops the time', () => {
  const d = startOfDay(new Date(2026, 9, 7, 23, 59, 59));
  assert.deepEqual([d.getHours(), d.getMinutes(), d.getSeconds()], [0, 0, 0]);
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(dayKey(addDays(new Date(2026, 9, 31), 1)), '2026-11-01');
  assert.equal(dayKey(addDays(new Date(2026, 0, 1), -1)), '2025-12-31');
});

test('weeks start on Monday', () => {
  assert.equal(startOfWeek(new Date(2026, 9, 7)).getDate(), 5); // Wednesday -> Monday
  assert.equal(startOfWeek(new Date(2026, 9, 5)).getDate(), 5); // Monday stays
  assert.equal(startOfWeek(new Date(2026, 9, 11)).getDate(), 5); // Sunday -> Monday before
});
