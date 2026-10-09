// Web Push on this device: subscribe, tell the server where to send, unsubscribe, test.
// The server (see ../server) sends the reminders, so they arrive even when Dozi is closed.
import * as cloud from './cloud.js';
import { vapidPublicKey } from './push-config.js';

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

// What the notification bar should show. Pure, so every case is testable.
//   hidden | needs-install | unsupported | denied | ready | on
export function pushStatus({
  configured, signedIn, supported, permission, subscribed, ios, standalone,
}) {
  if (!configured || !signedIn) return 'hidden';
  if (!supported) return ios && !standalone ? 'needs-install' : 'unsupported';
  if (permission === 'denied') return 'denied';
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

// A subscription made for a different server key can never receive our pushes.
function usesOurKey(sub) {
  const key = sub.options?.applicationServerKey;
  if (!key) return true; // cannot tell; keep it
  const ours = urlBase64ToUint8Array(vapidPublicKey);
  const theirs = new Uint8Array(key);
  return ours.length === theirs.length && ours.every((b, i) => b === theirs[i]);
}

// Tells the server about this device (also refreshes its time zone and restores a lost record).
export async function saveSubscription(user, sub) {
  const json = sub.toJSON();
  const id = await subscriptionDocId(json.endpoint);
  await cloud.savePushSub(id, {
    uid: user.uid,
    endpoint: json.endpoint,
    keys: json.keys,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
  if (sub && !usesOurKey(sub)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
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

export async function sendTest() {
  const sub = await getSubscription();
  if (!sub) throw new Error('bu cihaz abone değil');
  await cloud.requestPushTest(await subscriptionDocId(sub.endpoint));
}
