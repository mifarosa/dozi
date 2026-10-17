// One medicine: summary, intake controls, today's intakes and the blisters.
import {
  totalQ, remainingQ, daysLeft, takenTodayQ, formatPills,
} from '../store.js';
import { t, pillsText, pillUnit } from '../i18n.js';
import { startOfDay, formatTime, dateFmt } from '../dates.js';
import { reminderNote } from '../notifications.js';
import { blisterHtml } from './pills.js';
import { timeChartHtml } from './timeChart.js';
import { esc } from '../html.js';
import { dayKey } from '../dates.js';
import { buildEntries } from '../history.js';
import { lastDaysRows, hasMarks } from '../timeline.js';

// Today's intakes, oldest first, so a wrong time is easy to spot.
function todayLogHtml(m) {
  const start = startOfDay(new Date()).getTime();
  const today = m.log.filter((e) => e.t >= start).sort((a, b) => a.t - b.t);
  if (!today.length) return '';
  const rows = today.map((e) => `<li>${formatTime(e.t)} · ${pillsText(e.q)}</li>`);
  return `<ul class="today-log">${rows.join('')}</ul>`;
}

// When this medicine was taken over the last two weeks, against its reminder times.
function takenChartHtml(m) {
  const now = new Date();
  const rows = lastDaysRows(buildEntries([m], []), 14, now, m.times);
  if (!hasMarks(rows)) return '';
  return `<section class="card chart-card">
      <h2 class="section-title">${t('detail.chartTitle')}</h2>
      ${timeChartHtml({
    rows, todayKey: dayKey(now), kinds: ['med'], planned: m.times.length > 0, label: t('detail.chartLabel', { name: m.name }),
  })}
    </section>`;
}

export function detailHtml(m) {
  const perDayQ = m.dose * m.perDay;
  const todayQ = takenTodayQ(m);
  const doneToday = todayQ >= perDayQ;
  const finished = remainingQ(m) === 0;
  const off = finished ? 'disabled' : '';
  const end = new Date();
  end.setDate(end.getDate() + daysLeft(m));

  return `
    <section class="card summary">
      <h2>${esc(m.name)}</h2>
      <div class="big">${formatPills(remainingQ(m))}<small> / ${pillsText(totalQ(m))}</small></div>
      <div class="med-sub">${t('detail.daily', { amount: pillsText(perDayQ) })} · ${t('list.daysLeft', { n: daysLeft(m) })}${finished ? '' : ` (${dateFmt.format(end)})`}${m.boxes.length ? ` · ${t('detail.boxNo', { n: m.boxes.length + 1 })}` : ''}</div>
      <div class="today ${doneToday ? 'done' : ''}">${t('detail.today', { a: formatPills(todayQ), b: formatPills(perDayQ), unit: pillUnit(perDayQ) })}</div>
      ${m.times.length ? `<div class="med-sub">${t('detail.reminder', { times: m.times.join(', '), note: reminderNote() })}</div>` : ''}
    </section>
${finished ? `
    <section class="card newbox">
      <p><b>${t('detail.boxFinishedBold')}</b>${t('detail.boxFinishedRest')}</p>
      <button class="btn primary small" data-newbox="${esc(m.id)}">${t('detail.switchBox')}</button>
    </section>` : ''}
    <section class="card intake">
      <label class="take-time">${t('detail.takeTime')}
        <input id="take-time" type="time">
      </label>
      <button class="btn primary big-btn" data-take="${m.dose}" ${off}>
        ${t('detail.take', { amount: pillsText(m.dose) })}
      </button>
      <div class="chips">
        <button class="chip" data-take="1" ${off}>¼</button>
        <button class="chip" data-take="2" ${off}>½</button>
        <button class="chip" data-take="4" ${off}>1</button>
        <button class="chip ghost" data-undo ${m.log.length ? '' : 'disabled'}>${t('detail.undo')}</button>
      </div>
      ${todayLogHtml(m)}
      <button class="btn ghost small backfill-btn" data-backfill="${esc(m.id)}">${t('detail.backfill')}</button>
    </section>

    ${takenChartHtml(m)}

    <section class="blisters">
      ${Array.from({ length: m.blisters }, (_, b) => blisterHtml(m, b)).join('')}
    </section>

    <div class="actions">
      <button class="btn ghost" data-edit>${t('detail.edit')}</button>
      <button class="btn ghost" data-newbox="${esc(m.id)}">${t('detail.newBox')}</button>
      <button class="btn danger" data-delete>${t('detail.delete')}</button>
    </div>`;
}
