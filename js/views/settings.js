// The settings screen: appearance, language, notifications and a data download.
import { THEMES, ACCENTS, LANGUAGES } from '../prefs.js';
import { pushSectionHtml } from '../pushUi.js';
import { pushConfigured } from '../push.js';
import { t } from '../i18n.js';
import { esc } from '../html.js';

function segmented(label, attr, options, chosen) {
  const buttons = options.map((o) => `
    <button type="button" class="seg" ${attr}="${o.id}" aria-pressed="${o.id === chosen}">${esc(o.label)}</button>`);
  return `<div class="segmented" role="group" aria-label="${esc(label)}">${buttons.join('')}</div>`;
}

// The ✓ marks the chosen colour, so the choice does not rely on colour alone.
function accentHtml(prefs) {
  const swatches = ACCENTS.map((a) => `
    <button type="button" class="swatch" data-accent-pick="${a.id}" style="--swatch:${a.color}"
      aria-label="${esc(t(`accent.${a.id}`))}" aria-pressed="${a.id === prefs.accent}">${a.id === prefs.accent ? '&#10003;' : ''}</button>`);
  return `<div class="swatches" role="group" aria-label="${esc(t('settings.color'))}">${swatches.join('')}</div>`;
}

function nagHtml(prefs) {
  return `<label class="check setting-check">
      <input type="checkbox" data-nag ${prefs.nag ? 'checked' : ''}>
      <span>${t('settings.nag')}</span>
    </label>
    <p class="setting-note">${t('settings.nagNote')}</p>`;
}

export function settingsHtml(prefs) {
  const themes = THEMES.map((o) => ({ id: o.id, label: t(`theme.${o.id}`) }));
  const languages = LANGUAGES.map((o) => ({ id: o.id, label: o.label || t('lang.system') }));
  return `
    <section class="card settings">
      <h2>${t('settings.look')}</h2>
      <p class="setting-label">${t('settings.theme')}</p>
      ${segmented(t('settings.theme'), 'data-theme-pick', themes, prefs.theme)}
      <p class="setting-label">${t('settings.color')}</p>
      ${accentHtml(prefs)}
      <p class="setting-label">${t('settings.language')}</p>
      ${segmented(t('settings.language'), 'data-lang-pick', languages, prefs.lang)}
    </section>

    <section class="card settings">
      <h2>${t('settings.notifications')}</h2>
      ${pushSectionHtml()}
      ${pushConfigured ? nagHtml(prefs) : ''}
    </section>

    <section class="card settings">
      <h2>${t('settings.data')}</h2>
      <p class="setting-note">${t('settings.dataNote')}</p>
      <button type="button" class="btn ghost small" data-export>${t('settings.download')}</button>
    </section>`;
}
