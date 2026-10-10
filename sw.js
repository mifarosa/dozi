// Offline cache for the app shell. Bump CACHE when shipping changes.
const CACHE = 'dozi-v11';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/store.js',
  'js/state.js',
  'js/dates.js',
  'js/html.js',
  'js/notifications.js',
  'js/reminderLoop.js',
  'js/boxes.js',
  'js/timeline.js',
  'js/cloudSync.js',
  'js/push.js',
  'js/pushUi.js',
  'js/push-config.js',
  'js/actions.js',
  'js/views/pills.js',
  'js/views/list.js',
  'js/views/detail.js',
  'js/views/calendar.js',
  'js/views/timeChart.js',
  'js/ui/chooser.js',
  'js/ui/medForm.js',
  'js/ui/extraForm.js',
  'js/ui/backfillForm.js',
  'js/ui/newBoxForm.js',
  'js/reminders.js',
  'js/history.js',
  'js/sync.js',
  'js/cloud.js',
  'js/firebase-config.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first so updates show up when online; fall back to cache offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});

// Tapping a reminder focuses an open Dozi window or opens a new one.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins[0];
      return open ? open.focus() : self.clients.openWindow('./');
    }),
  );
});

// A reminder pushed by the home server. The browser requires every push to show a notification.
self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Dozi', {
      body: data.body || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: data.tag || 'dozi',
    }),
  );
});
