// The medicine list: the "time to take" banner plus one card per medicine in use.
// Medicines on the shelf are listed in Settings; a link here says how many there are.
import { state } from '../state.js';
import { totalQ, remainingQ, daysLeft } from '../store.js';
import { t, pillsText } from '../i18n.js';
import { dueMeds } from '../reminders.js';
import { esc } from '../html.js';
import { newBoxPrompt, endedLabel } from '../boxes.js';

// Banner for every medicine whose reminder time has passed without a logged dose.
function dueBannerHtml() {
  return dueMeds(state.meds).map((m) => (
    `<button class="banner" data-open="${esc(m.id)}">${t('list.due')} <b>${esc(m.name)}</b> · ${pillsText(m.dose)}</button>`
  )).join('');
}

const emptyHtml = () => `<div class="empty card">
      <h2>${t('list.emptyTitle')}</h2>
      <p>${t('list.emptyBody', { plus: '<b>+</b>' })}</p>
    </div>`;

// "Your box ran out yesterday. Did you take today's dose? Then let's open the new box."
function newBoxCardsHtml() {
  return state.meds.map((m) => {
    const prompt = newBoxPrompt(m);
    if (!prompt) return '';
    return `<div class="card newbox">
      <p>${t('list.boxEnded', { name: `<b>${esc(m.name)}</b>`, ended: endedLabel(prompt.daysAgo) })}</p>
      <div class="row">
        <button class="btn primary small" data-newbox="${esc(m.id)}">${t('list.yesNewBox')}</button>
        <button class="btn ghost small" data-newbox-later="${esc(m.id)}">${t('list.later')}</button>
        <button class="btn ghost small" data-shelve="${esc(m.id)}">${t('list.shelve')}</button>
      </div>
    </div>`;
  }).join('');
}

function medCardHtml(m) {
  const pct = Math.round((remainingQ(m) / totalQ(m)) * 100);
  return `<button class="card med" data-open="${esc(m.id)}">
      <div class="med-row"><strong>${esc(m.name)}</strong><span>${pillsText(remainingQ(m))}</span></div>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <div class="med-sub">${remainingQ(m) === 0 ? t('list.boxFinished') : t('list.daysLeft', { n: daysLeft(m) })}</div>
    </button>`;
}

// One line under the list, so a medicine on the shelf never looks lost.
function shelfLinkHtml(count) {
  if (!count) return '';
  return `<button type="button" class="shelf-link" data-goto="settings">${t('list.shelfLink', { n: count })}</button>`;
}

export function listHtml() {
  const inUse = state.meds.filter((m) => !m.shelved);
  const empty = state.meds.length ? '' : emptyHtml();
  return newBoxCardsHtml() + dueBannerHtml() + empty + inUse.map(medCardHtml).join('')
    + shelfLinkHtml(state.meds.length - inUse.length);
}
