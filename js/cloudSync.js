// Cloud backup: the bar at the top, pushing local changes and applying the cloud copy.
// cloud.js wraps the Firebase SDK; sync.js decides what to do; this wires them to the app.
import {
  state, on, commit, refresh, setMeta, replaceData,
} from './state.js';
import { normalizeMed } from './store.js';
import { decideSync, mergeMeds, mergeExtras } from './sync.js';
import { esc } from './html.js';
import * as cloud from './cloud.js';

const bar = document.getElementById('cloud-bar');

let user = null;
let status = ''; // short text shown in the bar

function renderBar() {
  if (!cloud.available) return;
  bar.hidden = false;
  if (!user) {
    bar.innerHTML = `<span>${esc(status || 'Verilerin kaybolmasın: hesabınla yedekle')}</span>
      <button class="btn primary small" data-cloud="in">Google ile giriş</button>`;
    return;
  }
  bar.innerHTML = `<span>&#9729; ${esc(user.email || 'Giriş yapıldı')} · ${esc(status || 'yedekleniyor')}</span>
    <button class="btn ghost small" data-cloud="out">Çıkış</button>`;
}

function setStatus(text) {
  status = text;
  renderBar();
}

async function push() {
  if (!user) return;
  try {
    await cloud.pushData(user.uid, { meds: state.meds, extras: state.extras }, state.meta.updatedAt);
    setMeta({ uid: user.uid });
    setStatus('yedeklendi');
  } catch {
    // The Firestore SDK keeps the write queued and retries once we are online.
    setStatus('yedekleme bekliyor');
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
    setStatus('yedekten yüklendi');
    refresh();
  } else if (decision === 'merge') {
    state.meds = mergeMeds(state.meds, remoteMeds);
    state.extras = mergeExtras(state.extras, remoteExtras);
    commit();
  } else if (decision === 'push') {
    push();
  } else {
    setMeta({ uid: user.uid });
    setStatus('yedeklendi');
  }
}

export function initCloudSync() {
  on('commit', push);

  bar.addEventListener('click', async (e) => {
    const action = e.target.closest('button')?.dataset.cloud;
    try {
      if (action === 'in') await cloud.signIn();
      if (action === 'out') await cloud.signOut();
    } catch {
      setStatus('giriş yapılamadı');
    }
  });

  renderBar();
  cloud.startCloud({
    onUser(next) {
      user = next;
      status = next ? 'bağlanıyor' : '';
      renderBar();
    },
    onRemote: applyRemote,
    onError() {
      setStatus('bağlantı kurulamadı');
    },
  });
}
