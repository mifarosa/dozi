// The notification bar under the cloud bar: turn server reminders on/off and test them.
import { state, on } from './state.js';
import {
  pushConfigured, pushStatus, readEnvironment, getSubscription, saveSubscription,
  enablePush, disablePush, sendTest,
} from './push.js';
import { esc } from './html.js';

const bar = document.getElementById('push-bar');
const NOTE_MS = 12000;

let status = 'hidden';
let note = '';
let busy = false;
let noteTimer = null;

function setNote(text) {
  note = text;
  clearTimeout(noteTimer);
  if (text) noteTimer = setTimeout(() => { note = ''; render(); }, NOTE_MS);
  render();
}

function render() {
  bar.hidden = status === 'hidden';
  if (bar.hidden) return;
  const off = busy ? 'disabled' : '';
  const message = (text) => `<span>${esc(note || text)}</span>`;
  const html = {
    'needs-install': message('Bildirim için Dozi\'yi ana ekrana ekle (Paylaş → Ana Ekrana Ekle) ve oradan aç.'),
    unsupported: message('Bu tarayıcı arka plan bildirimini desteklemiyor.'),
    denied: message('Bildirim izni kapalı. Telefon ayarlarından Dozi için bildirimi aç.'),
    ready: `${message('Dozi kapalıyken de hatırlatma al')}
      <button class="btn primary small" data-push="on" ${off}>Bildirimleri aç</button>`,
    on: `${message('Bildirimler açık ✓')}
      <span class="push-actions">
        <button class="btn ghost small" data-push="test" ${off}>Test</button>
        <button class="btn ghost small" data-push="off" ${off}>Kapat</button>
      </span>`,
  }[status];
  bar.innerHTML = html;
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
  render();
  if (sub && subscribed) saveSubscription(state.user, sub).catch(() => {});
}

async function run(action) {
  busy = true;
  render();
  try {
    if (action === 'on') {
      const result = await enablePush(state.user);
      setNote(result === 'on' ? 'Bildirimler açıldı ✓' : '');
    } else if (action === 'off') {
      await disablePush();
      setNote('Bildirimler kapatıldı.');
    } else if (action === 'test') {
      await sendTest();
      setNote('Test istendi. Birkaç saniye içinde gelmezse sunucunun çalıştığını kontrol et.');
    }
  } catch (err) {
    setNote(`Olmadı: ${err.message || 'bilinmeyen hata'}`);
  } finally {
    busy = false;
    await update();
  }
}

export function initPushUi() {
  if (!pushConfigured) return;
  // Tap handler must call enablePush synchronously so the permission prompt is allowed.
  bar.addEventListener('click', (e) => {
    const action = e.target.closest('button')?.dataset.push;
    if (action && !busy) run(action);
  });
  on('user', update);
  // Permission can change in the phone's settings while Dozi is in the background.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) update();
  });
  update();
}
