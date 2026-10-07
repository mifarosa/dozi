// One medicine: summary, intake controls, today's intakes and the blisters.
import {
  totalQ, remainingQ, daysLeft, takenTodayQ, formatPills,
} from '../store.js';
import { startOfDay, formatTime } from '../dates.js';
import { reminderNote } from '../notifications.js';
import { blisterHtml } from './pills.js';
import { esc } from '../html.js';

// Today's intakes, oldest first, so a wrong time is easy to spot.
function todayLogHtml(m) {
  const start = startOfDay(new Date()).getTime();
  const today = m.log.filter((e) => e.t >= start).sort((a, b) => a.t - b.t);
  if (!today.length) return '';
  const rows = today.map((e) => `<li>${formatTime(e.t)} · ${formatPills(e.q)} hap</li>`);
  return `<ul class="today-log">${rows.join('')}</ul>`;
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
      <div class="big">${formatPills(remainingQ(m))}<small> / ${formatPills(totalQ(m))} hap</small></div>
      <div class="med-sub">Günlük ${formatPills(perDayQ)} hap · ~${daysLeft(m)} gün yeter${finished ? '' : ` (${end.toLocaleDateString('tr-TR')})`}</div>
      <div class="today ${doneToday ? 'done' : ''}">Bugün: ${formatPills(todayQ)} / ${formatPills(perDayQ)} hap</div>
      ${m.times.length ? `<div class="med-sub">Hatırlatma: ${m.times.join(', ')}${reminderNote()}</div>` : ''}
    </section>

    <section class="card intake">
      <label class="take-time">Aldığın saat (boşsa şu an)
        <input id="take-time" type="time">
      </label>
      <button class="btn primary big-btn" data-take="${m.dose}" ${off}>
        Aldım · ${formatPills(m.dose)} hap
      </button>
      <div class="chips">
        <button class="chip" data-take="1" ${off}>¼</button>
        <button class="chip" data-take="2" ${off}>½</button>
        <button class="chip" data-take="4" ${off}>1</button>
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
