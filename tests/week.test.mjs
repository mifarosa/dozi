import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKey } from '../js/dates.js';
import {
  resolveWeek, weekLabel, storedWeek, shiftWeek, monthOfWeek, entriesInWeek, inWeek,
} from '../js/week.js';
import { weekRows } from '../js/timeline.js';

const d = (m, day, h = 12) => new Date(2026, m, day, h);
const WED = d(9, 7); // Wednesday 7 October 2026

test('a null week means this week, starting on Monday', () => {
  const w = resolveWeek(null, WED);
  assert.equal(dayKey(w.start), '2026-10-05');
  assert.equal(dayKey(w.end), '2026-10-11');
  assert.equal(w.isCurrent, true);
});

test('any day of a past week resolves to that week\'s Monday', () => {
  const w = resolveWeek(d(8, 30), WED); // Wednesday 30 September
  assert.equal(dayKey(w.start), '2026-09-28');
  assert.equal(w.isCurrent, false);
  assert.equal(resolveWeek(d(9, 11), WED).isCurrent, true); // Sunday belongs to the Monday before
});

test('weekLabel handles one month, two months and the year end', () => {
  assert.equal(weekLabel(d(9, 5)), '5–11 Ekim');
  assert.equal(weekLabel(d(8, 28)), '28 Eylül – 4 Ekim');
  assert.equal(weekLabel(d(11, 28)), '28 Aralık – 3 Ocak');
});

test('storedWeek is null for this week so it keeps meaning "this week"', () => {
  assert.equal(storedWeek(d(9, 6), WED), null);
  assert.equal(dayKey(storedWeek(d(9, 1), WED)), '2026-09-28');
});

test('shiftWeek goes back freely and never into the future', () => {
  assert.equal(dayKey(shiftWeek(null, -1, WED)), '2026-09-28');
  assert.equal(dayKey(shiftWeek(d(8, 28), -1, WED)), '2026-09-21');
  assert.equal(shiftWeek(null, +1, WED), undefined);
  assert.equal(shiftWeek(d(8, 28), +1, WED), null); // forward from last week is this week again
});

test('monthOfWeek picks the month that holds most of the week', () => {
  assert.equal(monthOfWeek(d(8, 28)).getMonth(), 9); // 28 Sep - 4 Oct: Thursday is 1 Oct
  assert.equal(monthOfWeek(d(8, 21)).getMonth(), 8);
  assert.equal(monthOfWeek(d(9, 26)).getMonth(), 9); // 26 Oct - 1 Nov: Thursday is 29 Oct
});

test('entriesInWeek and inWeek use Monday 00:00 to the next Monday', () => {
  const start = d(9, 5, 0);
  const at = (day, h, m = 0) => new Date(2026, 9, day, h, m).getTime();
  const entries = [{ t: at(4, 23, 59) }, { t: at(5, 0, 0) }, { t: at(11, 23, 59) }, { t: at(12, 0, 0) }];
  assert.equal(entriesInWeek(entries, start).length, 2);
  assert.equal(inWeek(d(9, 11, 23), start), true);
  assert.equal(inWeek(d(9, 12, 0), start), false);
});

test('weekRows: this week stops at today, a past week has all seven days', () => {
  const now = d(9, 7);
  const current = weekRows([], resolveWeek(null, now).start, now);
  assert.deepEqual(current.map((r) => r.key), ['2026-10-05', '2026-10-06', '2026-10-07']);
  const past = weekRows([], d(8, 28, 0), now);
  assert.equal(past.length, 7);
  assert.equal(past[0].key, '2026-09-28');
  assert.equal(past[6].key, '2026-10-04');
});

test('weekRows carries the entries of each day', () => {
  const t = new Date(2026, 9, 6, 8, 5).getTime();
  const rows = weekRows([{ t, key: '2026-10-06', kind: 'med', name: 'V', detail: '1 hap' }], d(9, 5, 0), WED);
  assert.deepEqual(rows.map((r) => r.items.length), [0, 1, 0]);
  assert.equal(rows[1].items[0].minutes, 485);
});
