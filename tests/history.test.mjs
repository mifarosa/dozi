import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEntries, groupByDay, dayKinds, monthEntries, recentExtras,
  suggestionChips, resolveExtraTime, SUGGESTIONS,
} from '../js/history.js';

const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).getTime();
const meds = [{ id: 'm1', name: 'Vit D', log: [{ t: at(5, 8), q: 4 }, { t: at(6, 9), q: 2 }] }];
const extras = [
  { id: 'x1', name: 'Papatya çayı', kind: 'tea', t: at(6, 21) },
  { id: 'x2', name: 'C vitamini', kind: 'supplement', t: at(6, 8) },
  { id: 'x3', name: 'papatya çayı', kind: 'tea', t: at(2, 8) },
  { id: 'x4', name: 'Bilinmeyen', kind: 'nope', t: at(1, 8) },
];

test('buildEntries merges medicines and extras, newest first', () => {
  const e = buildEntries(meds, extras);
  assert.deepEqual(e.map((x) => x.name), ['Papatya çayı', 'Vit D', 'C vitamini', 'Vit D', 'papatya çayı', 'Bilinmeyen']);
  assert.deepEqual(e.filter((x) => x.name === 'Vit D').map((x) => x.detail), ['½ hap', '1 hap']);
  assert.equal(e.find((x) => x.name === 'Bilinmeyen').kind, 'other');
});

test('dayKinds lists each kind once, in a stable order', () => {
  const byDay = groupByDay(buildEntries(meds, extras));
  assert.deepEqual(dayKinds(byDay.get('2026-10-06')), ['med', 'supplement', 'tea']);
});

test('monthEntries filters by month', () => {
  const e = buildEntries(meds, extras);
  assert.equal(monthEntries(e, 2026, 9).length, 6);
  assert.equal(monthEntries(e, 2026, 8).length, 0);
});

test('recentExtras: unique by name, newest first', () => {
  assert.deepEqual(recentExtras(extras).map((r) => r.name), ['Papatya çayı', 'C vitamini', 'Bilinmeyen']);
  assert.equal(recentExtras(extras, 1).length, 1);
});

test('suggestionChips puts recent entries first and fills with examples', () => {
  const chips = suggestionChips(extras);
  assert.deepEqual(chips.slice(0, 3).map((c) => c.name), ['Papatya çayı', 'C vitamini', 'Bilinmeyen']);
  assert.equal(chips.length, 10);
  assert.equal(new Set(chips.map((c) => c.name.toLowerCase())).size, chips.length);
  assert.deepEqual(suggestionChips([]).map((c) => c.name), SUGGESTIONS.map((s) => s.name));
});

test('resolveExtraTime combines date and time; the future means now', () => {
  const now = new Date(2026, 9, 7, 12);
  assert.equal(resolveExtraTime('2026-10-06', '08:30', now), at(6, 8, 30));
  assert.equal(resolveExtraTime('2026-10-07', '18:00', now), now.getTime());
  assert.equal(resolveExtraTime('', '', now), now.getTime());
});
