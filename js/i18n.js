// Text in the user's language. t('key', { param }) fills {param} placeholders and inserts them
// as they are, so callers escape user data themselves (esc()) before passing it.
// A missing English message falls back to Turkish, a missing key to the key itself.
import { getLang, LANG_IDS } from './lang.js';
import { formatPills, QUARTERS } from './store.js';
import tr from './i18n/tr.js';
import en from './i18n/en.js';

const DICTS = { tr, en };

export function translate(lang, key, params = {}) {
  const value = (DICTS[lang] || tr)[key] ?? tr[key] ?? key;
  if (typeof value === 'function') return value(params);
  if (typeof value !== 'string') return value; // lists such as the weekday names
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

export const t = (key, params) => translate(getLang(), key, params);

// "pill" for a quarter up to one whole pill, "pills" for none or more than one; Turkish says "hap" for both.
export const pillUnit = (q, lang = getLang()) => translate(lang, q > 0 && q <= QUARTERS ? 'unit.pill' : 'unit.pills');
export const pillsText = (q, lang = getLang()) => `${formatPills(q)} ${pillUnit(q, lang)}`;

export const messageKeys = () => Object.keys(tr);
export const hasLang = (lang) => LANG_IDS.includes(lang);

// Short weekday names, Monday first.
export const dayNames = () => t('days.short');
