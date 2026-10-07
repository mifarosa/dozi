// Browser notification helpers. Reminders only fire while the app is open or kept
// alive in the background, since Dozi has no server to push from.
import { formatPills } from './store.js';

const supported = () => 'Notification' in window;
const permission = () => (supported() ? Notification.permission : 'unsupported');

export const canNotify = () => permission() === 'granted';

// Short note for the medicine screen when reminders cannot be shown.
export function reminderNote() {
  if (!supported()) return ' (bu tarayıcı bildirimi desteklemiyor)';
  if (permission() === 'denied') return ' (bildirim izni kapalı)';
  return '';
}

// Call from a user gesture (a submit handler) so the browser shows its prompt.
export function askPermission() {
  if (permission() === 'default') Notification.requestPermission().catch(() => {});
}

export async function notify(m, time) {
  const title = `${m.name} zamanı`;
  const options = {
    body: `${formatPills(m.dose)} hap · ${time}`,
    icon: 'icons/icon-192.png',
    tag: `dozi-${m.id}-${time}`,
  };
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
