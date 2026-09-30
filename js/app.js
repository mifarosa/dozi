import {
  QUARTERS, load, save, newId, totalQ, consumedQ, remainingQ, cellQuarters,
  takenTodayQ, daysLeft, formatPills, startQuarters,
} from './store.js';

const app = document.getElementById('app');
const backBtn = document.getElementById('back');
const addBtn = document.getElementById('add');
const dialog = document.getElementById('form-dialog');
const form = document.getElementById('med-form');
const formError = document.getElementById('form-error');

let meds = load();
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

function renderList() {
  if (!meds.length) {
    app.innerHTML = `<div class="empty card">
      <h2>Henüz ilaç yok</h2>
      <p>Sağ üstteki <b>+</b> ile ilk ilacını ekle. Kutudaki blister ve hap sayısını gir, kaldığın yerden başla.</p>
    </div>`;
    return;
  }
  app.innerHTML = meds.map((m) => {
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
    </section>

    <section class="card intake">
      <button class="btn primary big-btn" data-take="${m.dose}" ${finished ? 'disabled' : ''}>
        Aldım · ${formatPills(m.dose)} hap
      </button>
      <div class="chips">
        <button class="chip" data-take="1" ${finished ? 'disabled' : ''}>¼</button>
        <button class="chip" data-take="2" ${finished ? 'disabled' : ''}>½</button>
        <button class="chip" data-take="4" ${finished ? 'disabled' : ''}>1</button>
        <button class="chip ghost" data-undo ${m.log.length ? '' : 'disabled'}>Geri al</button>
      </div>
    </section>

    <section class="blisters">
      ${Array.from({ length: m.blisters }, (_, b) => blisterHtml(m, b)).join('')}
    </section>

    <div class="actions">
      <button class="btn ghost" data-edit>Düzenle</button>
      <button class="btn danger" data-delete>Sil</button>
    </div>`;
}

function render() {
  const m = meds.find((x) => x.id === openId);
  if (openId && !m) openId = null;
  backBtn.hidden = !m;
  addBtn.hidden = !!m;
  if (m) renderDetail(m); else renderList();
}

// ---- Actions -----------------------------------------------------------

function take(m, q) {
  const amount = Math.min(q, remainingQ(m));
  if (amount <= 0) return;
  m.log.push({ t: Date.now(), q: amount });
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
  dialog.close();
  commit();
});

render();
