// Entry point: draws the current screen and wires the top-level controls.
import { state, on, currentMed, refresh } from './state.js';
import { handleAppClick } from './actions.js';
import { listHtml } from './views/list.js';
import { detailHtml } from './views/detail.js';
import { calendarHtml } from './views/calendar.js';
import { initChooser } from './ui/chooser.js';
import { initMedForm, openMedForm } from './ui/medForm.js';
import { initExtraForm, openExtraForm } from './ui/extraForm.js';
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

function render() {
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
}

app.addEventListener('click', handleAppClick);

backBtn.addEventListener('click', () => {
  state.openId = null;
  refresh();
});

tabs.forEach((tab) => tab.addEventListener('click', () => {
  state.view = tab.dataset.view;
  if (state.view === 'meds') state.openId = null;
  refresh();
}));

initChooser(addBtn, { openMedForm, openExtraForm });
initMedForm();
initExtraForm();
// Registered before the render listener so a change is pushed first, then drawn.
initCloudSync();
initPushUi();
on('commit', render);
on('refresh', render);

render();
checkReminders();
startReminderLoop();
