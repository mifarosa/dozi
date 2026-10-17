// Cloud backup: the bar at the top, pushing local changes and applying the cloud copy.
// cloud.js wraps the Firebase SDK; sync.js decides what to do; this wires them to the app.
import {
  state, on, commit, refresh, setMeta, replaceData, setUser,
} from './state.js';
import { normalizeMed } from './store.js';
import { decideSync, mergeMeds, mergeExtras } from './sync.js';
import { esc } from './html.js';
import * as cloud from './cloud.js';
import { pushConfigured, disablePush } from './push.js';
import { t } from './i18n.js';

const bar = document.getElementById('cloud-bar');

let user = null;
let status = ''; // message key of the short text shown in the bar (translated when drawn)

function renderBar() {
  if (!cloud.available) return;
  bar.hidden = false;
  if (!user) {
    bar.innerHTML = `<span>${esc(t(status || 'cloud.prompt'))}</span>
      <button class="btn primary small" data-cloud="in">${t('cloud.signIn')}</button>`;
    return;
  }
  bar.innerHTML = `<span>&#9729; ${esc(user.email || t('cloud.signedIn'))} · ${esc(t(status || 'cloud.backingUp'))}</span>
    <button class="btn ghost small" data-cloud="out">${t('cloud.signOut')}</button>`;
}

export function redrawCloudBar() {
  renderBar();
}

function setStatus(key) {
  status = key;
  renderBar();
}

async function push() {
  if (!user) return;
  try {
    await cloud.pushData(user.uid, { meds: state.meds, extras: state.extras }, state.meta.updatedAt);
    setMeta({ uid: user.uid });
    setStatus('cloud.backedUp');
  } catch {
    // The Firestore SDK keeps the write queued and retries once we are online.
    setStatus('cloud.waiting');
  }
}

function applyRemote(remote) {
  const remoteMeds = remote ? (remote.meds || []).map(normalizeMed) : [];
  const remoteExtras = remote ? remote.extras || [] : [];
  const remoteUpdated = remote ? Number(remote.updatedAt) || 0 : 0;

  const decision = decideSync({
    localUpdated: state.meta.updatedAt,
    localSynced: state.meta.uid === user.uid,
    localCount: state.meds.length + state.extras.length,
    remote: remote && { meds: remoteMeds, extras: remoteExtras, updatedAt: remoteUpdated },
  });

  if (decision === 'pull') {
    replaceData(remoteMeds, remoteExtras);
    setMeta({ updatedAt: remoteUpdated, uid: user.uid });
    setStatus('cloud.loaded');
    refresh();
  } else if (decision === 'merge') {
    state.meds = mergeMeds(state.meds, remoteMeds);
    state.extras = mergeExtras(state.extras, remoteExtras);
    commit();
  } else if (decision === 'push') {
    push();
  } else {
    setMeta({ uid: user.uid });
    setStatus('cloud.backedUp');
  }
}

export function initCloudSync() {
  on('commit', push);

  bar.addEventListener('click', async (e) => {
    const action = e.target.closest('button')?.dataset.cloud;
    try {
      if (action === 'in') await cloud.signIn();
      if (action === 'out') {
        // A signed-out phone must not keep receiving this account's reminders.
        if (pushConfigured) await disablePush().catch(() => {});
        await cloud.signOut();
      }
    } catch {
      setStatus('cloud.signInFailed');
    }
  });

  renderBar();
  cloud.startCloud({
    onUser(next) {
      user = next;
      status = next ? 'cloud.connecting' : '';
      renderBar();
      setUser(next);
    },
    onRemote: applyRemote,
    onError() {
      setStatus('cloud.offline');
    },
  });
}
