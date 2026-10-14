// The calendar tab: a month grid with one dot per kind of entry, then ONE week below it
// (Monday first): its hour chart and its entries. Tapping a day opens that day in its own card.
import { state } from '../state.js';
import {
  KIND_LABELS, buildEntries, groupByDay, dayKinds, monthEntries,
} from '../history.js';
import {
  dayKey, addDays, startOfWeek, dayFmt, monthFmt, formatTime, DAY_NAMES,
} from '../dates.js';
import { esc } from '../html.js';
import { weekRows, hasMarks } from '../timeline.js';
import {
  resolveWeek, weekLabel, entriesInWeek, inWeek,
} from '../week.js';
import { timeChartHtml } from './timeChart.js';

const removeButton = (e) => {
  const attr = e.medId ? `data-remove-med="${esc(e.medId)}"` : `data-remove-extra="${esc(e.extraId)}"`;
  return `<button class="icon-btn mini" ${attr} data-t="${e.t}" aria-label="Kaydı sil">&times;</button>`;
};

// A card per entry, used by the week list.
function entryRowHtml(e) {
  return `<div class="card entry kind-${e.kind}">
    <span class="entry-time">${formatTime(e.t)}</span>
    <div class="entry-main"><strong>${esc(e.name)}</strong><span class="med-sub">${esc(e.detail)}</span></div>
    ${removeButton(e)}
  </div>`;
}

// In the week list, print the day once above its first entry.
function dayHeading(e, list) {
  const first = list.find((x) => x.key === e.key);
  return first === e ? `<h3 class="day-heading">${dayFmt.format(new Date(e.t))}</h3>` : '';
}

// A forgotten dose can be added to any day up to today, when there is a medicine to add it to.
const canBackfill = (day, now) => Boolean(day) && day <= dayKey(now) && state.meds.length > 0;

function gridHtml(byDay, now, week) {
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
        k === todayKey ? 'is-today' : '', k === selectedDay ? 'selected' : '',
        inWeek(d, week.start) ? 'in-week' : ''].join(' ');
      const dots = dayKinds(items).map((kind) => `<i class="dot-${kind}"></i>`).join('');
      const label = `${dayFmt.format(d)}${items.length ? `, ${items.length} kayıt` : ''}`;
      grid += `<button type="button" class="${cls}" data-day="${k}" aria-label="${label}">
        <span>${d.getDate()}</span><span class="dots">${dots}</span></button>`;
    }
  }
  return grid;
}

// "Bu hafta · 12–18 Ekim" with arrows. The next arrow stops at this week.
function weekHeadHtml(week) {
  return `<div class="week-head">
      <button type="button" class="icon-btn mini" data-week="prev" aria-label="Önceki hafta">&#8249;</button>
      <h2 class="section-title">${week.isCurrent ? 'Bu hafta' : 'Hafta'} · ${weekLabel(week.start)}</h2>
      <button type="button" class="icon-btn mini" data-week="next" aria-label="Sonraki hafta" ${week.isCurrent ? 'disabled' : ''}>&#8250;</button>
    </div>`;
}

// Hour-of-day chart for the week on screen, medicines and drinks alike.
function chartCardHtml(entries, now, week) {
  const rows = weekRows(entries, week.start, now);
  const body = hasMarks(rows)
    ? timeChartHtml({
      rows,
      selectedDay: state.selectedDay,
      todayKey: dayKey(now),
      kinds: Object.keys(KIND_LABELS),
      label: `Saat çizelgesi, ${weekLabel(week.start)}`,
    })
    : '<p class="empty-note">Bu hafta çizelge için kayıt yok.</p>';
  return `<section class="card chart-card">
      <h2 class="section-title">Saat çizelgesi</h2>
      <p class="med-sub">Her satır bir gün, noktalar o gün kaçta kaydettiğini gösterir. Bir güne dokun.</p>
      ${body}
    </section>`;
}

// The open day, in its own card so it never looks like part of the week list.
function dayCardHtml(day, items, now) {
  const title = dayFmt.format(new Date(`${day}T12:00:00`));
  const rows = items.slice().sort((a, b) => a.t - b.t).map((e) => `<li class="kind-${e.kind}">
      <span class="entry-time">${formatTime(e.t)}</span>
      <span class="day-item"><strong>${esc(e.name)}</strong><span class="med-sub">${esc(e.detail)}</span></span>
      ${removeButton(e)}
    </li>`).join('');
  return `<section class="card day-card" aria-label="Seçili gün: ${esc(title)}">
      <div class="day-card-head">
        <div><span class="day-badge">Seçili gün</span><h2>${title}</h2></div>
        <button type="button" class="chip" data-cal="week">Haftaya dön</button>
      </div>
      ${rows ? `<ul class="day-list">${rows}</ul>` : '<p class="empty-note">Bu günde kayıt yok.</p>'}
      ${canBackfill(day, now) ? `<button type="button" class="btn ghost small" data-backfill-day="${day}">Bu güne doz ekle</button>` : ''}
    </section>`;
}

// The week's entries, newest day first, each day with its heading.
function weekListHtml(entries, week) {
  const list = entriesInWeek(entries, week.start);
  if (!list.length) {
    return `<p class="empty-note">${entries.length ? 'Bu hafta kayıt yok.' : 'Henüz kayıt yok. İlaç aldığında ya da bir şey içtiğinde burada görünür.'}</p>`;
  }
  return list.map((e) => dayHeading(e, list) + entryRowHtml(e)).join('');
}

export function calendarHtml() {
  const { calMonth, selectedDay } = state;
  const entries = buildEntries(state.meds, state.extras);
  const byDay = groupByDay(entries);
  const now = new Date();
  const week = resolveWeek(state.weekStart, now);
  const atCurrentMonth = calMonth.getFullYear() === now.getFullYear() && calMonth.getMonth() === now.getMonth();

  const monthList = monthEntries(entries, calMonth.getFullYear(), calMonth.getMonth());
  const days = new Set(monthList.map((e) => e.key)).size;

  return `
    <section class="card calendar">
      <div class="cal-head">
        <button type="button" class="icon-btn" data-cal="prev" aria-label="Önceki ay">&#8249;</button>
        <h3>${monthFmt.format(calMonth)}</h3>
        <button type="button" class="icon-btn" data-cal="next" aria-label="Sonraki ay" ${atCurrentMonth ? 'disabled' : ''}>&#8250;</button>
      </div>
      <div class="cal-grid">${gridHtml(byDay, now, week)}</div>
      <div class="cal-legend">
        ${Object.entries(KIND_LABELS).map(([k, label]) => `<span><i class="dot-${k}"></i>${label}</span>`).join('')}
      </div>
      <p class="cal-summary">${monthList.length ? `<b>${monthList.length}</b> kayıt · <b>${days}</b> gün` : 'Bu ay henüz kayıt yok.'}</p>
    </section>

    ${weekHeadHtml(week)}
    ${chartCardHtml(entries, now, week)}
    ${selectedDay ? dayCardHtml(selectedDay, byDay.get(selectedDay) || [], now) : weekListHtml(entries, week)}`;
}
