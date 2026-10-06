import {
  QUARTERS, load, save, newId, totalQ, consumedQ, remainingQ, cellQuarters,
  takenTodayQ, daysLeft, formatPills, startQuarters,
} from './store.js';
import {
  parseTimes, pendingTimes, unnotifiedTimes, dayKey, resolveTakeTime, dayComplete,
} from './reminders.js';

const app = document.getElementById('app');
const backBtn = document.getElementById('back');
const addBtn = document.getElementById('add');
const dialog = document.getElementById('form-dialog');
const form = document.getElementById('med-form');
const formError = document.getElementById('form-error');

// Older saved data has no reminder fields, so fill in defaults.
let meds = load().map((m) => ({ times: [], fired: {}, ...m }));
let openId = null; // id of the medicine shown in the detail view
let editingId = null; // id being edited in the form, null when adding

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function commit() {
  save(meds);
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

function renderList() {
  if (!meds.length) {
    app.innerHTML = `<div class="empty card">
      <h2>Henüz ilaç yok</h2>
      <p>Sağ üstteki <b>+</b> ile ilk ilacını ekle. Kutudaki blister ve hap sayısını gir, kaldığın yerden başla.</p>
    </div>`;
    return;
  }
  app.innerHTML = dueBannerHtml() + meds.map((m) => {
    const pct = Math.round((remainingQ(m) / totalQ(m)) * 100);
    return `<button class="card med" data-open="${esc(m.id)}">
      <div class="med-row"><strong>${esc(m.name)}</strong><span>${formatPills(remainingQ(m))} hap</span></div>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <div class="med-sub">~${daysLeft(m)} gün yeter</div>
    </button>`;
  }).join('');
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
      <label class="take-time">Ne zaman aldın? (boş bırakırsan şu an kaydedilir)
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

  if (target.dataset.open) {
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
addBtn.addEventListener('click', () => openForm(null));
document.getElementById('form-cancel').addEventListener('click', () => dialog.close());

function openForm(m) {
  editingId = m ? m.id : null;
  document.getElementById('form-title').textContent = m ? 'İlacı düzenle' : 'Yeni ilaç';
  formError.hidden = true;
  form.reset();
  if (m) {
    form.name.value = m.name;
    form.blisters.value = m.blisters;
    form.perBlister.value = m.perBlister;
    form.dose.value = m.dose;
    form.perDay.value = m.perDay;
    m.times.forEach((t, i) => { form[`time${i}`].value = t; });
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
    times: parseTimes([form.time0.value, form.time1.value, form.time2.value]),
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
  // Pending banners depend on the clock, so refresh the view when idle.
  if (!dialog.open) render();
}

setInterval(checkReminders, 30000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkReminders();
});

render();
checkReminders();
