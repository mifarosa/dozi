// "New box": switch a medicine to a fresh box, optionally recording today's dose.
import { findMed, commit } from '../state.js';
import { remainingQ, formatPills } from '../store.js';
import { newBoxPrompt, endedLabel, startNewBox } from '../boxes.js';
import { resolveTakeTime } from '../reminders.js';
import { hhmm } from '../dates.js';

const dialog = document.getElementById('newbox-dialog');
const form = document.getElementById('newbox-form');
const timeRow = document.getElementById('newbox-time-row');

let medId = null;

export function openNewBox(id) {
  const m = findMed(id);
  if (!m) return;
  medId = id;
  form.reset();
  const prompt = newBoxPrompt(m);
  // The medicine's name goes on its own line, so a long name never breaks the title.
  const name = document.createElement('strong');
  name.textContent = m.name;
  const detail = remainingQ(m) > 0
    ? `Kutuda ${formatPills(remainingQ(m))} hap kaldı; yeni kutuya geçince bunlar sayılmaz.`
    : (prompt ? `Önceki kutu ${endedLabel(prompt.daysAgo)}.` : '');
  document.getElementById('newbox-note').replaceChildren(name, detail ? ` · ${detail}` : '');
  document.getElementById('newbox-took-label').textContent = `Bugünkü dozu içtim (${formatPills(m.dose)} hap)`;
  form.blisters.value = m.blisters;
  form.perBlister.value = m.perBlister;
  // When the app asked "did you take today's?", the usual answer is yes.
  form.took.checked = Boolean(prompt);
  form.time.value = hhmm(new Date());
  timeRow.hidden = !form.took.checked;
  dialog.showModal();
}

export function initNewBoxForm() {
  document.getElementById('newbox-cancel').addEventListener('click', () => dialog.close());
  form.took.addEventListener('change', () => { timeRow.hidden = !form.took.checked; });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const m = findMed(medId);
    if (!m) return;
    const doseAt = form.took.checked ? resolveTakeTime(form.time.value) : null;
    Object.assign(m, startNewBox(m, {
      blisters: Number(form.blisters.value),
      perBlister: Number(form.perBlister.value),
      firstDoseAt: doseAt,
    }));
    if (doseAt != null) m.log.push({ t: doseAt, q: Math.min(m.dose, remainingQ(m)) });
    dialog.close();
    commit();
  });
}
