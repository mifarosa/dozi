// Pure sync decisions between the local copy and the cloud document.
// The cloud document looks like { meds: [...], extras: [...], updatedAt: <ms> }.

// What to do when the cloud document is first seen or changes.
// localSynced is true once this device has synced with the signed-in account.
export function decideSync({ localUpdated, localSynced, localCount, remote }) {
  if (!remote) return localCount ? 'push' : 'none';
  if (!localSynced) {
    if (!localCount) return 'pull';
    if (!remote.meds.length && !(remote.extras || []).length) return 'push';
    return 'merge'; // both sides have data and never met: keep both
  }
  if (remote.updatedAt > localUpdated) return 'pull';
  if (remote.updatedAt < localUpdated) return 'push';
  return 'none';
}

// Union by id. When both sides have the same medicine, keep the one with more
// logged intakes (it has seen more activity); on a tie the cloud copy wins.
export function mergeMeds(local, remote) {
  const byId = new Map(remote.map((m) => [m.id, m]));
  for (const m of local) {
    const other = byId.get(m.id);
    if (!other || m.log.length > other.log.length) byId.set(m.id, m);
  }
  return [...byId.values()];
}

// Union of free-form entries by id; the cloud copy wins when both have it.
export function mergeExtras(local, remote) {
  const byId = new Map(local.map((x) => [x.id, x]));
  for (const x of remote) byId.set(x.id, x);
  return [...byId.values()];
}
