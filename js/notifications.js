// Browser notification helpers. Reminders only fire while the app is open or kept
// alive in the background, since Dozi has no server to push from.
import { t } from './i18n.js';
import { getLang } from './lang.js';
import { groupReminders, groupMessage } from './notifyText.js';

const supported = () => 'Notification' in window;
const permission = () => (supported() ? Notification.permission : 'unsupported');

export const canNotify = () => permission() === 'granted';

// Short note for the medicine screen when reminders cannot be shown.
export function reminderNote() {
  if (!supported()) return t('notify.noSupport');
  if (permission() === 'denied') return t('notify.denied');
  return '';
}

// Call from a user gesture (a submit handler) so the browser shows its prompt.
export function askPermission() {
  if (permission() === 'default') Notification.requestPermission().catch(() => {});
}

// Shows one notification; a browser without a service worker falls back to a page notification.
async function show({ title, body, tag }) {
  const options = { body, icon: 'icons/icon-192.png', tag };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    // Fall back to a page notification below.
  }
  new Notification(title, options);
}

// Medicines due at the same time are announced together in one notification.
// due: [{ m, time }]
export function notifyDue(due) {
  const items = due.map(({ m, time }) => ({
    medId: m.id, name: m.name, dose: m.dose, time, repeat: 0,
  }));
  return Promise.all(groupReminders(items).map((group) => show(groupMessage(getLang(), group))));
}
