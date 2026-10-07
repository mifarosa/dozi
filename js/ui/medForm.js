// The "new / edit medicine" dialog, including the add/remove alarm time rows.
import { state, findMed, commit } from '../state.js';
import {
  QUARTERS, newId, totalQ, consumedQ, startQuarters,
} from '../store.js';
import { parseTimes } from '../reminders.js';
import { askPermission } from '../notifications.js';
import { checkReminders } from '../reminderLoop.js';

const MAX_TIMES = 6;

const dialog = document.getElementById('form-dialog');
const form = document.getElementById('med-form');
const formError = document.getElementById('form-error');
const timeRows = document.getElementById('time-rows');
const addTimeBtn = document.getElementById('add-time');

let editingId = null; // id being edited in the form, null when adding

function addTimeRow(value = '') {
  const row = document.createElement('div');
  row.className = 'time-row';
  row.innerHTML = '<input type="time" aria-label="Hatırlatma saati">'
    + '<button type="button" class="icon-btn mini" aria-label="Saati sil">&times;</button>';
  row.querySelector('input').value = value;
  timeRows.append(row);
  addTimeBtn.hidden = timeRows.children.length >= MAX_TIMES;
}

// Fill the "where I left off" fields from the pill in use right now.
function fillPosition(m) {
  const used = consumedQ(m);
  const pillIndex = Math.min(Math.floor(used / QUARTERS), totalQ(m) / QUARTERS - 1);
  form.curBlister.value = Math.floor(pillIndex / m.perBlister) + 1;
  form.curPill.value = (pillIndex % m.perBlister) + 1;
  const partUsed = used - pillIndex * QUARTERS;
  form.curPart.value = partUsed === 0 ? 0 : QUARTERS - partUsed;
}

export function openMedForm(m) {
  editingId = m ? m.id : null;
  document.getElementById('form-title').textContent = m ? 'İlacı düzenle' : 'Yeni ilaç';
  formError.hidden = true;
  form.reset();
  timeRows.innerHTML = '';
  addTimeBtn.hidden = false;
  if (m) {
    form.name.value = m.name;
    form.blisters.value = m.blisters;
    form.perBlister.value = m.perBlister;
    form.dose.value = m.dose;
    form.perDay.value = m.perDay;
    m.times.forEach((t) => addTimeRow(t));
    fillPosition(m);
  }
  dialog.showModal();
}

function readFields() {
  const blisters = Number(form.blisters.value);
  const perBlister = Number(form.perBlister.value);
  const curBlister = Number(form.curBlister.value);
  const curPill = Number(form.curPill.value);
  const partLeft = Number(form.curPart.value);
  if (curBlister > blisters || curPill > perBlister) return null;
  return {
    name: form.name.value.trim(),
    blisters,
    perBlister,
    dose: Number(form.dose.value),
    perDay: Number(form.perDay.value),
    times: parseTimes([...timeRows.querySelectorAll('input')].map((i) => i.value)),
    // The form describes the current position, so it becomes the new baseline
    // and earlier intake history is folded into it.
    startQ: startQuarters(curBlister, curPill, partLeft, perBlister),
  };
}

function save(fields) {
  if (!editingId) {
    state.meds.push({ id: newId(), ...fields, log: [] });
    return;
  }
  const m = findMed(editingId);
  // Keep the intake history (and today's count) unless the position itself changed.
  const positionChanged = fields.startQ !== consumedQ(m);
  const log = positionChanged ? [] : m.log;
  const startQ = positionChanged ? fields.startQ : m.startQ;
  Object.assign(m, fields, { startQ, log });
}

export function initMedForm() {
  document.getElementById('form-cancel').addEventListener('click', () => dialog.close());
  addTimeBtn.addEventListener('click', () => addTimeRow());
  timeRows.addEventListener('click', (e) => {
    const remove = e.target.closest('button');
    if (!remove) return;
    remove.parentElement.remove();
    addTimeBtn.hidden = false;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fields = readFields();
    if (!fields) {
      formError.textContent = 'Kaldığın yer, kutudaki blister ve hap sayısını aşıyor.';
      formError.hidden = false;
      return;
    }
    save(fields);
    // Asking from the submit handler keeps the permission prompt tied to a user gesture.
    if (fields.times.length) askPermission();
    dialog.close();
    commit();
    checkReminders();
  });
}
