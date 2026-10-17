// Applies the chosen language to the page: the <html lang>, and every element of index.html
// marked with data-i18n (text), data-i18n-placeholder or data-i18n-aria.
import { setLang, resolveLang, getLang } from './lang.js';
import { t } from './i18n.js';

export function applyLanguage(pref) {
  setLang(resolveLang(pref, navigator.language));
  document.documentElement.lang = getLang();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('page.description'));
}
