import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  urlBase64ToUint8Array, subscriptionDocId, pushStatus, readEnvironment,
} from '../js/push.js';

test('urlBase64ToUint8Array decodes a VAPID key (url-safe, unpadded)', () => {
  // 65 bytes: 0x04 followed by 64 more, what an uncompressed P-256 public key looks like
  const bytes = Uint8Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : i));
  const b64url = Buffer.from(bytes).toString('base64url');
  assert.equal(b64url.includes('='), false);
  assert.deepEqual(urlBase64ToUint8Array(b64url), bytes);
  assert.deepEqual(urlBase64ToUint8Array('-_8'), Uint8Array.from([251, 255]));
});

test('subscriptionDocId is a stable SHA-256 hex of the endpoint', async () => {
  const a = await subscriptionDocId('https://push.example/abc');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, await subscriptionDocId('https://push.example/abc'));
  assert.notEqual(a, await subscriptionDocId('https://push.example/abd'));
  // known value, so a change of algorithm cannot slip through
  assert.equal(
    await subscriptionDocId('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

const base = {
  configured: true, signedIn: true, supported: true, permission: 'default', subscribed: false, ios: false, standalone: false,
};
const status = (over) => pushStatus({ ...base, ...over });

test('the bar is hidden until push is configured and the user is signed in', () => {
  assert.equal(status({ configured: false }), 'hidden');
  assert.equal(status({ signedIn: false }), 'hidden');
  assert.equal(status({ configured: false, supported: false }), 'hidden');
});

test('unsupported browsers: iPhone Safari tab needs the home screen, others just cannot', () => {
  assert.equal(status({ supported: false, ios: true, standalone: false }), 'needs-install');
  assert.equal(status({ supported: false, ios: true, standalone: true }), 'unsupported');
  assert.equal(status({ supported: false, ios: false }), 'unsupported');
});

test('permission and subscription decide between denied, ready and on', () => {
  assert.equal(status({ permission: 'denied' }), 'denied');
  assert.equal(status({ permission: 'denied', subscribed: true }), 'denied');
  assert.equal(status({ permission: 'default' }), 'ready');
  assert.equal(status({ permission: 'granted' }), 'ready');
  assert.equal(status({ permission: 'granted', subscribed: true }), 'on');
});

test('readEnvironment detects support, iOS and the installed app', () => {
  const win = (nav, extra = {}) => ({
    navigator: { userAgent: '', platform: '', maxTouchPoints: 0, serviceWorker: {}, ...nav },
    PushManager: function PushManager() {},
    Notification: { permission: 'granted' },
    matchMedia: () => ({ matches: false }),
    ...extra,
  });
  assert.deepEqual(readEnvironment(win({})), { supported: true, permission: 'granted', ios: false, standalone: false });
  assert.equal(readEnvironment(win({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' })).ios, true);
  assert.equal(readEnvironment(win({ platform: 'MacIntel', maxTouchPoints: 5 })).ios, true); // iPadOS
  assert.equal(readEnvironment(win({}, { matchMedia: () => ({ matches: true }) })).standalone, true);
  assert.equal(readEnvironment(win({ standalone: true })).standalone, true);
  // iPhone Safari tab: no PushManager and no Notification at all
  const tab = win({ userAgent: 'iPhone' });
  delete tab.PushManager;
  delete tab.Notification;
  assert.deepEqual(readEnvironment(tab), { supported: false, permission: 'unsupported', ios: true, standalone: false });
});
