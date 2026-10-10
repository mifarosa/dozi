// The calendar tab: month grid with one dot per kind of entry, then the entries.
import { state } from '../state.js';
import {
  KIND_LABELS, buildEntries, groupByDay, dayKinds, monthEntries,
} from '../history.js';
import {
  dayKey, addDays, startOfWeek, dayFmt, monthFmt, formatTime, DAY_NAMES,
} from '../dates.js';
import { esc } from '../html.js';
import { monthRows, hasMarks } from '../timeline.js';
import { timeChartHtml } from './timeChart.js';

function entryRowHtml(e) {
  const removeAttr = e.medId ? `data-remove-med="${esc(e.medId)}"` : `data-remove-extra="${esc(e.extraId)}"`;
  return `<div class="card entry kind-${e.kind}">
    <span class="entry-time">${formatTime(e.t)}</span>
    <div class="entry-main"><strong>${esc(e.name)}</strong><span class="med-sub">${esc(e.detail)}</span></div>
    <button class="icon-btn mini" ${removeAttr} data-t="${e.t}" aria-label="Kaydı sil">&times;</button>
  </div>`;
}

// In the month list, print the day once above its first entry.
function dayHeading(e, list) {
  const first = list.find((x) => x.key === e.key);
  return first === e ? `<h3 class="day-heading">${dayFmt.format(new Date(e.t))}</h3>` : '';
}

// A forgotten dose can be added to any day up to today, when there is a medicine to add it to.
const canBackfill = (day, now) => Boolean(day) && day <= dayKey(now) && state.meds.length > 0;

function gridHtml(byDay, now) {
  const { calMonth, selectedDay } = state;
  const m = calMonth.getMonth();
  const todayKey = dayKey(now);
  const lastDay = new Date(calMonth.getFullYear(), m + 1, 0);

  let grid = DAY_NAMES.map((d) => `<span class="cal-dow">${d}</span>`).join('');
  for (let w = startOfWeek(calMonth); w <= lastDay; w = addDays(w, 7)) {
    for (let i = 0; i < 7; i++) {
      const d = addDays(w, i);
      const k = dayKey(d);
      const items = byDay.get(k) || [];
      const cls = ['cal-day', d.getMonth() !== m ? 'out' : '', items.length ? 'has' : '',
        k === todayKey ? 'is-today' : '', k === selectedDay ? 'selected' : ''].join(' ');
      const dots = dayKinds(items).map((kind) => `<i class="dot-${kind}"></i>`).join('');
      const label = `${dayFmt.format(d)}${items.length ? `, ${items.length} kayıt` : ''}`;
      grid += `<button type="button" class="${cls}" data-day="${k}" aria-label="${label}">
        <span>${d.getDate()}</span><span class="dots">${dots}</span></button>`;
    }
  }
  return grid;
}

// Hour-of-day chart for the visible month, covering medicines and drinks alike.
function chartCardHtml(entries, now) {
  const { calMonth, selectedDay } = state;
  const rows = monthRows(entries, calMonth.getFullYear(), calMonth.getMonth(), now);
  const body = hasMarks(rows)
    ? timeChartHtml({
      rows,
      selectedDay,
      todayKey: dayKey(now),
      kinds: Object.keys(KIND_LABELS),
      label: `Saat çizelgesi, ${monthFmt.format(calMonth)}`,
    })
    : '<p class="empty-note">Bu ay çizelge için kayıt yok.</p>';
  return `<section class="card chart-card">
      <h2 class="section-title">Saat çizelgesi</h2>
      <p class="med-sub">Her satır bir gün, noktalar o gün kaçta kaydettiğini gösterir. Bir güne dokun.</p>
      ${body}
    </section>`;
}

export function calendarHtml() {
  const { calMonth, selectedDay } = state;
  const entries = buildEntries(state.meds, state.extras);
  const byDay = groupByDay(entries);
  const y = calMonth.getFullYear();
  const m = calMonth.getMonth();
  const now = new Date();
  const atCurrentMonth = y === now.getFullYear() && m === now.getMonth();

  const monthList = monthEntries(entries, y, m);
  const days = new Set(monthList.map((e) => e.key)).size;
  const shown = selectedDay ? (byDay.get(selectedDay) || []) : monthList;
  const title = selectedDay ? dayFmt.format(new Date(`${selectedDay}T12:00:00`)) : `${monthFmt.format(calMonth)} kayıtları`;

  return `
    <section class="card calendar">
      <div class="cal-head">
        <button type="button" class="icon-btn" data-cal="prev" aria-label="Önceki ay">&#8249;</button>
        <h3>${monthFmt.format(calMonth)}</h3>
        <button type="button" class="icon-btn" data-cal="next" aria-label="Sonraki ay" ${atCurrentMonth ? 'disabled' : ''}>&#8250;</button>
      </div>
      <div class="cal-grid">${gridHtml(byDay, now)}</div>
      <div class="cal-legend">
        ${Object.entries(KIND_LABELS).map(([k, label]) => `<span><i class="dot-${k}"></i>${label}</span>`).join('')}
      </div>
      <p class="cal-summary">${monthList.length ? `<b>${monthList.length}</b> kayıt · <b>${days}</b> gün` : 'Bu ay henüz kayıt yok.'}</p>
    </section>

    ${chartCardHtml(entries, now)}

    <div class="list-head">
      <h2 class="section-title">${title}</h2>
      ${selectedDay ? '<button type="button" class="chip" data-cal="all">Tüm ay</button>' : ''}
    </div>
    ${canBackfill(selectedDay, now) ? `<button type="button" class="btn ghost small add-day" data-backfill-day="${selectedDay}">Bu güne doz ekle</button>` : ''}
    ${shown.length ? shown.map((e) => (selectedDay ? '' : dayHeading(e, shown)) + entryRowHtml(e)).join('')
      : `<p class="empty-note">${entries.length ? 'Bu tarihte kayıt yok.' : 'Henüz kayıt yok. İlaç aldığında ya da bir şey içtiğinde burada görünür.'}</p>`}`;
}
