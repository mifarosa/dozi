// The single source of truth for what the app is showing and storing.
// Screens read `state`; changes go through commit() (persist + notify) or
// refresh() (just redraw), so modules never need to import each other's render code.
import {
  load, save, loadExtras, saveExtras, loadMeta, saveMeta, normalizeMed,
} from './store.js';

export const state = {
  meds: load().map(normalizeMed),
  extras: loadExtras(), // free-form drinks: vitamins, herbal teas, ...
  meta: loadMeta(), // { updatedAt, uid } for cloud sync
  view: 'meds', // 'meds' | 'calendar'
  openId: null, // id of the medicine shown in the detail view
  calMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDay: null, // 'YYYY-MM-DD' or null for the whole month
};

const listeners = { commit: [], refresh: [] };

// event: 'commit' (data changed and was saved) or 'refresh' (redraw only).
export function on(event, fn) {
  listeners[event].push(fn);
}

export const findMed = (id) => state.meds.find((m) => m.id === id);
export const currentMed = () => findMed(state.openId);

export function setMeta(patch) {
  state.meta = { ...state.meta, ...patch };
  saveMeta(state.meta);
}

// Persist both collections, mark the local copy as changed and tell the listeners.
export function commit() {
  save(state.meds);
  saveExtras(state.extras);
  setMeta({ updatedAt: Date.now() });
  listeners.commit.forEach((fn) => fn());
}

export function refresh() {
  listeners.refresh.forEach((fn) => fn());
}

// Used when the cloud copy replaces the local one; saved but not marked as a local edit.
export function replaceData(meds, extras) {
  state.meds = meds;
  state.extras = extras;
  save(meds);
  saveExtras(extras);
}
