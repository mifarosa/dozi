// Notification controls shown in settings: turn server reminders on/off and test them.
import { state, on, refresh as redrawApp } from './state.js';
import {
  pushConfigured, pushStatus, readEnvironment, getSubscription, saveSubscription,
  enablePush, disablePush, sendTest, friendlyPushError,
} from './push.js';
import { esc } from './html.js';

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
    hidden: message(pushConfigured
      ? 'Bildirim için önce Google ile giriş yap.'
      : 'Sunucu bildirimleri bu kurulumda ayarlı değil.'),
    'needs-install': message('Bildirim için Dozi\'yi ana ekrana ekle (Paylaş → Ana Ekrana Ekle) ve oradan aç.'),
    unsupported: message('Bu tarayıcı arka plan bildirimini desteklemiyor.'),
    denied: message('Bildirim izni kapalı. Telefon ayarlarından Dozi için bildirimi aç.'),
    ready: `${message('Dozi kapalıyken de hatırlatma al.')}
      <button type="button" class="btn primary small" data-push="on" ${off}>Bildirimleri aç</button>`,
    on: `${message('Bildirimler açık ✓')}
      <div class="setting-actions">
        <button type="button" class="btn ghost small" data-push="test" ${off}>Test bildirimi gönder</button>
        <button type="button" class="btn ghost small" data-push="off" ${off}>Kapat</button>
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
      setNote(result === 'on' ? 'Bildirimler açıldı ✓' : '');
    } else if (action === 'off') {
      await disablePush();
      setNote('Bildirimler kapatıldı.');
    } else if (action === 'test') {
      await sendTest(state.user);
      setNote('Test istendi. Birkaç saniye içinde gelmezse sunucunun çalıştığını kontrol et.');
    }
  } catch (err) {
    console.error('Dozi push:', err);
    setNote(friendlyPushError(err));
  } finally {
    busy = false;
    await update();
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
