// The settings screen: appearance, notifications and a data download.
import { THEMES, ACCENTS } from '../prefs.js';
import { pushSectionHtml } from '../pushUi.js';
import { esc } from '../html.js';

function themeHtml(prefs) {
  const buttons = THEMES.map((t) => `
    <button type="button" class="seg" data-theme-pick="${t.id}" aria-pressed="${t.id === prefs.theme}">${esc(t.label)}</button>`);
  return `<div class="segmented" role="group" aria-label="Tema">${buttons.join('')}</div>`;
}

// The ✓ marks the chosen colour, so the choice does not rely on colour alone.
function accentHtml(prefs) {
  const swatches = ACCENTS.map((a) => `
    <button type="button" class="swatch" data-accent-pick="${a.id}" style="--swatch:${a.color}"
      aria-label="${esc(a.label)}" aria-pressed="${a.id === prefs.accent}">${a.id === prefs.accent ? '&#10003;' : ''}</button>`);
  return `<div class="swatches" role="group" aria-label="Renk">${swatches.join('')}</div>`;
}

export function settingsHtml(prefs) {
  return `
    <section class="card settings">
      <h2>Görünüm</h2>
      <p class="setting-label">Tema</p>
      ${themeHtml(prefs)}
      <p class="setting-label">Renk</p>
      ${accentHtml(prefs)}
    </section>

    <section class="card settings">
      <h2>Bildirimler</h2>
      ${pushSectionHtml()}
    </section>

    <section class="card settings">
      <h2>Veriler</h2>
      <p class="setting-note">İlaçlarını ve kayıtlarını bir dosya olarak indir. Yedek olarak saklayabilirsin.</p>
      <button type="button" class="btn ghost small" data-export>Verileri indir (JSON)</button>
    </section>`;
}
