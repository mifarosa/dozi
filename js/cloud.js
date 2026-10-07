// Firebase wiring: Google sign-in plus one Firestore document per user.
// The SDK is loaded lazily so the app still starts offline or without config.
import { firebaseConfig, cloudEnabled } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';

export const available = cloudEnabled;

let sdk = null; // { auth, db, fns }
let unsubscribeDoc = null;

async function loadSdk() {
  if (sdk) return sdk;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`${SDK}firebase-app.js`),
    import(`${SDK}firebase-auth.js`),
    import(`${SDK}firebase-firestore.js`),
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  const db = fsMod.initializeFirestore(app, { localCache: fsMod.persistentLocalCache() });
  sdk = { auth: authMod.getAuth(app), db, authMod, fsMod };
  return sdk;
}

// handlers.onUser(user | null), handlers.onRemote({ meds, extras, updatedAt } | null), handlers.onError(err)
export async function startCloud(handlers) {
  if (!available) return;
  try {
    const { auth, db, authMod, fsMod } = await loadSdk();
    authMod.onAuthStateChanged(auth, (user) => {
      if (unsubscribeDoc) unsubscribeDoc();
      unsubscribeDoc = null;
      handlers.onUser(user ? { uid: user.uid, email: user.email } : null);
      if (!user) return;
      unsubscribeDoc = fsMod.onSnapshot(
        fsMod.doc(db, 'users', user.uid),
        (snap) => {
          // Our own not-yet-confirmed write is not news.
          if (snap.metadata.hasPendingWrites) return;
          handlers.onRemote(snap.exists() ? snap.data() : null);
        },
        handlers.onError,
      );
    });
  } catch (err) {
    handlers.onError(err);
  }
}

export async function signIn() {
  const { auth, authMod } = await loadSdk();
  const provider = new authMod.GoogleAuthProvider();
  try {
    await authMod.signInWithPopup(auth, provider);
  } catch (err) {
    // Installed PWAs often block popups; fall back to a full-page redirect.
    if (err.code === 'auth/popup-blocked') await authMod.signInWithRedirect(auth, provider);
    else throw err;
  }
}

export async function signOut() {
  const { auth, authMod } = await loadSdk();
  await authMod.signOut(auth);
}

// data is { meds, extras }; the whole state lives in one document per user.
export async function pushData(uid, data, updatedAt) {
  const { db, fsMod } = await loadSdk();
  await fsMod.setDoc(fsMod.doc(db, 'users', uid), { meds: data.meds, extras: data.extras, updatedAt });
}
