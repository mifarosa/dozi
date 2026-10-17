// Notification controls shown in settings: turn server reminders on/off and test them.
import { state, on, refresh as redrawApp } from './state.js';
import {
  pushConfigured, pushStatus, readEnvironment, getSubscription, saveSubscription,
  enablePush, disablePush, sendTest, friendlyPushError,
} from './push.js';
import { esc } from './html.js';
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

// The settings section. Empty states say why there is nothing to switch.
export function pushSectionHtml() {
  const off = busy ? 'disabled' : '';
  const message = (text) => `<p class="setting-note">${esc(note || text)}</p>`;
  return {
    hidden: message(t(pushConfigured ? 'push.signInFirst' : 'push.notConfigured')),
    'needs-install': message(t('push.needsInstall')),
    unsupported: message(t('push.unsupported')),
    denied: message(t('push.denied')),
    ready: `${message(t('push.ready'))}
      <button type="button" class="btn primary small" data-push="on" ${off}>${t('push.enable')}</button>`,
    on: `${message(t('push.on'))}
      <div class="setting-actions">
        <button type="button" class="btn ghost small" data-push="test" ${off}>${t('push.test')}</button>
        <button type="button" class="btn ghost small" data-push="off" ${off}>${t('push.disable')}</button>
      </div>`,
  }[status];
}

// Work out the current state and, when already subscribed, keep the server's record fresh.
async function update() {
  const env = readEnvironment();
  let subscribed = false;
  let sub = null;
  if (env.supported && state.user) {
    try {
      sub = await getSubscription();
      subscribed = Boolean(sub) && env.permission === 'granted';
    } catch {
      subscribed = false;
    }
  }
  status = pushStatus({
    configured: pushConfigured, signedIn: Boolean(state.user), ...env, subscribed,
  });
  // While push is on, the server sends the reminders; the on-device timer would double them.
  state.pushActive = status === 'on';
  refresh();
  if (sub && subscribed) saveSubscription(state.user, sub).catch(() => {});
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
  if (sub && readEnvironment().permission === 'granted') await saveSubscription(state.user, sub).catch(() => {});
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
