import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consumedQ, remainingQ, normalizeMed } from '../js/store.js';
import {
  boxEndedAt, newBoxPrompt, endedLabel, startNewBox, backfillEntry,
} from '../js/boxes.js';

const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).getTime();
// 1 blister x 4 pills = 16 quarters; one pill (4 quarters) a day
const med = (over = {}) => normalizeMed({
  id: 'm', name: 'V', blisters: 1, perBlister: 4, dose: 4, perDay: 1, startQ: 0, ...over,
});
const day = (d) => ({ t: at(d, 8), q: 4 });
const emptied = (lastDay = 4) => med({ log: [1, 2, 3, 4].filter((d) => d <= lastDay).map(day) });

test('only intakes since the current box was opened use up its pills', () => {
  const m = med({ log: [day(1), day(2)], boxStart: at(2, 0) });
  assert.equal(consumedQ(m), 4); // day 1 belongs to the previous box
  assert.equal(consumedQ(med({ log: [day(1), day(2)] })), 8); // boxStart 0 = first box
});

test('normalizeMed adds the box fields to older saves', () => {
  const m = normalizeMed({ id: 'a' });
  assert.deepEqual([m.boxStart, m.boxes], [0, []]);
});

test('boxEndedAt is the intake that used the last pill', () => {
  assert.equal(boxEndedAt(emptied()), at(4, 8));
  assert.equal(boxEndedAt(emptied(3)), null); // pills left
  // a dose logged out of order still ends the box at the right moment
  const shuffled = med({ log: [day(3), day(1), day(4), day(2)] });
  assert.equal(boxEndedAt(shuffled), at(4, 8));
});

test('boxEndedAt only looks at the current box', () => {
  const m = med({ log: [1, 2, 3, 4, 5, 6, 7, 8].map(day), boxStart: at(5, 0) });
  assert.equal(remainingQ(m), 0);
  assert.equal(boxEndedAt(m), at(8, 8));
});

test('asks about a new box when it ran out on an earlier day, not before or on the day', () => {
  const m = emptied(4); // ran out on the 4th
  assert.deepEqual(newBoxPrompt(m, new Date(2026, 9, 5, 9)), { daysAgo: 1 });
  assert.deepEqual(newBoxPrompt(m, new Date(2026, 9, 7, 9)), { daysAgo: 3 });
  assert.equal(newBoxPrompt(m, new Date(2026, 9, 4, 20)), null); // ran out today: do not nag
  assert.equal(newBoxPrompt(emptied(3), new Date(2026, 9, 5)), null); // still has pills
});

test('"later" silences the question for the rest of that day only', () => {
  const m = { ...emptied(4), askedBox: '2026-10-05' };
  assert.equal(newBoxPrompt(m, new Date(2026, 9, 5, 18)), null);
  assert.deepEqual(newBoxPrompt(m, new Date(2026, 9, 6, 9)), { daysAgo: 2 });
});

test('a box emptied by editing the position still prompts', () => {
  const m = med({ startQ: 16 });
  assert.equal(boxEndedAt(m), null);
  assert.deepEqual(newBoxPrompt(m, new Date(2026, 9, 5)), { daysAgo: 1 });
});

test('endedLabel', () => {
  assert.equal(endedLabel(1), 'dün bitti');
  assert.equal(endedLabel(3), '3 gün önce bitti');
});

test('the new box starts right after the last pill, so today\'s dose lands in it', () => {
  const m = emptied(4);
  const now = at(5, 15);
  const fields = startNewBox(m, { blisters: 2, perBlister: 14, firstDoseAt: at(5, 9), now });
  assert.equal(fields.boxStart, at(4, 8) + 1);
  const next = { ...m, ...fields, log: [...m.log, { t: at(5, 9), q: 4 }] };
  assert.equal(remainingQ(next), 2 * 14 * 4 - 4);
  assert.deepEqual([next.blisters, next.perBlister, next.startQ], [2, 14, 0]);
  assert.deepEqual(fields.boxes, [{ from: at(1, 8), to: at(4, 8), blisters: 1, perBlister: 4 }]);
  // the old doses are still in the history
  assert.equal(next.log.length, 5);
});

test('switching in the middle of a box starts now and drops the leftovers', () => {
  const m = emptied(2); // 8 quarters left
  const now = at(5, 15);
  const fields = startNewBox(m, { blisters: 1, perBlister: 4, now });
  assert.equal(fields.boxStart, now);
  assert.equal(remainingQ({ ...m, ...fields }), 16);
});

test('a first dose earlier than the start moves the start back to it', () => {
  const m = med({ log: [day(1)] }); // 12 left, not finished
  const fields = startNewBox(m, { blisters: 1, perBlister: 4, firstDoseAt: at(5, 7), now: at(5, 15) });
  assert.equal(fields.boxStart, at(5, 7));
});

test('backfillEntry resolves the time and is limited by the pills left', () => {
  const now = new Date(2026, 9, 7, 12);
  const m = med({ log: [day(1)] }); // 12 left
  assert.deepEqual(backfillEntry(m, { date: '2026-10-06', time: '08:30', q: 4, now }), { t: at(6, 8, 30), q: 4 });
  assert.deepEqual(backfillEntry(m, { date: '2026-10-06', time: '08:30', q: 16, now }), { t: at(6, 8, 30), q: 12 });
  assert.equal(backfillEntry(emptied(), { date: '2026-10-06', time: '08:30', q: 4, now }), null);
});

test('a forgotten dose from before the current box is not limited by it', () => {
  const now = new Date(2026, 9, 7, 12);
  const finished = { ...emptied(), boxStart: at(5, 0) }; // new box already opened, nothing logged in it yet
  const m = med({ log: [], boxStart: at(5, 0) });
  assert.equal(backfillEntry(m, { date: '2026-10-03', time: '08:00', q: 4, now }).q, 4);
  assert.equal(remainingQ(finished) > 0, true);
});
