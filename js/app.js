import {
  QUARTERS, load, save, newId, totalQ, consumedQ, remainingQ, cellQuarters,
  takenTodayQ, daysLeft, formatPills, startQuarters, loadMeta, saveMeta, normalizeMed,
  loadExtras, saveExtras,
} from './store.js';
import {
  parseTimes, pendingTimes, unnotifiedTimes, dayKey, resolveTakeTime, dayComplete,
} from './reminders.js';
import { decideSync, mergeMeds, mergeExtras } from './sync.js';
import {
  EXTRA_KINDS, KIND_LABELS, DAY_NAMES, addDays, startOfWeek, buildEntries, groupByDay,
  dayKinds, monthEntries, recentExtras, resolveExtraTime,
} from './history.js';
import * as cloud from './cloud.js';

const app = document.getElementById('app');
const backBtn = document.getElementById('back');
const addBtn = document.getElementById('add');
const dialog = document.getElementById('form-dialog');
const form = document.getElementById('med-form');
const formError = document.getElementById('form-error');

let meds = load().map(normalizeMed);
let extras = loadExtras(); // free-form drinks: vitamins, herbal teas, ...
let view = 'meds'; // 'meds' | 'calendar'
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDay = null; // 'YYYY-MM-DD' or null for the whole month
let meta = loadMeta(); // { updatedAt, uid } for cloud sync
let cloudUser = null;
let cloudStatus = ''; // short text shown in the cloud bar
let openId = null; // id of the medicine shown in the detail view
let editingId = null; // id being edited in the form, null when adding

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function commit() {
  save(meds);
  saveExtras(extras);
  meta = { ...meta, updatedAt: Date.now() };
  saveMeta(meta);
  pushToCloud();
  render();
}

// ---- Pill cell drawing -------------------------------------------------

// One pill: a circle whose remaining share is drawn as a filled pie.
function pillSvg(usedQ) {
  const left = QUARTERS - usedQ;
  if (left === QUARTERS) {
    return '<svg viewBox="0 0 20 20" class="pill"><circle cx="10" cy="10" r="8.5" class="pill-full"/></svg>';
  }
  if (left === 0) {
    return '<svg viewBox="0 0 20 20" class="pill"><circle cx="10" cy="10" r="8.5" class="pill-empty"/></svg>';
  }
  // Remaining part is a pie slice that starts at 12 o'clock and runs clockwise.
  const angle = (left / QUARTERS) * Math.PI * 2;
  const x = 10 + 8.5 * Math.sin(angle);
  const y = 10 - 8.5 * Math.cos(angle);
  const large = left > QUARTERS / 2 ? 1 : 0;
  return `<svg viewBox="0 0 20 20" class="pill">
    <circle cx="10" cy="10" r="8.5" class="pill-empty"/>
    <path d="M10 10 L10 1.5 A8.5 8.5 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" class="pill-full"/>
  </svg>`;
}

function blisterHtml(m, b) {
  const cells = [];
  for (let p = 0; p < m.perBlister; p++) {
    const index = b * m.perBlister + p;
    cells.push(`<div class="cell" title="${b + 1}. blister, ${p + 1}. hap">${pillSvg(cellQuarters(m, index))}</div>`);
  }
  const left = Math.max(0, totalBlisterLeft(m, b));
  return `<div class="blister">
    <div class="blister-head"><span>${b + 1}. blister</span><span>${formatPills(left)} kaldı</span></div>
    <div class="cells">${cells.join('')}</div>
  </div>`;
}

function totalBlisterLeft(m, b) {
  let left = 0;
  for (let p = 0; p < m.perBlister; p++) {
    left += QUARTERS - cellQuarters(m, b * m.perBlister + p);
  }
  return left;
}

// ---- Views -------------------------------------------------------------

// Banner for every medicine whose reminder time has passed without a logged dose.
function dueBannerHtml() {
  return meds.filter((m) => pendingTimes(m).length && remainingQ(m) > 0).map((m) => (
    `<button class="banner" data-open="${esc(m.id)}">Alma zamanı: <b>${esc(m.name)}</b> · ${formatPills(m.dose)} hap</button>`
  )).join('');
}

