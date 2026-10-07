import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideSync, mergeMeds, mergeExtras } from '../js/sync.js';

const remote = (meds, updatedAt, extras) => ({ meds: Array(meds).fill({}), extras, updatedAt });
const decide = (over) => decideSync({ localUpdated: 3, localSynced: false, localCount: 1, remote: remote(2, 9), ...over });

test('nothing in the cloud yet', () => {
  assert.equal(decide({ remote: null, localCount: 0 }), 'none');
  assert.equal(decide({ remote: null }), 'push');
});

test('first meeting of a device and an account', () => {
  assert.equal(decide({ localCount: 0 }), 'pull'); // new empty device
  assert.equal(decide({ remote: remote(0, 9) }), 'push'); // empty cloud
  assert.equal(decide({}), 'merge'); // both have data
  assert.equal(decide({ remote: remote(0, 9, [{ id: 'a' }]) }), 'merge'); // cloud has only extras
});

test('once synced, the newer side wins', () => {
  assert.equal(decide({ localSynced: true }), 'pull');
  assert.equal(decide({ localSynced: true, localUpdated: 10 }), 'push');
  assert.equal(decide({ localSynced: true, localUpdated: 9 }), 'none');
});

test('mergeMeds keeps both sides and the busier copy of a shared medicine', () => {
  const local = [{ id: 'a', log: [1, 2] }, { id: 'b', log: [] }];
  const cloud = [{ id: 'a', log: [1] }, { id: 'c', log: [] }];
  const merged = mergeMeds(local, cloud);
  assert.deepEqual(merged.map((m) => m.id).sort(), ['a', 'b', 'c']);
  assert.equal(merged.find((m) => m.id === 'a').log.length, 2);
});

test('mergeExtras unions by id and the cloud copy wins', () => {
  const merged = mergeExtras([{ id: 'a', name: 'L' }, { id: 'b', name: 'L2' }], [{ id: 'a', name: 'R' }]);
  assert.deepEqual(merged.map((x) => x.name).sort(), ['L2', 'R']);
});
