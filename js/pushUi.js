// Notification controls shown in settings: turn server reminders on/off and test them.
import { state, on, refresh as redrawApp } from './state.js';
import {
  pushConfigured, pushStatus, readEnvironment, getSubscription, saveSubscription,
  enablePush, disablePush, sendTest, friendlyPushError, subscriptionKeyState,
} from './push.js';
import { esc } from './html.js';
import { savePushHint } from './store.js';
import { t } from './i18n.js';

const NOTE_MS = 12000;

// Only the settings screen shows these controls, so other screens need no redraw.
const refresh = () => { if (state.view === 'settings') redrawApp(); };

let status = 'hidden';
let note = '';
let busy = false;
let noteTimer = null;

function setNote(text) {
  note = text;
  clearTimeout(noteTimer);
  if (text) noteTimer = setTimeout(() => { note = ''; refresh(); }, NOTE_MS);
  refresh();
}

const LOCKED = ['hidden', 'needs-install', 'unsupported', 'denied']; // the switch cannot be used

// The notifications card, a pure function of its inputs so every state can be tested.
//   status      hidden | needs-install | unsupported | denied | stale | ready | on
//   configured  server push is set up in this installation (the app has a VAPID key)
//   nag         the saved "remind me hourly" choice (shown as off while notifications are off:
//               nothing is sent then; the choice itself is kept and comes back)
export function renderPushSection({
  status, busy = false, note = '', nag = true, configured = true,
}) {
  const on = status === 'on';
  const locked = LOCKED.includes(status);
  const text = note || t({
    hidden: configured ? 'push.signInFirst' : 'push.notConfigured',
    'needs-install': 'push.needsInstall',
    unsupported: 'push.unsupported',
    denied: 'push.denied',
    ready: 'push.ready',
    stale: 'push.stale',
    on: 'push.onNote',
  }[status]);
  const nagRow = configured ? `
    <div class="setting-row">
      <div class="setting-text">
        <strong>${t('settings.nag')}</strong>
        <span class="setting-note">${t('settings.nagNote')}</span>
      </div>
      <input type="checkbox" class="switch" role="switch" data-nag aria-label="${esc(t('settings.nag'))}"
        ${nag && on ? 'checked' : ''} ${on ? '' : 'disabled'}>
    </div>` : '';
  const test = on ? `
    <div class="setting-actions">
      <button type="button" class="btn ghost small" data-push="test" ${busy ? 'disabled' : ''}>${t('push.test')}</button>
    </div>` : '';
  return `
    <div class="setting-row">
      <div class="setting-text">
        <strong>${t('push.title')}</strong>
        <span class="setting-note" aria-live="polite">${esc(text)}</span>
      </div>
      <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="${esc(t('push.title'))}"
        data-push="${on ? 'off' : 'on'}" ${locked || busy ? 'disabled' : ''}></button>
    </div>${nagRow}${test}`;
}

// The settings section, drawn from this module's current state.
export function pushSectionHtml(prefs) {
  return renderPushSection({
    status, busy, note, nag: prefs.nag, configured: pushConfigured,
  });
}

// Work out the current state and, when already subscribed, keep the server's record fresh.
async function update() {
  const env = readEnvironment();
  let subscribed = false;
  let stale = false;
  let sub = null;
  if (env.supported && state.user) {
    try {
      sub = await getSubscription();
      subscribed = Boolean(sub) && env.permission === 'granted';
      stale = subscribed && subscriptionKeyState(sub) === 'stale';
    } catch {
      subscribed = false;
    }
  }
  status = pushStatus({
    configured: pushConfigured, signedIn: Boolean(state.user), ...env, subscribed, stale,
  });
  // While push is on, the server sends the reminders; the on-device timer would double them.
  // Before the cloud has answered, nobody looks signed in; that is not an answer, so keep what
  // we knew from last time instead of re-enabling the on-device reminders.
  if (state.authReady) {
    state.pushActive = status === 'on';
    savePushHint(state.pushActive);
  }
  refresh();
  // A stale subscription must not be written back as if it worked; the switch renews it.
  if (sub && subscribed && !stale) saveSubscription(state.user, sub).catch(() => {});
}

async function run(action) {
  busy = true;
  refresh();
  try {
    if (action === 'on') {
      const result = await enablePush(state.user);
      setNote(result === 'on' ? t('push.enabled') : '');
    } else if (action === 'off') {
      await disablePush();
      setNote(t('push.disabled'));
    } else if (action === 'test') {
      await sendTest(state.user);
      setNote(t('push.testSent'));
    }
  } catch (err) {
    console.error('Dozi push:', err);
    setNote(friendlyPushError(err));
  } finally {
    busy = false;
    await update();
  }
}

// Tell the server which language this device uses now (it writes the reminders).
export async function syncPushRecord() {
  if (!pushConfigured || !state.user) return;
  const sub = await getSubscription().catch(() => null);
  if (sub && readEnvironment().permission === 'granted' && subscriptionKeyState(sub) !== 'stale') {
    await saveSubscription(state.user, sub).catch(() => {});
  }
}

export function initPushUi() {
  if (!pushConfigured) return;
  // Tap handler must call enablePush synchronously so the permission prompt is allowed.
  document.getElementById('app').addEventListener('click', (e) => {
    const action = e.target.closest('[data-push]')?.dataset.push;
    if (action && !busy) run(action);
  });
  on('user', update);
  // Permission can change in the phone's settings while Dozi is in the background.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) update();
  });
  update();
}
