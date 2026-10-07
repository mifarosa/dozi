// The "what did you drink" dialog for vitamins, herbal teas and other one-off entries.
import { state, commit } from '../state.js';
import { newId } from '../store.js';
import { dayKey, hhmm } from '../dates.js';
import {
  EXTRA_KINDS, recentExtras, resolveExtraTime, suggestionChips,
} from '../history.js';
import { esc } from '../html.js';

const dialog = document.getElementById('extra-dialog');
const form = document.getElementById('extra-form');
const chipsBox = document.getElementById('extra-chips');

export function openExtraForm() {
  form.reset();
  const now = new Date();
  form.date.max = dayKey(now);
  // The calendar's selected day pre-fills the date so older days are easy to fill in.
  form.date.value = state.view === 'calendar' && state.selectedDay ? state.selectedDay : dayKey(now);
  form.time.value = hhmm(now);
  chipsBox.innerHTML = suggestionChips(state.extras).map((c) => (
    `<button type="button" class="chip" data-name="${esc(c.name)}" data-kind="${esc(c.kind)}">${esc(c.name)}</button>`
  )).join('');
  dialog.showModal();
}

export function initExtraForm() {
  document.getElementById('extra-cancel').addEventListener('click', () => dialog.close());

  // Picking a name you used before also picks the kind you used for it.
  form.name.addEventListener('input', () => {
    const typed = form.name.value.trim().toLowerCase();
    const known = recentExtras(state.extras, 100).find((r) => r.name.toLowerCase() === typed);
    if (known) form.kind.value = known.kind;
  });

  chipsBox.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    form.name.value = chip.dataset.name;
    form.kind.value = chip.dataset.kind;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    state.extras.push({
      id: newId(),
      name: form.name.value.trim(),
      kind: EXTRA_KINDS[form.kind.value] ? form.kind.value : 'other',
      t: resolveExtraTime(form.date.value, form.time.value),
    });
    dialog.close();
    commit();
  });
}
