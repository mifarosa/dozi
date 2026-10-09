import './tz.js';
// Orchestrates sending: keeps the latest users and push subscriptions in memory and,
// on every tick, sends the reminders that are due. Network and storage are injected,
// so the whole flow can be tested without Firebase or a push service.
import { dueReminders } from './due.js';

const TEST_FRESH_MS = 2 * 60 * 1000; // a test request older than this is ignored (e.g. after a restart)
const KEEP_DAYS = 2;

const isGone = (err) => err && (err.statusCode === 404 || err.statusCode === 410);

// deps:
//   send(sub, payloadObject)  resolves when the push service accepted it; rejects with .statusCode
//   removeSub(id)             forget a subscription the push service says is gone
//   loadSent() / saveSent(o)  which reminders were already sent, so a restart never repeats them
export function createNotifier({
  send, removeSub, loadSent, saveSent, now = () => Date.now(), maxLateMin = 30, log = () => {},
}) {
  const users = new Map(); // uid -> { meds }
  const subs = new Map(); // id -> { id, uid, tz, updatedAt, testAt, ... }
  const handledTest = new Map(); // id -> last testAt we answered
  const sent = loadSent() || {}; // key -> true
  let running = false;

  function setUser(uid, data) {
    if (data) users.set(uid, { meds: Array.isArray(data.meds) ? data.meds : [] });
    else users.delete(uid);
  }

  function setSub(id, data) {
    if (!data) {
      subs.delete(id);
      handledTest.delete(id);
      return;
    }
    subs.set(id, { ...data, id });
  }

  function prune() {
    const keepFrom = new Date(now() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
    let changed = false;
    for (const key of Object.keys(sent)) {
      if (key.split('|').pop() < keepFrom) { delete sent[key]; changed = true; }
    }
    if (changed) saveSent(sent);
  }

  // Send to every subscription; returns how many accepted it. Dead ones are removed.
  async function sendAll(list, payload) {
    let accepted = 0;
    for (const sub of list) {
      try {
        await send(sub, payload);
        accepted += 1;
      } catch (err) {
        if (isGone(err)) {
          log(`subscription ${sub.id} is gone, removing`);
          subs.delete(sub.id);
          await removeSub(sub.id).catch(() => {});
        } else {
          log(`push to ${sub.id} failed: ${err && (err.statusCode || err.message)}`);
        }
      }
    }
    return accepted;
  }

  async function answerTests() {
    for (const sub of [...subs.values()]) {
      const at = Number(sub.testAt) || 0;
      if (!at || at <= (handledTest.get(sub.id) || 0)) continue;
      handledTest.set(sub.id, at);
      if (now() - at > TEST_FRESH_MS) continue;
      const accepted = await sendAll([sub], { title: 'Dozi', body: 'Bildirimler çalışıyor ✓', tag: 'dozi-test' });
      log(`test push to ${sub.id.slice(0, 8)}…: ${accepted ? 'sent' : 'not delivered'}`);
    }
  }

  async function tick() {
    if (running) return { sent: 0, skipped: true };
    running = true;
    let count = 0;
    try {
      await answerTests();
      const byUser = new Map();
      for (const sub of subs.values()) {
        if (!byUser.has(sub.uid)) byUser.set(sub.uid, []);
        byUser.get(sub.uid).push(sub);
      }
      for (const [uid, list] of byUser) {
        const user = users.get(uid);
        if (!user) continue;
        // The newest subscription tells us which time zone the person is in.
        const newest = list.reduce((a, b) => ((Number(b.updatedAt) || 0) >= (Number(a.updatedAt) || 0) ? b : a));
        const due = dueReminders({
          uid, meds: user.meds, timeZone: newest.tz, nowMs: now(), maxLateMin,
        });
        for (const r of due) {
          if (sent[r.key]) continue;
          const accepted = await sendAll(list, {
            title: `${r.name} zamanı`, body: r.body, tag: `dozi-${r.medId}-${r.time}`,
          });
          // Not marked when nobody accepted it, so the next tick tries again (until it is too late).
          if (accepted > 0) {
            sent[r.key] = true;
            saveSent(sent);
            count += 1;
            log(`sent "${r.name}" ${r.time} to ${accepted} device(s)`);
          }
        }
      }
      prune();
    } finally {
      running = false;
    }
    return { sent: count };
  }

  return { setUser, setSub, tick, stats: () => ({ users: users.size, subs: subs.size }) };
}
