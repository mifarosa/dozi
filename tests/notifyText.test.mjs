import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupReminders, groupMessage } from '../js/notifyText.js';

const item = (name, time, over = {}) => ({
  medId: `id-${name}`, name, dose: 4, time, repeat: 0, ...over,
});

test('reminders at the same time become one group, groups are in time order, names sorted', () => {
  const groups = groupReminders([
    item('Magnezyum', '20:00'), item('Vitamin D', '08:00'), item('Omega', '08:00'), item('Demir', '08:00', { repeat: 1 }),
  ]);
  assert.deepEqual(groups.map((g) => [g.time, g.repeat, g.items.map((i) => i.name)]), [
    ['08:00', 0, ['Omega', 'Vitamin D']],
    ['08:00', 1, ['Demir']],
    ['20:00', 0, ['Magnezyum']],
  ]);
  assert.deepEqual(groupReminders([]), []);
});

test('one medicine keeps the familiar notification', () => {
  const [group] = groupReminders([item('Vitamin D', '08:00')]);
  assert.deepEqual(groupMessage('tr', group), { title: 'Vitamin D zamanı', body: '1 hap · 08:00', tag: 'dozi-id-Vitamin D-08:00' });
  const [again] = groupReminders([item('Vitamin D', '08:00', { repeat: 2 })]);
  assert.equal(groupMessage('tr', again).body, 'Hâlâ alınmadı: 1 hap · 08:00');
  assert.equal(groupMessage('en', again).body, 'Not taken yet: 1 pill · 08:00');
});

test('several medicines at one time make one notification with a count and one line each', () => {
  const [group] = groupReminders([item('Vitamin D', '08:00'), item('Magnezyum', '08:00', { dose: 6 }), item('Omega', '08:00', { dose: 2 })]);
  const tr = groupMessage('tr', group), en = groupMessage('en', group);
  assert.equal(tr.title, '3 ilaç zamanı');
  assert.equal(tr.body, 'Magnezyum · 1½ hap\nOmega · ½ hap\nVitamin D · 1 hap');
  assert.equal(tr.tag, 'dozi-group-08:00');
  assert.equal(en.title, 'Time for 3 medicines');
  assert.equal(en.body, 'Magnezyum · 1½ pills\nOmega · ½ pill\nVitamin D · 1 pill');
});

test('hourly repeats of several medicines say so in the title', () => {
  const [group] = groupReminders([item('A', '08:00', { repeat: 1 }), item('B', '08:00', { repeat: 1 })]);
  assert.equal(groupMessage('tr', group).title, '2 ilaç hâlâ alınmadı');
  assert.equal(groupMessage('en', group).title, '2 medicines not taken yet');
});

test('a long list is cut after six lines and says how many more there are', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const [group] = groupReminders(names.map((n) => item(n, '08:00')));
  const { title, body } = groupMessage('tr', group);
  assert.equal(title, '8 ilaç zamanı');
  const lines = body.split('\n');
  assert.equal(lines.length, 7);
  assert.equal(lines[5], 'F · 1 hap');
  assert.equal(lines[6], '+2 ilaç daha');
  assert.equal(groupMessage('en', group).body.split('\n')[6], '+2 more');
});
