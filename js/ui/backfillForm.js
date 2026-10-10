// "Add a forgotten dose": pick the medicine, the day and the time.
import { state, findMed, commit } from '../state.js';
import { backfillEntry } from '../boxes.js';
import { dayKey, startOfDay, addDays } from '../dates.js';
import { esc } from '../html.js';

const dialog = document.getElementById('backfill-dialog');
const form = document.getElementById('backfill-form');
const error = document.getElementById('backfill-error');

// Defaults that follow the chosen medicine: its usual dose and its first reminder time.
function useDefaultsOf(m) {
  form.q.value = String(m.dose);
  form.time.value = (m.times && m.times[0]) || '08:00';
}

// medId: preselect a medicine. date: 'YYYY-MM-DD'; without one the default is yesterday,
// the day people most often forget.
export function openBackfill({ medId = null, date = null } = {}) {
  if (!state.meds.length) return;
  form.reset();
  error.hidden = true;
  form.med.innerHTML = state.meds.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
  const chosen = findMed(medId) || state.meds[0];
  form.med.value = chosen.id;
  const today = startOfDay(new Date());
  form.date.max = dayKey(today);
  form.date.value = date || dayKey(addDays(today, -1));
  useDefaultsOf(chosen);
  dialog.showModal();
}

export function initBackfillForm() {
  document.getElementById('backfill-cancel').addEventListener('click', () => dialog.close());
  form.med.addEventListener('change', () => useDefaultsOf(findMed(form.med.value)));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const m = findMed(form.med.value);
    const entry = m && backfillEntry(m, { date: form.date.value, time: form.time.value, q: Number(form.q.value) });
    if (!entry) {
      error.textContent = 'Bu kutuda hap kalmadı. Önce yeni kutuya geç.';
      error.hidden = false;
      return;
    }
    m.log.push(entry);
    // From the calendar, show the day that was just filled in.
    if (state.view === 'calendar') {
      const d = new Date(entry.t);
      state.selectedDay = dayKey(d);
      state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    dialog.close();
    commit();
  });
}
