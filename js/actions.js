// Click handling for everything drawn inside #app, driven by data-* attributes.
import {
  state, commit, refresh, findMed, currentMed,
} from './state.js';
import { remainingQ } from './store.js';
import { resolveTakeTime, dayComplete } from './reminders.js';
import { openMedForm } from './ui/medForm.js';

function take(m, q) {
  const amount = Math.min(q, remainingQ(m));
  if (amount <= 0) return;
  // Today's dose is already complete: ask before logging an extra one.
  if (dayComplete(m) && !confirm('Bugünkü dozunu zaten aldın. Yine de bir doz daha kaydedilsin mi?')) return;
  const input = document.getElementById('take-time');
  m.log.push({ t: resolveTakeTime(input ? input.value : ''), q: amount });
  commit();
}

function selectDay(day) {
  state.selectedDay = state.selectedDay === day ? null : day;
  const d = new Date(`${day}T12:00:00`);
  if (d.getMonth() !== state.calMonth.getMonth()) state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  refresh();
}

function moveMonth(direction) {
  const step = { prev: -1, next: 1 }[direction];
  if (step) state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + step, 1);
  state.selectedDay = null;
  refresh();
}

function removeExtra(id) {
  if (!confirm('Bu kayıt silinsin mi?')) return;
  state.extras = state.extras.filter((x) => x.id !== id);
  commit();
}

function removeIntake(medId, t) {
  const med = findMed(medId);
  const at = med && med.log.findIndex((e) => e.t === t);
  if (med && at >= 0 && confirm('Bu alış silinsin mi? Kalan hap sayısı güncellenir.')) {
    med.log.splice(at, 1);
    commit();
  }
}

function deleteMed(m) {
  if (!confirm(`"${m.name}" silinsin mi?`)) return;
  state.meds = state.meds.filter((x) => x.id !== m.id);
  state.openId = null;
  commit();
}

// Checked in this order; the first data-* attribute found on the button wins.
// `m` is the medicine on screen, only needed by the detail screen's buttons.
const HANDLERS = [
  ['day', (btn) => selectDay(btn.dataset.day)],
  ['cal', (btn) => moveMonth(btn.dataset.cal)],
  ['removeExtra', (btn) => removeExtra(btn.dataset.removeExtra)],
  ['removeMed', (btn) => removeIntake(btn.dataset.removeMed, Number(btn.dataset.t))],
  ['open', (btn) => { state.openId = btn.dataset.open; refresh(); }],
  ['take', (btn, m) => m && take(m, Number(btn.dataset.take))],
  ['undo', (btn, m) => { if (m) { m.log.pop(); commit(); } }],
  ['edit', (btn, m) => m && openMedForm(m)],
  ['delete', (btn, m) => m && deleteMed(m)],
];

export function handleAppClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const m = currentMed();
  const found = HANDLERS.find(([key]) => key in btn.dataset);
  if (found) found[1](btn, m);
}
