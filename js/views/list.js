// The medicine list: the "time to take" banner plus one card per medicine.
import { state } from '../state.js';
import { totalQ, remainingQ, daysLeft, formatPills } from '../store.js';
import { dueMeds } from '../reminders.js';
import { esc } from '../html.js';

// Banner for every medicine whose reminder time has passed without a logged dose.
function dueBannerHtml() {
  return dueMeds(state.meds).map((m) => (
    `<button class="banner" data-open="${esc(m.id)}">Alma zamanı: <b>${esc(m.name)}</b> · ${formatPills(m.dose)} hap</button>`
  )).join('');
}

const EMPTY = `<div class="empty card">
      <h2>Henüz ilaç yok</h2>
      <p>Sağ üstteki <b>+</b> ile ilk ilacını ekle. Kutudaki blister ve hap sayısını gir, kaldığın yerden başla. Vitamin ya da bitki çayı gibi şeyleri de aynı yerden kaydedebilirsin.</p>
    </div>`;

function medCardHtml(m) {
  const pct = Math.round((remainingQ(m) / totalQ(m)) * 100);
  return `<button class="card med" data-open="${esc(m.id)}">
      <div class="med-row"><strong>${esc(m.name)}</strong><span>${formatPills(remainingQ(m))} hap</span></div>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <div class="med-sub">~${daysLeft(m)} gün yeter</div>
    </button>`;
}

export function listHtml() {
  const empty = state.meds.length ? '' : EMPTY;
  return dueBannerHtml() + empty + state.meds.map(medCardHtml).join('');
}
