// The "+" dialog: a regular medicine or a one-off daily entry.
import { state } from '../state.js';

const dialog = document.getElementById('choose-dialog');
const backfillChoice = document.getElementById('choose-backfill');

export function initChooser(addButton, { openMedForm, openExtraForm, openBackfill }) {
  addButton.addEventListener('click', () => {
    // A forgotten dose needs a medicine to belong to.
    backfillChoice.hidden = state.meds.length === 0;
    dialog.showModal();
  });
  document.getElementById('choose-cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    const choice = e.target.closest('[data-choose]')?.dataset.choose;
    if (!choice) return;
    dialog.close();
    if (choice === 'med') openMedForm(null);
    else if (choice === 'backfill') openBackfill();
    else openExtraForm();
  });
}
