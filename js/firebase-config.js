// Firebase web config. These values are public identifiers, not secrets; access
// is enforced by firestore.rules. Fill them in from
// Firebase console → Project settings → Your apps → Web app.
// While projectId/apiKey are empty, cloud backup stays off and Dozi works locally.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
};

export const cloudEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
