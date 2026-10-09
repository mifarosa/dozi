import './tz.js';
import admin from 'firebase-admin';
import webpush from 'web-push';
import { readConfig } from './config.js';
import { createNotifier } from './notifier.js';
import { fileSentStore } from './sentStore.js';

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);

const config = readConfig();
webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();
const sentStore = fileSentStore(config.dataDir);

const notifier = createNotifier({
  // TTL: a reminder that could not be delivered within 10 minutes is no longer useful.
  send: (sub, payload) => webpush.sendNotification(
    { endpoint: sub.endpoint, keys: sub.keys },
    JSON.stringify(payload),
    { TTL: 600, urgency: 'high' },
  ),
  removeSub: (id) => db.collection('pushSubs').doc(id).delete(),
  loadSent: sentStore.load,
  saveSent: sentStore.save,
  maxLateMin: config.maxLateMinutes,
  log,
});

// Keep users and subscriptions in memory. Firestore only bills a read when something changes.
const pending = new Set(['users', 'pushSubs']);
function watch(collection, apply) {
  db.collection(collection).onSnapshot(
    (snap) => {
      snap.docChanges().forEach((c) => apply(c.doc.id, c.type === 'removed' ? null : c.doc.data()));
      // Say "started" only once both lists have really loaded, so a bad key never looks like success.
      if (pending.delete(collection) && pending.size === 0) {
        const { users, subs } = notifier.stats();
        log(`connected to Firestore: ${users} user(s), ${subs} device(s)`);
      }
    },
    (err) => {
      // Exit so the supervisor (systemd / docker) restarts us with a fresh connection.
      log(`listener on "${collection}" failed: ${err.message}`);
      process.exit(1);
    },
  );
}
watch('users', (id, data) => notifier.setUser(id, data));
watch('pushSubs', (id, data) => notifier.setSub(id, data));

const timer = setInterval(() => {
  notifier.tick().catch((err) => log(`tick failed: ${err.message}`));
}, config.tickSeconds * 1000);

log(`dozi-notifier starting (every ${config.tickSeconds}s, ignores reminders older than ${config.maxLateMinutes} min)`);
setInterval(() => {
  const { users, subs } = notifier.stats();
  log(`alive: ${users} user(s), ${subs} device(s)`);
}, 60 * 60 * 1000).unref();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log(`${signal} received, stopping`);
    clearInterval(timer);
    process.exit(0);
  });
}