const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });

// Card for logging things outside the tracked medicines: one tap for recent ones.
function extrasCardHtml() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = extras.filter((x) => x.t >= startOfToday.getTime()).sort((a, b) => a.t - b.t);
  const chips = recentExtras(extras).map((r) => (
    `<button class="chip" data-extra-quick="${esc(r.name)}" data-kind="${esc(r.kind)}">${esc(r.name)}</button>`
  )).join('');
  return `<section class="card extras">
    <h2>Başka bir şey içtim</h2>
    <p class="med-sub">Vitamin, bitki çayı gibi ilaç dışı şeyleri de kaydet.</p>
    ${today.length ? `<ul class="today-log">${today.map((x) => `<li>${timeFmt.format(new Date(x.t))} · ${esc(x.name)}</li>`).join('')}</ul>` : ''}
    ${chips ? `<div class="chips wrap">${chips}</div>` : ''}
    <button class="btn ghost full" data-extra-add>+ Yeni kayıt</button>
  </section>`;
}

function renderList() {
  const empty = meds.length ? '' : `<div class="empty card">
      <h2>Henüz ilaç yok</h2>
      <p>Sağ üstteki <b>+</b> ile ilk ilacını ekle. Kutudaki blister ve hap sayısını gir, kaldığın yerden başla.</p>
    </div>`;
  app.innerHTML = dueBannerHtml() + empty + meds.map((m) => {
    const pct = Math.round((remainingQ(m) / totalQ(m)) * 100);
    return `<button class="card med" data-open="${esc(m.id)}">
      <div class="med-row"><strong>${esc(m.name)}</strong><span>${formatPills(remainingQ(m))} hap</span></div>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <div class="med-sub">~${daysLeft(m)} gün yeter</div>
    </button>`;
  }).join('') + extrasCardHtml();
}

// ---- Calendar ----------------------------------------------------------

const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

function entryRowHtml(e) {
  const removeAttr = e.medId ? `data-remove-med="${esc(e.medId)}"` : `data-remove-extra="${esc(e.extraId)}"`;
  return `<div class="card entry kind-${e.kind}">
    <span class="entry-time">${timeFmt.format(new Date(e.t))}</span>
    <div class="entry-main"><strong>${esc(e.name)}</strong><span class="med-sub">${esc(e.detail)}</span></div>
    <button class="icon-btn mini" ${removeAttr} data-t="${e.t}" aria-label="Kaydı sil">&times;</button>
  </div>`;
}

function renderCalendarView() {
  const entries = buildEntries(meds, extras);
  const byDay = groupByDay(entries);
  const y = calMonth.getFullYear();
  const m = calMonth.getMonth();
  const now = new Date();
  const todayKey = dayKey(now);
  const lastDay = new Date(y, m + 1, 0);
  const atCurrentMonth = y === now.getFullYear() && m === now.getMonth();

  let grid = DAY_NAMES.map((d) => `<span class="cal-dow">${d}</span>`).join('');
  for (let w = startOfWeek(calMonth); w <= lastDay; w = addDays(w, 7)) {
    for (let i = 0; i < 7; i++) {
      const d = addDays(w, i);
      const k = dayKey(d);
      const items = byDay.get(k) || [];
      const cls = ['cal-day', d.getMonth() !== m ? 'out' : '', items.length ? 'has' : '',
        k === todayKey ? 'today' : '', k === selectedDay ? 'selected' : ''].join(' ');
      const dots = dayKinds(items).map((kind) => `<i class="dot-${kind}"></i>`).join('');
      const label = `${dayFmt.format(d)}${items.length ? `, ${items.length} kayıt` : ''}`;
      grid += `<button type="button" class="${cls}" data-day="${k}" aria-label="${label}">
        <span>${d.getDate()}</span><span class="dots">${dots}</span></button>`;
    }
  }

  const monthList = monthEntries(entries, y, m);
  const days = new Set(monthList.map((e) => e.key)).size;
  const shown = selectedDay ? (byDay.get(selectedDay) || []) : monthList;
  const title = selectedDay ? dayFmt.format(new Date(`${selectedDay}T12:00:00`)) : `${monthFmt.format(calMonth)} kayıtları`;

  app.innerHTML = `
    <section class="card calendar">
      <div class="cal-head">
        <button type="button" class="icon-btn" data-cal="prev" aria-label="Önceki ay">&#8249;</button>
        <h3>${monthFmt.format(calMonth)}</h3>
        <button type="button" class="icon-btn" data-cal="next" aria-label="Sonraki ay" ${atCurrentMonth ? 'disabled' : ''}>&#8250;</button>
      </div>
      <div class="cal-grid">${grid}</div>
      <div class="cal-legend">
        ${Object.entries(KIND_LABELS).map(([k, label]) => `<span><i class="dot-${k}"></i>${label}</span>`).join('')}
      </div>
      <p class="cal-summary">${monthList.length ? `<b>${monthList.length}</b> kayıt · <b>${days}</b> gün` : 'Bu ay henüz kayıt yok.'}</p>
    </section>

    <div class="list-head">
      <h2 class="section-title">${title}</h2>
      ${selectedDay ? '<button type="button" class="chip" data-cal="all">Tüm ay</button>' : ''}
    </div>
    <button class="btn ghost full" data-extra-add>+ Bir şey içtim</button>
    ${shown.length ? shown.map((e) => (selectedDay ? '' : dayHeading(e, shown)) + entryRowHtml(e)).join('')
      : `<p class="empty-note">${entries.length ? 'Bu tarihte kayıt yok.' : 'Henüz kayıt yok. İlaç aldığında ya da bir şey içtiğinde burada görünür.'}</p>`}`;
}

