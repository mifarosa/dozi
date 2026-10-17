// The single source of truth for what the app is showing and storing.
// Screens read `state`; changes go through commit() (persist + notify) or
// refresh() (just redraw), so modules never need to import each other's render code.
import {
  load, save, loadExtras, saveExtras, loadMeta, saveMeta, normalizeMed,
} from './store.js';
import { storedWeek } from './week.js';

export const state = {
  meds: load().map(normalizeMed),
  extras: loadExtras(), // free-form drinks: vitamins, herbal teas, ...
  meta: loadMeta(), // { updatedAt, uid } for cloud sync
  view: 'meds', // 'meds' | 'calendar' | 'settings'
  openId: null, // id of the medicine shown in the detail view
  calMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDay: null, // 'YYYY-MM-DD' of the day opened below the calendar, or null
  weekStart: null, // Monday of the week listed below the calendar; null = this week
  user: null, // { uid, email } while signed in to the cloud
  pushActive: false, // this device gets reminders from the server, so local ones are skipped
};

const listeners = { commit: [], refresh: [], user: [] };

// event: 'commit' (data changed and was saved), 'refresh' (redraw only) or 'user' (sign-in changed).
export function on(event, fn) {
  listeners[event].push(fn);
}

export const findMed = (id) => state.meds.find((m) => m.id === id);
export const currentMed = () => findMed(state.openId);

// Open one day: select it and bring its week (and month) into view.
export function showDay(key) {
  state.selectedDay = key;
  const date = new Date(`${key}T12:00:00`);
  state.weekStart = storedWeek(date);
  const month = state.calMonth;
  if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) {
    state.calMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  }
}

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

export function setUser(user) {
  state.user = user;
  listeners.user.forEach((fn) => fn());
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
