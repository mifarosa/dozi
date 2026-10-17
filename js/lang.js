// The language in use. Kept apart from the messages so date helpers can read it
// without pulling in the whole translation layer.
const LOCALES = { tr: 'tr-TR', en: 'en-GB' };

export const LANG_IDS = Object.keys(LOCALES);

let current = 'tr';

export const getLang = () => current;

export function setLang(lang) {
  if (LOCALES[lang]) current = lang;
}

export const localeOf = (lang) => LOCALES[lang] || LOCALES.tr;
export const locale = () => localeOf(current);

// A saved choice wins; "system" follows the phone: Turkish phones get Turkish, the rest English.
export function resolveLang(pref, navigatorLanguage = '') {
  if (LOCALES[pref]) return pref;
  return /^tr\b/i.test(navigatorLanguage) ? 'tr' : 'en';
}
