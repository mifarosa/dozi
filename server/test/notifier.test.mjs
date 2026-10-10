import '../src/tz.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotifier } from '../src/notifier.js';

const ist = (iso) => new Date(`${iso}+03:00`).getTime();
const med = (over = {}) => ({
  id: 'm1', name: 'Vitamin D', blisters: 1, perBlister: 10, dose: 4, perDay: 1, startQ: 0,
  times: ['08:00'], fired: {}, log: [], ...over,
});

// A notifier wired to fakes. `net` records what would have been pushed.
function setup({ fail = {}, nowIso = '2026-10-07T08:00:20' } = {}) {
  const net = { pushed: [], removed: [], saves: 0 };
  let nowMs = ist(nowIso);
  let store = {};
  const notifier = createNotifier({
    send: async (sub, payload) => {
      if (fail[sub.id]) throw Object.assign(new Error('boom'), { statusCode: fail[sub.id] });
      net.pushed.push({ to: sub.id, ...payload });
    },
    removeSub: async (id) => { net.removed.push(id); },
    loadSent: () => store,
    saveSent: (o) => { store = { ...o }; net.saves += 1; },
    now: () => nowMs,
  });
  notifier.setUser('u1', { meds: [med()] });
  notifier.setSub('s1', { uid: 'u1', tz: 'Europe/Istanbul', updatedAt: 1 });
  return { notifier, net, setNow: (iso) => { nowMs = ist(iso); }, getStore: () => store };
}

test('sends a due reminder once, not again on the next ticks', async () => {
  const { notifier, net } = setup();
  assert.equal((await notifier.tick()).sent, 1);
  assert.equal((await notifier.tick()).sent, 0);
  assert.equal((await notifier.tick()).sent, 0);
  assert.deepEqual(net.pushed.map((p) => [p.title, p.body, p.tag]), [['Vitamin D zamanı', '1 hap · 08:00', 'dozi-m1-08:00']]);
});

test('a restart does not repeat what was already sent (state is reloaded)', async () => {
  const first = setup();
  await first.notifier.tick();
  const second = createNotifier({
    send: async () => { throw new Error('must not send'); },
    removeSub: async () => {},
    loadSent: () => first.getStore(),
    saveSent: () => {},
    now: () => ist('2026-10-07T08:01:00'),
  });
  second.setUser('u1', { meds: [med()] });
  second.setSub('s1', { uid: 'u1', tz: 'Europe/Istanbul', updatedAt: 1 });
  assert.equal((await second.tick()).sent, 0);
});

test('nothing is sent when the dose was already taken today', async () => {
  const { notifier, net } = setup();
  notifier.setUser('u1', { meds: [med({ log: [{ t: ist('2026-10-07T07:30:00'), q: 4 }] })] });
  assert.equal((await notifier.tick()).sent, 0);
  assert.equal(net.pushed.length, 0);
});

test('a user with no subscription gets nothing, and no one else is affected', async () => {
  const { notifier, net } = setup();
  notifier.setUser('u2', { meds: [med({ id: 'm9', name: 'Other' })] });
  await notifier.tick();
  assert.deepEqual(net.pushed.map((p) => p.title), ['Vitamin D zamanı']);
});

test('reaches every device of the user', async () => {
  const { notifier, net } = setup();
  notifier.setSub('s2', { uid: 'u1', tz: 'Europe/Istanbul', updatedAt: 2 });
  await notifier.tick();
  assert.deepEqual(net.pushed.map((p) => p.to).sort(), ['s1', 's2']);
});

test('a subscription the push service reports gone is removed; the others still work', async () => {
  const { notifier, net } = setup({ fail: { s1: 410 } });
  notifier.setSub('s2', { uid: 'u1', tz: 'Europe/Istanbul', updatedAt: 2 });
  assert.equal((await notifier.tick()).sent, 1);
  assert.deepEqual(net.removed, ['s1']);
  assert.deepEqual(net.pushed.map((p) => p.to), ['s2']);
});

test('a temporary failure is retried on the next tick, then not repeated', async () => {
  const fail = { s1: 503 };
  const { notifier, net } = setup({ fail });
  assert.equal((await notifier.tick()).sent, 0); // nobody accepted it
  delete fail.s1;
  assert.equal((await notifier.tick()).sent, 1);
  assert.equal((await notifier.tick()).sent, 0);
  assert.equal(net.removed.length, 0);
});

test('stops retrying once the reminder is too old', async () => {
  const fail = { s1: 503 };
  const { notifier, setNow } = setup({ fail });
  await notifier.tick();
  delete fail.s1;
  setNow('2026-10-07T08:45:00');
  assert.equal((await notifier.tick()).sent, 0);
});

test('a test request sends one test push, and old requests are ignored', async () => {
  const { notifier, net } = setup({ nowIso: '2026-10-07T12:00:00' });
  notifier.setSub('s1', { uid: 'u1', tz: 'Europe/Istanbul', updatedAt: 1, testAt: ist('2026-10-07T11:59:30') });
  await notifier.tick();
  await notifier.tick();
  assert.deepEqual(net.pushed.map((p) => p.tag), ['dozi-test']);
  // an old request (e.g. found after a restart) is not answered
  notifier.setSub('s1', { uid: 'u1', tz: 'Europe/Istanbul', updatedAt: 1, testAt: ist('2026-10-07T09:00:00') });
  await notifier.tick();
  assert.equal(net.pushed.length, 1);
  // a new request is
  notifier.setSub('s1', { uid: 'u1', tz: 'Europe/Istanbul', updatedAt: 1, testAt: ist('2026-10-07T11:59:59') });
  await notifier.tick();
  assert.equal(net.pushed.length, 2);
});

test('the newest subscription decides the time zone', async () => {
  const { notifier, net } = setup({ nowIso: '2026-10-07T08:00:20' });
  // newest device is in UTC, where it is only 05:00, so nothing is due yet
  notifier.setSub('s2', { uid: 'u1', tz: 'UTC', updatedAt: 99 });
  await notifier.tick();
  assert.equal(net.pushed.length, 0);
});

test('old sent markers are pruned', async () => {
  const { notifier, getStore } = setup({ nowIso: '2026-10-09T08:00:20' });
  notifier.setUser('u1', { meds: [] });
  const stale = { 'u1|m1|08:00|2026-10-01': true };
  Object.assign(getStore(), stale);
  // loadSent returns the live object, so seed and tick
  await notifier.tick();
  assert.equal(Object.keys(getStore()).includes('u1|m1|08:00|2026-10-01'), false);
});
