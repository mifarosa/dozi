import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Runs sw.js against a fake service worker scope and returns what it registered.
function loadWorker() {
  const handlers = {};
  const shown = [];
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    registration: { showNotification: (title, options) => { shown.push({ title, options }); return Promise.resolve(); } },
    clients: { matchAll: async () => [], openWindow: async () => {}, claim: async () => {} },
    skipWaiting: async () => {},
    location: { origin: 'https://dozi.test' },
  };
  vm.runInNewContext(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), { self, caches: {}, URL, fetch: async () => {} });
  return { handlers, shown };
}

// A push event whose waitUntil collects the promise it was given.
function pushEvent(data) {
  const waits = [];
  return {
    event: {
      data: data === undefined ? null : data,
      waitUntil: (p) => waits.push(p),
    },
    done: () => Promise.all(waits),
  };
}

test('a pushed reminder becomes a notification', async () => {
  const { handlers, shown } = loadWorker();
  const { event, done } = pushEvent({ json: () => ({ title: 'Vitamin D zamanı', body: '1 hap · 08:00', tag: 'dozi-m1-08:00' }) });
  handlers.push(event);
  await done();
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, 'Vitamin D zamanı');
  assert.equal(shown[0].options.body, '1 hap · 08:00');
  assert.equal(shown[0].options.tag, 'dozi-m1-08:00');
  assert.equal(shown[0].options.icon, 'icons/icon-192.png');
});

test('a push is always shown, even without a payload or with a broken one', async () => {
  for (const data of [undefined, { json: () => { throw new Error('not json'); }, text: () => 'plain text' }]) {
    const { handlers, shown } = loadWorker();
    const { event, done } = pushEvent(data);
    handlers.push(event);
    await done();
    assert.equal(shown.length, 1, 'browsers require a notification for every push');
    assert.equal(shown[0].title, 'Dozi');
  }
});

test('the worker still handles install, activate, fetch and notification clicks', () => {
  const { handlers } = loadWorker();
  for (const type of ['install', 'activate', 'fetch', 'notificationclick', 'push']) {
    assert.equal(typeof handlers[type], 'function', `${type} handler`);
  }
});
