// Web Push on this device: subscribe, tell the server where to send, unsubscribe, test.
// The server (see ../server) sends the reminders, so they arrive even when Dozi is closed.
import * as cloud from './cloud.js';
import { vapidPublicKey } from './push-config.js';
import { t } from './i18n.js';
import { getLang } from './lang.js';
import { loadPrefs } from './prefs.js';
import { loadPushKeyId, savePushKeyId } from './store.js';

export const pushConfigured = Boolean(vapidPublicKey);

const SW_WAIT_MS = 6000;

export function urlBase64ToUint8Array(b64) {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Stable document id for a subscription: SHA-256 of its endpoint, as hex.
export async function subscriptionDocId(endpoint) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Plain-language text for a failed push action. Raw SDK messages ("Missing or insufficient
// permissions", error codes) mean nothing to the user and look broken, so they stay in the console.
export function friendlyPushError(err) {
  const code = String(err?.code || '');
  if (code.includes('permission-denied')) return t('push.errPermission');
  if (code.includes('unavailable') || err?.name === 'NetworkError' || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return t('push.errNetwork');
  }
  if (err?.name === 'NotAllowedError') return t('push.errNotAllowed');
  return t('push.errOther');
}

// What the notification bar should show. Pure, so every case is testable.
//   hidden | needs-install | unsupported | denied | stale | ready | on
// stale: subscribed, but with another server key, so nothing arrives until it is renewed.
export function pushStatus({
  configured, signedIn, supported, permission, subscribed, stale = false, ios, standalone,
}) {
  if (!configured || !signedIn) return 'hidden';
  if (!supported) return ios && !standalone ? 'needs-install' : 'unsupported';
  if (permission === 'denied') return 'denied';
  if (subscribed && stale) return 'stale';
  return subscribed ? 'on' : 'ready';
}

export function readEnvironment(win = window) {
  const nav = win.navigator;
  const supported = 'serviceWorker' in nav && 'PushManager' in win && 'Notification' in win;
  return {
    supported,
    permission: 'Notification' in win ? win.Notification.permission : 'unsupported',
    ios: /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1),
    standalone: Boolean(win.matchMedia?.('(display-mode: standalone)').matches || nav.standalone),
  };
}

// serviceWorker.ready never settles when no worker is registered, so do not wait forever.
function registration() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('service worker hazır değil')), SW_WAIT_MS)),
  ]);
}

export async function getSubscription() {
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

const currentKeyId = () => vapidPublicKey.slice(0, 12);

// Does a subscription belong to the server key this app carries? A subscription made for another
// key can never receive our pushes (the push service answers VapidPkHashMismatch).
//   'ok' | 'stale' | 'unknown'
// The key the browser reports wins; when it will not say, the key we wrote down at subscribe time
// decides; a device that did neither (subscribed by an older version) cannot be judged.
export function keyState({
  browserKey = null, ourKey = urlBase64ToUint8Array(vapidPublicKey), storedId = null, currentId = currentKeyId(),
}) {
  if (browserKey) {
    const theirs = new Uint8Array(browserKey);
    return ourKey.length === theirs.length && ourKey.every((b, i) => b === theirs[i]) ? 'ok' : 'stale';
  }
  if (storedId) return storedId === currentId ? 'ok' : 'stale';
  return 'unknown';
}

export const subscriptionKeyState = (sub) => keyState({
  browserKey: sub.options?.applicationServerKey, storedId: loadPushKeyId(),
});

// Tells the server about this device (also refreshes its time zone and restores a lost record).
export async function saveSubscription(user, sub) {
  const json = sub.toJSON();
  const id = await subscriptionDocId(json.endpoint);
  await cloud.savePushSub(id, {
    uid: user.uid,
    endpoint: json.endpoint,
    keys: json.keys,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang: getLang(), // the server writes the reminder in this language
    nag: loadPrefs().nag, // false: no hourly repeats for this device
    ua: navigator.userAgent.slice(0, 200),
    updatedAt: Date.now(),
  });
  return id;
}

// Must run straight from a tap: browsers only show the permission prompt for a user gesture.
export async function enablePush(user) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (sub && subscriptionKeyState(sub) === 'stale') {
    // Its record on the server could never work with this key; drop it so it is not tried again.
    await cloud.deletePushSub(await subscriptionDocId(sub.endpoint)).catch(() => {});
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    savePushKeyId(currentKeyId());
  }
  await saveSubscription(user, sub);
  return 'on';
}

export async function disablePush() {
  const sub = await getSubscription();
  if (!sub) return;
  const id = await subscriptionDocId(sub.endpoint);
  // Remove the server's record first (needs sign-in); the browser subscription goes either way.
  await cloud.deletePushSub(id).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTest(user) {
  const sub = await getSubscription();
  if (!sub) throw new Error('bu cihaz abone değil');
  // The test is an update, which the rules refuse for a record that does not exist
  // (the server may have dropped it), so make sure this device's record is there first.
  const id = await saveSubscription(user, sub);
  await cloud.requestPushTest(id);
}