// In the month list, print the day once above its first entry.
function dayHeading(e, list) {
  const first = list.find((x) => x.key === e.key);
  return first === e ? `<h3 class="day-heading">${dayFmt.format(new Date(e.t))}</h3>` : '';
}

function renderDetail(m) {
  const perDayQ = m.dose * m.perDay;
  const todayQ = takenTodayQ(m);
  const doneToday = todayQ >= perDayQ;
  const finished = remainingQ(m) === 0;
  const end = new Date();
  end.setDate(end.getDate() + daysLeft(m));

  app.innerHTML = `
    <section class="card summary">
      <h2>${esc(m.name)}</h2>
      <div class="big">${formatPills(remainingQ(m))}<small> / ${formatPills(totalQ(m))} hap</small></div>
      <div class="med-sub">Günlük ${formatPills(perDayQ)} hap · ~${daysLeft(m)} gün yeter${finished ? '' : ` (${end.toLocaleDateString('tr-TR')})`}</div>
      <div class="today ${doneToday ? 'done' : ''}">Bugün: ${formatPills(todayQ)} / ${formatPills(perDayQ)} hap</div>
      ${m.times.length ? `<div class="med-sub">Hatırlatma: ${m.times.join(', ')}${reminderNote()}</div>` : ''}
    </section>

    <section class="card intake">
      <label class="take-time">Aldığın saat (boşsa şu an)
        <input id="take-time" type="time">
      </label>
      <button class="btn primary big-btn" data-take="${m.dose}" ${finished ? 'disabled' : ''}>
        Aldım · ${formatPills(m.dose)} hap
      </button>
      <div class="chips">
        <button class="chip" data-take="1" ${finished ? 'disabled' : ''}>¼</button>
        <button class="chip" data-take="2" ${finished ? 'disabled' : ''}>½</button>
        <button class="chip" data-take="4" ${finished ? 'disabled' : ''}>1</button>
        <button class="chip ghost" data-undo ${m.log.length ? '' : 'disabled'}>Geri al</button>
      </div>
      ${todayLogHtml(m)}
    </section>

    <section class="blisters">
      ${Array.from({ length: m.blisters }, (_, b) => blisterHtml(m, b)).join('')}
    </section>

    <div class="actions">
      <button class="btn ghost" data-edit>Düzenle</button>
      <button class="btn danger" data-delete>Sil</button>
    </div>`;
}

function reminderNote() {
  if (!('Notification' in window)) return ' (bu tarayıcı bildirimi desteklemiyor)';
  if (Notification.permission === 'denied') return ' (bildirim izni kapalı)';
  return '';
}

