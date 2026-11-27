import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learnedAsk } from '../js/learned.js';

// 2026-10-07 is "today"; day(-1) is yesterday.
const at = (dayOffset, h, m = 0) => new Date(2026, 9, 7 + dayOffset, h, m);
const take = (dayOffset, h, m = 0, q = 4) => ({ t: at(dayOffset, h, m).getTime(), q });
const med = (log, over = {}) => ({
  id: 'm', name: 'Vitamin D', dose: 4, perDay: 1, blisters: 1, perBlister: 10, startQ: 0, times: [], fired: {}, log, ...over,
});

test('taken on each of the last two days: asked on the third, at the earlier first intake', () => {
  const m = med([take(-2, 9, 30), take(-1, 8, 10)]);
  assert.equal(learnedAsk(m, at(0, 8, 9)), null, 'not before that time');
  assert.deepEqual(learnedAsk(m, at(0, 8, 10)), { time: '08:10' });
  assert.deepEqual(learnedAsk(m, at(0, 15, 0)), { time: '08:10' }, 'still the same question later in the day');
});

test('the days do not need the same hour', () => {
  assert.deepEqual(learnedAsk(med([take(-2, 21, 0), take(-1, 11, 40)]), at(0, 12, 0)), { time: '11:40' });
});

test('only one of the last two days, or an older streak, asks nothing', () => {
  assert.equal(learnedAsk(med([take(-1, 9)]), at(0, 12)), null);
  assert.equal(learnedAsk(med([take(-3, 9), take(-2, 9)]), at(0, 12)), null, 'yesterday was missed');
  assert.equal(learnedAsk(med([take(-3, 9), take(-1, 9)]), at(0, 12)), null, 'the day before yesterday was missed');
  assert.equal(learnedAsk(med([]), at(0, 12)), null);
});

test('already taken today: nothing is asked, also when it was before the ask time', () => {
  const m = med([take(-2, 9), take(-1, 9), take(0, 7, 30)]);
  assert.equal(learnedAsk(m, at(0, 12)), null);
});

test('"not today" silences the question for that day only', () => {
  const m = med([take(-2, 9), take(-1, 9)], { learnNo: '2026-10-07' });
  assert.equal(learnedAsk(m, at(0, 12)), null);
  // tomorrow: yesterday (today) had no intake, so the streak is broken by itself
  assert.equal(learnedAsk({ ...m, learnNo: '2026-10-07' }, at(1, 12)), null);
});

test('the ask time stays between 08:00 and 22:00', () => {
  assert.deepEqual(learnedAsk(med([take(-2, 2, 30), take(-1, 3, 0)]), at(0, 8, 0)), { time: '08:00' });
  assert.equal(learnedAsk(med([take(-2, 2, 30), take(-1, 3, 0)]), at(0, 7, 59)), null);
  assert.deepEqual(learnedAsk(med([take(-2, 23, 30), take(-1, 23, 50)]), at(0, 22, 0)), { time: '22:00' });
});

test('a reminder time close to the ask time already does the asking', () => {
  assert.equal(learnedAsk(med([take(-2, 8, 5), take(-1, 8, 10)], { times: ['08:00'] }), at(0, 9)), null);
  assert.deepEqual(learnedAsk(med([take(-2, 14, 0), take(-1, 14, 0)], { times: ['08:00'] }), at(0, 15)), { time: '14:00' });
});

test('a shelved medicine or an empty box is never asked about', () => {
  const log = [take(-2, 9), take(-1, 9)];
  assert.equal(learnedAsk(med(log, { shelved: true }), at(0, 12)), null);
  assert.equal(learnedAsk(med(log, { startQ: 40 }), at(0, 12)), null);
});
