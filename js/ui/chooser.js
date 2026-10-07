// The "+" dialog: a regular medicine or a one-off daily entry.
const dialog = document.getElementById('choose-dialog');

export function initChooser(addButton, { openMedForm, openExtraForm }) {
  addButton.addEventListener('click', () => dialog.showModal());
  document.getElementById('choose-cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    const choice = e.target.closest('[data-choose]')?.dataset.choose;
    if (!choice) return;
    dialog.close();
    if (choice === 'med') openMedForm(null); else openExtraForm();
  });
}
