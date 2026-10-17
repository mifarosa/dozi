// Settings behaviour: apply and remember the look and language, and download the data.
import { state, refresh } from './state.js';
import { loadPrefs, savePrefs, applyPrefs } from './prefs.js';
import { applyLanguage } from './langUi.js';
import { redrawCloudBar } from './cloudSync.js';
import { syncPushRecord } from './pushUi.js';

export let prefs = loadPrefs();

// The status bar colour follows the page background, whichever theme is showing.
function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

function apply() {
  applyPrefs(prefs);
  applyLanguage(prefs.lang);
  syncThemeColor();
}

// Medicines and drinks as a JSON file, named by day.
function downloadData() {
  const data = { app: 'dozi', exportedAt: new Date().toISOString(), meds: state.meds, extras: state.extras };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `dozi-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initSettings() {
  apply();
  // "System" theme follows the phone, so a change there must update the status bar colour too.
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', syncThemeColor);

  document.getElementById('app').addEventListener('click', (e) => {
    const theme = e.target.closest('[data-theme-pick]')?.dataset.themePick;
    const accent = e.target.closest('[data-accent-pick]')?.dataset.accentPick;
    const lang = e.target.closest('[data-lang-pick]')?.dataset.langPick;
    if (theme || accent || lang) {
      prefs = { ...prefs, ...(theme && { theme }), ...(accent && { accent }), ...(lang && { lang }) };
      savePrefs(prefs);
      apply();
      refresh();
      if (lang) {
        redrawCloudBar();
        syncPushRecord(); // the server writes reminders in this device's language
      }
    } else if (e.target.closest('[data-export]')) {
      downloadData();
    }
  });
}
