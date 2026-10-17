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

// ---- several people on one server ----

// Two people whose medicines even share the same id and the same reminder time.
function twoPeople() {
  const net = [];
  let nowMs = 0;
  let store = {};
  const notifier = createNotifier({
    send: async (sub, payload) => { net.push({ to: sub.id, ...payload }); },
    removeSub: async () => {},
    loadSent: () => store,
    saveSent: (o) => { store = { ...o }; },
    now: () => nowMs,
  });
  const med = (name, over = {}) => ({
    id: 'm1', name, blisters: 1, perBlister: 10, dose: 4, perDay: 1, startQ: 0, times: ['08:00'], fired: {}, log: [], ...over,
  });
  // Ayşe is in Istanbul with two phones; Kenji is in Tokyo with one. Both have a medicine "m1" at 08:00.
  notifier.setUser('ayse', { meds: [med('Vitamin D')] });
  notifier.setSub('ayse-iphone', { uid: 'ayse', tz: 'Europe/Istanbul', updatedAt: 1 });
  notifier.setSub('ayse-tablet', { uid: 'ayse', tz: 'Europe/Istanbul', updatedAt: 2 });
  notifier.setUser('kenji', { meds: [med('Metformin')] });
  notifier.setSub('kenji-phone', { uid: 'kenji', tz: 'Asia/Tokyo', updatedAt: 1 });
  // A person with a phone but no data yet, and one with data but no phone.
  notifier.setSub('ghost-phone', { uid: 'ghost', tz: 'Europe/Istanbul', updatedAt: 1 });
  notifier.setUser('nophone', { meds: [med('Nobody sees this')] });
  return { notifier, net, setNow: (iso) => { nowMs = new Date(iso).getTime(); }, med };
}

test('each person is reminded about their own medicine, on their own devices, at their own 08:00', async () => {
  const { notifier, net, setNow } = twoPeople();

  setNow('2026-10-07T08:00:20+03:00'); // 08:00 in Istanbul, 14:00 in Tokyo
  assert.equal((await notifier.tick()).sent, 1);
  assert.deepEqual(net.map((p) => [p.to, p.title]).sort(), [['ayse-iphone', 'Vitamin D zamanı'], ['ayse-tablet', 'Vitamin D zamanı']]);

  net.length = 0;
  setNow('2026-10-07T08:00:20+09:00'); // 08:00 in Tokyo, 02:00 in Istanbul
  assert.equal((await notifier.tick()).sent, 1);
  assert.deepEqual(net.map((p) => [p.to, p.title]), [['kenji-phone', 'Metformin zamanı']]);
});

test('the same medicine id and time for two people never merge into one "already sent"', async () => {
  const { notifier, net, setNow } = twoPeople();
  // 08:00 in both zones is 5 hours apart, so send both in turn and check neither blocks the other.
  setNow('2026-10-07T08:00:20+03:00'); await notifier.tick();
  setNow('2026-10-07T08:00:20+09:00'); await notifier.tick();
  assert.equal(net.filter((p) => p.title === 'Metformin zamanı').length, 1);
  assert.equal(net.filter((p) => p.title === 'Vitamin D zamanı').length, 2); // both of Ayşe's phones
});

test('one person taking their dose does not silence anybody else', async () => {
  const { notifier, net, setNow, med } = twoPeople();
  notifier.setUser('ayse', { meds: [med('Vitamin D', { log: [{ t: new Date('2026-10-07T07:30:00+03:00').getTime(), q: 4 }] })] });
  setNow('2026-10-07T08:00:20+09:00');
  await notifier.tick();
  assert.deepEqual(net.map((p) => p.to), ['kenji-phone']);
});

test('people without a phone or without data are skipped quietly', async () => {
  const { notifier, net, setNow } = twoPeople();
  setNow('2026-10-07T08:00:20+03:00');
  await notifier.tick();
  assert.equal(net.some((p) => /Nobody sees this/.test(p.title)), false);
  assert.equal(net.some((p) => p.to === 'ghost-phone'), false);
});

test('a test request goes to the device that asked, and only that one', async () => {
  const { notifier, net, setNow } = twoPeople();
  setNow('2026-10-07T12:00:00+03:00');
  notifier.setSub('ayse-tablet', { uid: 'ayse', tz: 'Europe/Istanbul', updatedAt: 2, testAt: new Date('2026-10-07T11:59:50+03:00').getTime() });
  await notifier.tick();
  assert.deepEqual(net.map((p) => [p.to, p.tag]), [['ayse-tablet', 'dozi-test']]);
});

test('signing out (device removed) stops that phone only; the person\'s other phone keeps working', async () => {
  const { notifier, net, setNow } = twoPeople();
  notifier.setSub('ayse-iphone', null);
  setNow('2026-10-07T08:00:20+03:00');
  await notifier.tick();
  assert.deepEqual(net.map((p) => p.to), ['ayse-tablet']);
});

test('each device gets the reminder and the test message in its own language', async () => {
  const { notifier, net, setNow } = setup();
  notifier.setSub('s1', { uid: 'u1', tz: 'Europe/Istanbul', updatedAt: 1 }); // no language: Turkish
  notifier.setSub('s2', { uid: 'u1', tz: 'Europe/Istanbul', updatedAt: 1, lang: 'en' });
  await notifier.tick();
  const byDevice = Object.fromEntries(net.pushed.map((p) => [p.to, [p.title, p.body]]));
  assert.deepEqual(byDevice.s1, ['Vitamin D zamanı', '1 hap · 08:00']);
  assert.deepEqual(byDevice.s2, ['Time for Vitamin D', '1 pill · 08:00']);

  net.pushed.length = 0;
  notifier.setSub('s2', { uid: 'u1', tz: 'Europe/Istanbul', updatedAt: 1, lang: 'en', testAt: ist('2026-10-07T08:00:19') });
  setNow('2026-10-07T08:00:25');
  await notifier.tick();
  assert.equal(net.pushed.length, 1);
  assert.equal(net.pushed[0].body, 'Notifications are working ✓');
});
