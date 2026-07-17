import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredFirebaseConfig = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const missingFirebaseConfig = requiredFirebaseConfig.filter((name) => !import.meta.env[name]);

export const firebaseInitializationError = missingFirebaseConfig.length
  ? `Firebase is not configured. Missing: ${missingFirebaseConfig.join(', ')}`
  : null;

const app = firebaseInitializationError
  ? null
  : (getApps().length ? getApps()[0] : initializeApp(firebaseConfig));

export const auth = app ? getAuth(app) : null;
// IndexedDB persistence keeps private study content available while offline and
// lets the Firebase SDK synchronize queued writes once connectivity returns.
export const db = app ? initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
}) : null;
export const googleProvider = new GoogleAuthProvider();

googleProvider.addScope('profile');
googleProvider.addScope('email');
