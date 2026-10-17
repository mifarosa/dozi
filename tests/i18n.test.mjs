import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import tr from '../js/i18n/tr.js';
import en from '../js/i18n/en.js';
import { translate, pillsText, t } from '../js/i18n.js';
import {
  setLang, getLang, resolveLang, locale,
} from '../js/lang.js';
import { formatTime, dayFmt, monthFmt } from '../js/dates.js';
import { weekLabel } from '../js/week.js';
import { buildEntries, suggestionChips } from '../js/history.js';
import { endedLabel } from '../js/boxes.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

// Run a block in English and always go back to Turkish, which the other tests expect.
function inEnglish(fn) {
  setLang('en');
  try { return fn(); } finally { setLang('tr'); }
}

test('English has exactly the Turkish keys, with the same {placeholders}', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(tr).sort());
  const holes = (v) => (typeof v === 'string' ? (v.match(/\{\w+\}/g) || []).sort().join() : '');
  for (const key of Object.keys(tr)) {
    if (typeof tr[key] === 'string' && typeof en[key] === 'string') {
      assert.equal(holes(en[key]), holes(tr[key]), `placeholders of ${key}`);
    }
  }
  assert.equal(en['days.short'].length, 7);
});

test('no Turkish letters are left in the English messages', () => {
  const turkish = /[çğıöşüÇĞİÖŞÜ]/;
  for (const [key, value] of Object.entries(en)) {
    const text = typeof value === 'function' ? value({ n: 2, d: 2 }) : [].concat(value).join(' ');
    assert.doesNotMatch(text, turkish, key);
  }
});

test('every key the code and the page ask for exists', () => {
  const sources = [
    'index.html', '../js/app.js', '../js/actions.js', '../js/boxes.js', '../js/cloudSync.js',
    '../js/history.js', '../js/notifications.js', '../js/push.js', '../js/pushUi.js',
    '../js/ui/backfillForm.js', '../js/ui/medForm.js', '../js/ui/newBoxForm.js',
    '../js/views/calendar.js', '../js/views/detail.js', '../js/views/list.js',
    '../js/views/pills.js', '../js/views/settings.js', '../js/views/timeChart.js',
  ].map((p) => (p === 'index.html' ? read('../index.html') : read(p.startsWith('..') ? p : `../${p}`))).join('\n');
  const used = new Set();
  for (const m of sources.matchAll(/\bt\('([\w.]+)'/g)) used.add(m[1]);
  for (const m of sources.matchAll(/setStatus\('([\w.]+)'/g)) used.add(m[1]);
  for (const m of sources.matchAll(/data-i18n(?:-placeholder|-aria)?="([\w.]+)"/g)) used.add(m[1]);
  for (const m of sources.matchAll(/t\(status \|\| '([\w.]+)'\)/g)) used.add(m[1]);
  for (const key of used) assert.ok(key in tr, `missing message: ${key}`);
  // Keys built from an id: kind.<id>, theme.<id>, accent.<id>
  for (const id of ['med', 'supplement', 'tea', 'other']) assert.ok(`kind.${id}` in tr);
  for (const id of ['system', 'light', 'dark']) assert.ok(`theme.${id}` in tr);
  for (const id of ['teal', 'blue', 'purple', 'rose', 'orange']) assert.ok(`accent.${id}` in tr);
  assert.ok(used.size > 60, `only ${used.size} keys found, the scan is probably broken`);
});

test('resolveLang: a saved choice wins, "system" follows the phone', () => {
  assert.equal(resolveLang('en', 'tr-TR'), 'en');
  assert.equal(resolveLang('tr', 'en-US'), 'tr');
  assert.equal(resolveLang('system', 'tr-TR'), 'tr');
  assert.equal(resolveLang('system', 'tr'), 'tr');
  assert.equal(resolveLang('system', 'en-GB'), 'en');
  assert.equal(resolveLang('system', 'de-DE'), 'en');
  assert.equal(resolveLang('system', ''), 'en');
  assert.equal(resolveLang('xx', 'tr-TR'), 'tr');
});

test('the default language is Turkish, so nothing changes until the app switches', () => {
  assert.equal(getLang(), 'tr');
  assert.equal(t('nav.settings'), 'Ayarlar');
});

test('amounts, plurals and fallbacks in English', () => {
  assert.equal(pillsText(1, 'en'), '¼ pill');
  assert.equal(pillsText(4, 'en'), '1 pill');
  assert.equal(pillsText(6, 'en'), '1½ pills');
  assert.equal(pillsText(8, 'en'), '2 pills');
  assert.equal(pillsText(0, 'en'), '0 pills');
  assert.equal(pillsText(6, 'tr'), '1½ hap');
  assert.equal(translate('en', 'list.daysLeft', { n: 1 }), '~1 day left');
  assert.equal(translate('en', 'list.daysLeft', { n: 5 }), '~5 days left');
  assert.equal(translate('en', 'no.such.key'), 'no.such.key');
  assert.equal(translate('xx', 'nav.settings'), 'Ayarlar');
});

test('dates, week labels, entry details and box messages follow the language', () => {
  const day = new Date(2026, 9, 5, 14, 5);
  assert.equal(weekLabel(new Date(2026, 9, 5)), '5–11 Ekim');
  inEnglish(() => {
    assert.equal(locale(), 'en-GB');
    assert.equal(weekLabel(new Date(2026, 9, 5)), '5–11 October');
    assert.match(dayFmt.format(day), /Monday/);
    assert.match(monthFmt.format(day), /October 2026/);
    assert.equal(formatTime(day.getTime()), '14:05');
    assert.equal(endedLabel(1), 'ran out yesterday');
    assert.equal(endedLabel(3), 'ran out 3 days ago');
    const entries = buildEntries(
      [{ id: 'a', name: 'X', log: [{ t: 1, q: 6 }] }],
      [{ id: 'e', name: 'Mint', kind: 'tea', t: 2 }],
    );
    assert.deepEqual(entries.map((e) => e.detail).sort(), ['1½ pills', 'Herbal tea']);
    assert.equal(suggestionChips([])[0].name, 'Vitamin C');
  });
  assert.match(dayFmt.format(day), /Pazartesi/);
  assert.equal(suggestionChips([])[0].name, 'C vitamini');
});
