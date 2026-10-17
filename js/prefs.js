// Look-and-feel preferences: theme (system/light/dark) and accent colour.
// Stored per device; the CSS reads them from data-theme / data-accent on <html>.
const KEY = 'dozi.prefs';

export const THEMES = [
  { id: 'system', label: 'Sistem' },
  { id: 'light', label: 'Açık' },
  { id: 'dark', label: 'Koyu' },
];

// `color` is only the swatch shown in settings; the real values live in css/style.css.
export const ACCENTS = [
  { id: 'teal', label: 'Yeşil', color: '#0f766e' },
  { id: 'blue', label: 'Mavi', color: '#1d4ed8' },
  { id: 'purple', label: 'Mor', color: '#7e22ce' },
  { id: 'rose', label: 'Pembe', color: '#be185d' },
  { id: 'orange', label: 'Turuncu', color: '#c2410c' },
];

export const DEFAULT_PREFS = { theme: 'system', accent: 'teal' };

// Unknown or damaged values fall back to the defaults.
export function normalizePrefs(raw) {
  const theme = THEMES.some((t) => t.id === raw?.theme) ? raw.theme : DEFAULT_PREFS.theme;
  const accent = ACCENTS.some((a) => a.id === raw?.accent) ? raw.accent : DEFAULT_PREFS.accent;
  return { theme, accent };
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