function render() {
  const m = meds.find((x) => x.id === openId);
  if (openId && !m) openId = null;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  if (view === 'calendar') {
    backBtn.hidden = true;
    addBtn.hidden = true;
    renderCalendarView();
    return;
  }
  backBtn.hidden = !m;
  addBtn.hidden = !!m;
  if (m) renderDetail(m); else renderList();
}

// ---- Actions -----------------------------------------------------------

// Today's intakes, oldest first, so a wrong time is easy to spot.
function todayLogHtml(m) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = m.log.filter((e) => e.t >= start.getTime()).sort((a, b) => a.t - b.t);
  if (!today.length) return '';
  const rows = today.map((e) => {
    const time = new Date(e.t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    return `<li>${time} · ${formatPills(e.q)} hap</li>`;
  });
  return `<ul class="today-log">${rows.join('')}</ul>`;
}

function take(m, q) {
  const amount = Math.min(q, remainingQ(m));
  if (amount <= 0) return;
  // Today's dose is already complete: ask before logging an extra one.
  if (dayComplete(m) && !confirm('Bugünkü dozunu zaten aldın. Yine de bir doz daha kaydedilsin mi?')) return;
  const input = document.getElementById('take-time');
  m.log.push({ t: resolveTakeTime(input ? input.value : ''), q: amount });
  commit();
}

app.addEventListener('click', (e) => {
  const target = e.target.closest('button');
  if (!target) return;
  const m = meds.find((x) => x.id === openId);

  if ('extraAdd' in target.dataset) {
    openExtraForm();
  } else if (target.dataset.extraQuick) {
    extras.push({ id: newId(), name: target.dataset.extraQuick, kind: target.dataset.kind, t: Date.now() });
    commit();
  } else if (target.dataset.day) {
    selectedDay = selectedDay === target.dataset.day ? null : target.dataset.day;
    const d = new Date(`${target.dataset.day}T12:00:00`);
    if (d.getMonth() !== calMonth.getMonth()) calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    render();
  } else if (target.dataset.cal) {
    const step = { prev: -1, next: 1 }[target.dataset.cal];
    if (step) calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + step, 1);
    selectedDay = null;
    render();
  } else if (target.dataset.removeExtra) {
    if (confirm('Bu kayıt silinsin mi?')) {
      extras = extras.filter((x) => x.id !== target.dataset.removeExtra);
      commit();
    }
  } else if (target.dataset.removeMed) {
    const med = meds.find((x) => x.id === target.dataset.removeMed);
    const at = med && med.log.findIndex((e) => e.t === Number(target.dataset.t));
    if (med && at >= 0 && confirm('Bu alış silinsin mi? Kalan hap sayısı güncellenir.')) {
      med.log.splice(at, 1);
      commit();
    }
  } else if (target.dataset.open) {
    openId = target.dataset.open;
    render();
  } else if (m && target.dataset.take) {
    take(m, Number(target.dataset.take));
  } else if (m && 'undo' in target.dataset) {
    m.log.pop();
    commit();
  } else if (m && 'edit' in target.dataset) {
    openForm(m);
  } else if (m && 'delete' in target.dataset) {
    if (confirm(`"${m.name}" silinsin mi?`)) {
      meds = meds.filter((x) => x.id !== m.id);
      openId = null;
      commit();
    }
  }
});

backBtn.addEventListener('click', () => {
  openId = null;
  render();
});
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  view = tab.dataset.view;
  if (view === 'meds') openId = null;
  render();
}));
addBtn.addEventListener('click', () => openForm(null));
document.getElementById('form-cancel').addEventListener('click', () => dialog.close());

const timeRows = document.getElementById('time-rows');
const addTimeBtn = document.getElementById('add-time');
const MAX_TIMES = 6;

function addTimeRow(value = '') {
  const row = document.createElement('div');
  row.className = 'time-row';
  row.innerHTML = '<input type="time" aria-label="Hatırlatma saati">'
    + '<button type="button" class="icon-btn mini" aria-label="Saati sil">&times;</button>';
  row.querySelector('input').value = value;
  timeRows.append(row);
  addTimeBtn.hidden = timeRows.children.length >= MAX_TIMES;
}

