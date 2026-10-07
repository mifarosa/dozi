// Firebase web config. These values are public identifiers, not secrets; access
// is enforced by firestore.rules. Fill them in from
// Firebase console → Project settings → Your apps → Web app.
// While projectId/apiKey are empty, cloud backup stays off and Dozi works locally.
export const firebaseConfig = {
  apiKey: 'AIzaSyDMRKJgcFLEjndVWKsbZc8lUK-pJ2srLLE',
  authDomain: 'dozi-27dd5.firebaseapp.com',
  projectId: 'dozi-27dd5',
  appId: '1:623703643491:web:89f0c79d25e0adc689ef56',
};

export const cloudEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
