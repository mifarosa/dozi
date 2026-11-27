// Runs the reminder check: sends due notifications and keeps the "time to take" banner current.
import { state, refresh } from './state.js';
import { save, remainingQ } from './store.js';
import { dayKey } from './dates.js';
import { unnotifiedTimes, dueMeds } from './reminders.js';
import { canNotify, notifyDue } from './notifications.js';
import { learnedAsk } from './learned.js';

const CHECK_EVERY_MS = 30000;

let lastDueKey = null;
// The banner and the question cards both depend on the clock, so both are part of the redraw key.
const dueKey = () => `${dueMeds(state.meds).map((m) => m.id).join(',')}|${state.meds.filter((m) => learnedAsk(m)).map((m) => m.id).join(',')}`;
const formDialogOpen = () => Boolean(document.querySelector('#form-dialog[open], #extra-dialog[open]'));

// Everything due right now is collected first, so medicines at the same time share one notification.
// A question about a medicine is announced once per day (m.askedOn).
function sendNotifications(now) {
  const due = [];
  const asks = [];
  for (const m of state.meds) {
    if (remainingQ(m) === 0) continue;
    for (const time of unnotifiedTimes(m, now)) due.push({ m, time });
  }
  for (const m of state.meds) {
    const ask = learnedAsk(m, now);
    if (ask && m.askedOn !== dayKey(now)) asks.push({ m, time: ask.time });
  }
  if (!due.length && !asks.length) return;
  notifyDue(due, asks).catch(() => {});
  for (const { m, time } of due) m.fired = { ...m.fired, [time]: dayKey(now) };
  for (const { m } of asks) m.askedOn = dayKey(now);
  save(state.meds);
}

export function checkReminders() {
  // While server push is on the phone gets each reminder from the server; skip the local copy.
  // pushActive starts from last time's answer (see state.js), so this is also quiet at launch.
  if (canNotify() && !state.pushActive) sendNotifications(new Date());

  // The banner depends on the clock. Redraw only when it changes, so a time typed
  // into the intake field is never wiped by the timer.
  const key = dueKey();
  if (key === lastDueKey) return;
  if (state.view === 'meds' && !state.openId) {
    // A form is open: keep the old key so the next tick tries again after it closes.
    if (formDialogOpen()) return;
    refresh();
  }
  lastDueKey = key;
}

export function startReminderLoop() {
  setInterval(checkReminders, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkReminders();
  });
}