addTimeBtn.addEventListener('click', () => addTimeRow());
timeRows.addEventListener('click', (e) => {
  const remove = e.target.closest('button');
  if (!remove) return;
  remove.parentElement.remove();
  addTimeBtn.hidden = false;
});

function openForm(m) {
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
    // Position fields describe the current state: the pill in use right now.
    const used = consumedQ(m);
    const pillIndex = Math.min(Math.floor(used / QUARTERS), totalQ(m) / QUARTERS - 1);
    form.curBlister.value = Math.floor(pillIndex / m.perBlister) + 1;
    form.curPill.value = (pillIndex % m.perBlister) + 1;
    const partUsed = used - pillIndex * QUARTERS;
    form.curPart.value = partUsed === 0 ? 0 : QUARTERS - partUsed;
  }
  dialog.showModal();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const blisters = Number(form.blisters.value);
  const perBlister = Number(form.perBlister.value);
  const curBlister = Number(form.curBlister.value);
  const curPill = Number(form.curPill.value);
  const partLeft = Number(form.curPart.value);

  if (curBlister > blisters || curPill > perBlister) {
    formError.textContent = 'Kaldığın yer, kutudaki blister ve hap sayısını aşıyor.';
    formError.hidden = false;
    return;
  }

  const fields = {
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

  if (editingId) {
    const m = meds.find((x) => x.id === editingId);
    // Keep the intake history (and today's count) unless the position itself changed.
    const positionChanged = fields.startQ !== consumedQ(m);
    const log = positionChanged ? [] : m.log;
    const startQ = positionChanged ? fields.startQ : m.startQ;
    Object.assign(m, fields, { startQ, log });
  } else {
    meds.push({ id: newId(), ...fields, log: [] });
  }
  // Asking from the submit handler keeps the permission prompt tied to a user gesture.
  if (fields.times.length && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
  dialog.close();
  commit();
  checkReminders();
});

// ---- Free-form drinks --------------------------------------------------

const extraDialog = document.getElementById('extra-dialog');
const extraForm = document.getElementById('extra-form');
const SUGGESTIONS = ['C vitamini', 'D vitamini', 'B12 vitamini', 'Magnezyum', 'Omega 3', 'Papatya çayı',
  'Ihlamur', 'Adaçayı', 'Rezene çayı', 'Yeşil çay', 'Nane limon'];
const pad2 = (n) => String(n).padStart(2, '0');

function openExtraForm() {
  extraForm.reset();
  const now = new Date();
  extraForm.date.max = dayKey(now);
  // The calendar's selected day pre-fills the date so older days are easy to fill in.
  extraForm.date.value = view === 'calendar' && selectedDay ? selectedDay : dayKey(now);
  extraForm.time.value = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const names = new Set([...recentExtras(extras, 20).map((r) => r.name), ...SUGGESTIONS]);
  document.getElementById('extra-names').innerHTML = [...names].map((n) => `<option value="${esc(n)}">`).join('');
  extraDialog.showModal();
}

// Picking a name you used before also picks the kind you used for it.
extraForm.name.addEventListener('input', () => {
  const known = recentExtras(extras, 100).find((r) => r.name.toLowerCase() === extraForm.name.value.trim().toLowerCase());
  if (known) extraForm.kind.value = known.kind;
});

document.getElementById('extra-cancel').addEventListener('click', () => extraDialog.close());

extraForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const kind = EXTRA_KINDS[extraForm.kind.value] ? extraForm.kind.value : 'other';
  extras.push({
    id: newId(),
    name: extraForm.name.value.trim(),
    kind,
    t: resolveExtraTime(extraForm.date.value, extraForm.time.value),
  });
  extraDialog.close();
  commit();
});

// ---- Reminders ---------------------------------------------------------

async function notify(m, time) {
  const title = `${m.name} zamanı`;
  const options = {
    body: `${formatPills(m.dose)} hap · ${time}`,
    icon: 'icons/icon-192.png',
    tag: `dozi-${m.id}-${time}`,
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    // Fall back to a page notification below.
  }
  new Notification(title, options);
}

