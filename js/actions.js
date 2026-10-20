// Click handling for everything drawn inside #app, driven by data-* attributes.
import {
  state, commit, refresh, findMed, currentMed, showDay,
} from './state.js';
import { resolveWeek, shiftWeek, monthOfWeek, storedWeek } from './week.js';
import { startOfWeek } from './dates.js';
import { remainingQ } from './store.js';
import { resolveTakeTime, dayComplete } from './reminders.js';
import { openMedForm } from './ui/medForm.js';
import { openBackfill } from './ui/backfillForm.js';
import { openNewBox } from './ui/newBoxForm.js';
import { dayKey } from './dates.js';
import { t } from './i18n.js';

function take(m, q) {
  const amount = Math.min(q, remainingQ(m));
  if (amount <= 0) return;
  // Today's dose is already complete: ask before logging an extra one.
  if (dayComplete(m) && !confirm(t('confirm.extraDose'))) return;
  const input = document.getElementById('take-time');
  m.log.push({ t: resolveTakeTime(input ? input.value : ''), q: amount });
  commit();
}

// Tapping the open day again closes it.
function selectDay(day) {
  if (state.selectedDay === day) state.selectedDay = null;
  else showDay(day);
  refresh();
}

// Another month in the grid. The list below follows: this week for the current month,
// otherwise the last week of that month (the most recent days of it).
function moveMonth(direction) {
  const step = { prev: -1, next: 1 }[direction];
  const month = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + step, 1);
  const now = new Date();
  state.calMonth = month;
  state.selectedDay = null;
  const isCurrent = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  // A month ahead (a run-out day lives there) has no past week to list; stay on this week.
  const isFuture = month > new Date(now.getFullYear(), now.getMonth(), 1);
  state.weekStart = isCurrent || isFuture ? null : storedWeek(startOfWeek(new Date(month.getFullYear(), month.getMonth() + 1, 0)), now);
  refresh();
}

// Previous or next week; the next one stops at this week.
function moveWeek(direction) {
  const next = shiftWeek(state.weekStart, { prev: -1, next: 1 }[direction], new Date());
  if (next === undefined) return;
  state.weekStart = next;
  state.selectedDay = null;
  state.calMonth = monthOfWeek(resolveWeek(next).start);
  refresh();
}

// Close the open day and go back to the week list.
function closeDay() {
  state.selectedDay = null;
  refresh();
}

function removeExtra(id) {
  if (!confirm(t('confirm.removeExtra'))) return;
  state.extras = state.extras.filter((x) => x.id !== id);
  commit();
}

function removeIntake(medId, t) {
  const med = findMed(medId);
  const at = med && med.log.findIndex((e) => e.t === t);
  if (med && at >= 0 && confirm(t('confirm.removeIntake'))) {
    med.log.splice(at, 1);
    commit();
  }
}

function deleteMed(m) {
  if (!confirm(t('confirm.deleteMed', { name: m.name }))) return;
  state.meds = state.meds.filter((x) => x.id !== m.id);
  state.openId = null;
  commit();
}

// "Daha sonra": do not ask about this medicine's new box again today.
function askLater(id) {
  const m = findMed(id);
  if (!m) return;
  m.askedBox = dayKey(new Date());
  commit();
}

// Checked in this order; the first data-* attribute found on the button wins.
// `m` is the medicine on screen, only needed by the detail screen's buttons.
const HANDLERS = [
  ['day', (btn) => selectDay(btn.dataset.day)],
  ['cal', (btn) => (btn.dataset.cal === 'week' ? closeDay() : moveMonth(btn.dataset.cal))],
  ['week', (btn) => moveWeek(btn.dataset.week)],
  ['removeExtra', (btn) => removeExtra(btn.dataset.removeExtra)],
  ['removeMed', (btn) => removeIntake(btn.dataset.removeMed, Number(btn.dataset.t))],
  ['backfill', (btn) => openBackfill({ medId: btn.dataset.backfill })],
  ['backfillDay', (btn) => openBackfill({ date: btn.dataset.backfillDay })],
  ['newbox', (btn) => openNewBox(btn.dataset.newbox)],
  ['newboxLater', (btn) => askLater(btn.dataset.newboxLater)],
  ['open', (btn) => { state.openId = btn.dataset.open; refresh(); }],
  ['take', (btn, m) => m && take(m, Number(btn.dataset.take))],
  ['undo', (btn, m) => { if (m) { m.log.pop(); commit(); } }],
  ['edit', (btn, m) => m && openMedForm(m)],
  ['delete', (btn, m) => m && deleteMed(m)],
];

export function handleAppClick(e) {
  // Chart rows are SVG groups with data-day, not buttons.
  const btn = e.target.closest('button, [data-day]');
  if (!btn) return;
  const m = currentMed();
  const found = HANDLERS.find(([key]) => key in btn.dataset);
  if (found) found[1](btn, m);
}
