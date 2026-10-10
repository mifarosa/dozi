import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  minuteOfDay, dayFraction, monthRows, lastDaysRows, hasMarks,
} from '../js/timeline.js';
import { buildEntries } from '../js/history.js';

const at = (m, d, h, mi = 0) => new Date(2026, m, d, h, mi).getTime();
const meds = [{ id: 'a', name: 'Vit D', log: [{ t: at(9, 5, 8, 5), q: 4 }, { t: at(9, 6, 20, 30), q: 4 }, { t: at(9, 6, 8, 0), q: 2 }] }];
const extras = [{ id: 'x', name: 'Papatya çayı', kind: 'tea', t: at(9, 6, 21, 15) }];
const entries = buildEntries(meds, extras);

test('minuteOfDay and dayFraction', () => {
  assert.equal(minuteOfDay(at(9, 6, 8, 5)), 485);
  assert.equal(dayFraction(0), 0);
  assert.equal(dayFraction(720), 0.5);
  assert.equal(dayFraction(1440), 1);
  assert.equal(dayFraction(-5), 0);
  assert.equal(dayFraction(2000), 1);
});

test('a past month lists every day, oldest first', () => {
  const rows = monthRows(entries, 2026, 8, new Date(2026, 9, 7)); // September, viewed in October
  assert.equal(rows.length, 30);
  assert.equal(rows[0].key, '2026-09-01');
  assert.equal(rows[29].key, '2026-09-30');
  assert.equal(hasMarks(rows), false);
});

test('the current month stops at today', () => {
  const rows = monthRows(entries, 2026, 9, new Date(2026, 9, 7, 12));
  assert.equal(rows.length, 7);
  assert.equal(rows[6].key, '2026-10-07');
});

test('marks sit on their day, in time order, with their minute', () => {
  const rows = monthRows(entries, 2026, 9, new Date(2026, 9, 7));
  const day6 = rows.find((r) => r.key === '2026-10-06');
  assert.deepEqual(day6.items.map((i) => [i.minutes, i.kind, i.name]), [
    [480, 'med', 'Vit D'], [1230, 'med', 'Vit D'], [1275, 'tea', 'Papatya çayı'],
  ]);
  assert.equal(hasMarks(rows), true);
});

test('lastDaysRows ends today and carries the planned times in minutes', () => {
  const rows = lastDaysRows(entries, 14, new Date(2026, 9, 7, 9), ['08:00', '20:00']);
  assert.equal(rows.length, 14);
  assert.equal(rows[13].key, '2026-10-07');
  assert.equal(rows[0].key, '2026-09-24');
  assert.deepEqual(rows[0].planned, [480, 1200]);
});

test('a month with no entries has no marks', () => {
  assert.equal(hasMarks(monthRows([], 2026, 9, new Date(2026, 9, 7))), false);
});

import { assignLanes } from '../js/timeline.js';

test('assignLanes keeps marks that would touch in separate lanes', () => {
  const at = (...minutes) => minutes.map((m, i) => ({ minutes: m, name: `n${i}` }));
  // three things at 08:10, 08:10 and 08:12, then one in the evening
  const { items, lanes } = assignLanes(at(490, 490, 492, 1260), 80);
  assert.equal(lanes, 3);
  assert.deepEqual(items.map((i) => i.lane), [0, 1, 2, 0]); // the evening one reuses lane 0
});

test('assignLanes: marks far enough apart share one lane', () => {
  const { items, lanes } = assignLanes([{ minutes: 480 }, { minutes: 1200 }], 80);
  assert.equal(lanes, 1);
  assert.deepEqual(items.map((i) => i.lane), [0, 0]);
});

test('assignLanes: a mark reuses the first lane that has room, not just the last one', () => {
  // 08:00 (lane 0), 08:30 (lane 1), 09:45 is 105 min after 08:00 so it goes back to lane 0
  const { items } = assignLanes([{ minutes: 480 }, { minutes: 510 }, { minutes: 585 }], 80);
  assert.deepEqual(items.map((i) => i.lane), [0, 1, 0]);
});

test('assignLanes with no marks still has one lane', () => {
  assert.deepEqual(assignLanes([], 80), { items: [], lanes: 1 });
});