function checkReminders() {
  const now = new Date();
  let changed = false;
  for (const m of meds) {
    if (remainingQ(m) === 0) continue;
    for (const t of unnotifiedTimes(m, now)) {
      if ('Notification' in window && Notification.permission === 'granted') {
        notify(m, t).catch(() => {});
        m.fired = { ...m.fired, [t]: dayKey(now) };
        changed = true;
      }
    }
  }
  if (changed) save(meds);
  // The "time to take" banner depends on the clock. Re-render only when it changes,
  // so a time typed into the intake field is never wiped by the timer.
  const key = dueKey();
  if (key !== lastDueKey) {
    lastDueKey = key;
    if (view === 'meds' && !openId && !dialog.open && !extraDialog.open) render();
  }
}

let lastDueKey = null;
const dueKey = () => meds.filter((m) => pendingTimes(m).length && remainingQ(m) > 0).map((m) => m.id).join(',');

setInterval(checkReminders, 30000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkReminders();
});

// ---- Cloud backup ------------------------------------------------------

const cloudBar = document.getElementById('cloud-bar');

function renderCloudBar() {
  if (!cloud.available) return;
  cloudBar.hidden = false;
  if (!cloudUser) {
    cloudBar.innerHTML = `<span>${esc(cloudStatus || 'Verilerin kaybolmasın: hesabınla yedekle')}</span>
      <button class="btn primary small" data-cloud="in">Google ile giriş</button>`;
    return;
  }
  cloudBar.innerHTML = `<span>&#9729; ${esc(cloudUser.email || 'Giriş yapıldı')} · ${esc(cloudStatus || 'yedekleniyor')}</span>
    <button class="btn ghost small" data-cloud="out">Çıkış</button>`;
}

function setCloudStatus(text) {
  cloudStatus = text;
  renderCloudBar();
}

async function pushToCloud() {
  if (!cloudUser) return;
  try {
    await cloud.pushData(cloudUser.uid, { meds, extras }, meta.updatedAt);
    meta = { ...meta, uid: cloudUser.uid };
    saveMeta(meta);
    setCloudStatus('yedeklendi');
  } catch {
    // The Firestore SDK keeps the write queued and retries once we are online.
    setCloudStatus('yedekleme bekliyor');
  }
}

function applyRemote(remote) {
  const decision = decideSync({
    localUpdated: meta.updatedAt,
    localSynced: meta.uid === cloudUser.uid,
    localCount: meds.length + extras.length,
    remote: remote && { meds: remote.meds || [], extras: remote.extras || [], updatedAt: Number(remote.updatedAt) || 0 },
  });
  if (decision === 'pull') {
    meds = (remote.meds || []).map(normalizeMed);
    extras = remote.extras || [];
    save(meds);
    saveExtras(extras);
    meta = { updatedAt: Number(remote.updatedAt) || 0, uid: cloudUser.uid };
    saveMeta(meta);
    setCloudStatus('yedekten yüklendi');
    render();
  } else if (decision === 'merge') {
    meds = mergeMeds(meds, (remote.meds || []).map(normalizeMed));
    extras = mergeExtras(extras, remote.extras || []);
    commit();
  } else if (decision === 'push') {
    pushToCloud();
  } else {
    meta = { ...meta, uid: cloudUser.uid };
    saveMeta(meta);
    setCloudStatus('yedeklendi');
  }
}

cloudBar.addEventListener('click', async (e) => {
  const action = e.target.closest('button')?.dataset.cloud;
  try {
    if (action === 'in') await cloud.signIn();
    if (action === 'out') await cloud.signOut();
  } catch {
    setCloudStatus('giriş yapılamadı');
  }
});

renderCloudBar();
cloud.startCloud({
  onUser(user) {
    cloudUser = user;
    cloudStatus = user ? 'bağlanıyor' : '';
    renderCloudBar();
  },
  onRemote: applyRemote,
  onError() {
    setCloudStatus('bağlantı kurulamadı');
  },
});

render();
checkReminders();
