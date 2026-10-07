// Persistence and pure pill math. All amounts are counted in quarter pills
// so that 1/4, 1/2 and whole doses never need floating point.
const KEY = 'dozi.v1';
export const QUARTERS = 4;

export function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function save(meds) {
  try {
    localStorage.setItem(KEY, JSON.stringify(meds));
  } catch {
    // Storage may be blocked (private mode); the app still works for this session.
  }
}

const EXTRAS_KEY = 'dozi.extras';

// Free-form intakes (vitamins, herbal teas, ...) kept apart from tracked medicines.
export function loadExtras() {
  try {
    const data = JSON.parse(localStorage.getItem(EXTRAS_KEY));
    return Array.isArray(data) ? data.filter((x) => x && x.name && Number.isFinite(x.t)) : [];
  } catch {
    return [];
  }
}

export function saveExtras(extras) {
  try {
    localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras));
  } catch {
    // Same as save(): not fatal.
  }
}

const META_KEY = 'dozi.sync';

// Sync bookkeeping: when local data last changed and which account it last synced with.
export function loadMeta() {
  try {
    const meta = JSON.parse(localStorage.getItem(META_KEY));
    return { updatedAt: Number(meta?.updatedAt) || 0, uid: meta?.uid || null };
  } catch {
    return { updatedAt: 0, uid: null };
  }
}

export function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Same as save(): not fatal.
  }
}

// Older saved data has no reminder fields, so fill in defaults.
export const normalizeMed = (m) => ({ times: [], fired: {}, log: [], ...m });

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export const totalQ = (m) => m.blisters * m.perBlister * QUARTERS;

export function consumedQ(m) {
  const logged = m.log.reduce((sum, e) => sum + e.q, 0);
  return Math.min(totalQ(m), m.startQ + logged);
}

export const remainingQ = (m) => totalQ(m) - consumedQ(m);

// Quarters consumed on the current pill-slot grid, for one pill cell.
export function cellQuarters(m, index) {
  const used = consumedQ(m) - index * QUARTERS;
  return Math.max(0, Math.min(QUARTERS, used));
}

export function takenTodayQ(m, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return m.log.filter((e) => e.t >= start).reduce((sum, e) => sum + e.q, 0);
}

export function daysLeft(m) {
  const perDayQ = m.dose * m.perDay;
  return perDayQ > 0 ? Math.floor(remainingQ(m) / perDayQ) : 0;
}

export function formatPills(q) {
  const whole = Math.floor(q / QUARTERS);
  const frac = { 0: '', 1: '¼', 2: '½', 3: '¾' }[q % QUARTERS];
  if (whole === 0) return frac || '0';
  return `${whole}${frac}`;
}

// Convert the "where I left off" form fields into consumed quarters.
// partLeft = quarters still left on the pill in use (0 means a fresh pill).
export function startQuarters(blister, pill, partLeft, perBlister) {
  const pillsBefore = (blister - 1) * perBlister + (pill - 1);
  const partUsed = partLeft === 0 ? 0 : QUARTERS - partLeft;
  return pillsBefore * QUARTERS + partUsed;
}
