// Look-and-feel preferences: theme (system/light/dark), accent colour and language.
// Stored per device; the CSS reads them from data-theme / data-accent on <html>.
const KEY = 'dozi.prefs';

// Labels come from the translations (theme.<id>, accent.<id>).
export const THEMES = [{ id: 'system' }, { id: 'light' }, { id: 'dark' }];

// `color` is only the swatch shown in settings; the real values live in css/style.css.
export const ACCENTS = [
  { id: 'teal', color: '#0f766e' },
  { id: 'blue', color: '#1d4ed8' },
  { id: 'purple', color: '#7e22ce' },
  { id: 'rose', color: '#be185d' },
  { id: 'orange', color: '#c2410c' },
];

// "system" follows the phone's language. Language names are written in their own language.
export const LANGUAGES = [{ id: 'system' }, { id: 'tr', label: 'Türkçe' }, { id: 'en', label: 'English' }];

export const DEFAULT_PREFS = { theme: 'system', accent: 'teal', lang: 'system' };

// Unknown or damaged values fall back to the defaults.
export function normalizePrefs(raw) {
  const theme = THEMES.some((t) => t.id === raw?.theme) ? raw.theme : DEFAULT_PREFS.theme;
  const accent = ACCENTS.some((a) => a.id === raw?.accent) ? raw.accent : DEFAULT_PREFS.accent;
  const lang = LANGUAGES.some((l) => l.id === raw?.lang) ? raw.lang : DEFAULT_PREFS.lang;
  return { theme, accent, lang };
}

export function loadPrefs() {
  try {
    return normalizePrefs(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage may be blocked; the choice then lasts until the page is closed.
  }
}

// The defaults need no attribute, so the stylesheet's own values apply.
export function applyPrefs(prefs, root = document.documentElement) {
  const set = (name, value, fallback) => {
    if (value === fallback) root.removeAttribute(name);
    else root.setAttribute(name, value);
  };
  set('data-theme', prefs.theme, DEFAULT_PREFS.theme);
  set('data-accent', prefs.accent, DEFAULT_PREFS.accent);
}
