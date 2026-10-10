// Entry point: draws the current screen and wires the top-level controls.
import { state, on, currentMed, refresh } from './state.js';
import { handleAppClick } from './actions.js';
import { listHtml } from './views/list.js';
import { detailHtml } from './views/detail.js';
import { calendarHtml } from './views/calendar.js';
import { initChooser } from './ui/chooser.js';
import { initMedForm, openMedForm } from './ui/medForm.js';
import { initExtraForm, openExtraForm } from './ui/extraForm.js';
import { initBackfillForm, openBackfill } from './ui/backfillForm.js';
import { initNewBoxForm } from './ui/newBoxForm.js';
import { initCloudSync } from './cloudSync.js';
import { initPushUi } from './pushUi.js';
import { checkReminders, startReminderLoop } from './reminderLoop.js';

const app = document.getElementById('app');
const backBtn = document.getElementById('back');
const addBtn = document.getElementById('add');
const tabs = document.querySelectorAll('.tab');

// A new screen starts at the top; otherwise it opens at the old scroll position,
// which on a phone looks like the page jumped in "zoomed" and half-way down.
let lastScreen = '';
function scrollOnScreenChange() {
  const screen = `${state.view}:${state.openId || ''}`;
  if (screen !== lastScreen) {
    lastScreen = screen;
    window.scrollTo(0, 0);
  }
}

// Redrawing replaces every element, which would drop keyboard focus. Remember which day
// button or chart row had it and give focus back to the new copy.
function focusSelector() {
  const el = document.activeElement;
  if (!el || !app.contains(el) || !el.dataset?.day) return null;
  return el.matches('g') ? `g[data-day="${el.dataset.day}"]` : `button.cal-day[data-day="${el.dataset.day}"]`;
}

function render() {
  const refocus = focusSelector();
  const m = currentMed();
  if (state.openId && !m) state.openId = null;
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.view === state.view));

  if (state.view === 'calendar') {
    backBtn.hidden = true;
    addBtn.hidden = false;
    app.innerHTML = calendarHtml();
  } else {
    backBtn.hidden = !m;
    addBtn.hidden = !!m;
    app.innerHTML = m ? detailHtml(m) : listHtml();
  }
  scrollOnScreenChange();
  if (refocus) app.querySelector(refocus)?.focus({ preventScroll: true });
}

app.addEventListener('click', handleAppClick);
// Chart rows are focusable groups; keyboard users select a day with Enter or Space.
app.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('g[data-day]')) {
    e.preventDefault();
    e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
});

backBtn.addEventListener('click', () => {
  state.openId = null;
  refresh();
});

tabs.forEach((tab) => tab.addEventListener('click', () => {
  state.view = tab.dataset.view;
  if (state.view === 'meds') state.openId = null;
  refresh();
}));

initChooser(addBtn, { openMedForm, openExtraForm, openBackfill });
initMedForm();
initExtraForm();
initBackfillForm();
initNewBoxForm();
// Registered before the render listener so a change is pushed first, then drawn.
initCloudSync();
initPushUi();
on('commit', render);
on('refresh', render);

render();
checkReminders();
startReminderLoop();
