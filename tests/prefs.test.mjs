import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  normalizePrefs, applyPrefs, DEFAULT_PREFS, THEMES, ACCENTS,
} from '../js/prefs.js';

// Minimal stand-in for document.documentElement.
function fakeRoot() {
  const attrs = {};
  return {
    attrs,
    setAttribute: (k, v) => { attrs[k] = v; },
    removeAttribute: (k) => { delete attrs[k]; },
  };
}

test('normalizePrefs keeps valid choices and repairs everything else', () => {
  assert.deepEqual(normalizePrefs({ theme: 'dark', accent: 'rose', lang: 'en', nag: false }), {
    theme: 'dark', accent: 'rose', lang: 'en', nag: false,
  });
  assert.deepEqual(normalizePrefs({ theme: 'neon', accent: 7, lang: 'xx' }), DEFAULT_PREFS);
  assert.deepEqual(normalizePrefs(null), DEFAULT_PREFS);
  assert.deepEqual(normalizePrefs({ theme: 'light' }), { theme: 'light', accent: 'teal', lang: 'system', nag: true });
});

test('applyPrefs sets attributes, and removes them for the defaults', () => {
  const root = fakeRoot();
  applyPrefs({ theme: 'dark', accent: 'blue' }, root);
  assert.deepEqual(root.attrs, { 'data-theme': 'dark', 'data-accent': 'blue' });
  applyPrefs(DEFAULT_PREFS, root);
  assert.deepEqual(root.attrs, {});
});

test('every accent and theme has CSS for both light and dark', () => {
  const css = fs.readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  for (const { id } of ACCENTS.filter((a) => a.id !== DEFAULT_PREFS.accent)) {
    assert.ok(css.includes(`:root[data-accent="${id}"]`), `${id} light`);
    assert.ok(css.includes(`:root[data-theme="dark"][data-accent="${id}"]`), `${id} dark`);
    assert.ok(css.includes(`:root:not([data-theme="light"])[data-accent="${id}"]`), `${id} dark (system)`);
  }
  assert.ok(THEMES.some((t) => t.id === 'system'));
});

test('the pre-paint script in index.html accepts exactly the accents the app offers', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const listed = /\^\(([a-z|]+)\)\$\/\.test\(p\.accent\)/.exec(html)[1].split('|').sort();
  assert.deepEqual(listed, ACCENTS.filter((a) => a.id !== DEFAULT_PREFS.accent).map((a) => a.id).sort());
});
