import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initFirebaseAppCheck } from './appCheck';

const configuredAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;

function resolveAuthDomain() {
  if (typeof window === 'undefined') {
    return configuredAuthDomain;
  }

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const shouldUseAppDomain =
    window.location.protocol === 'https:' &&
    !isLocalhost &&
    configuredAuthDomain?.endsWith('.firebaseapp.com');

  return shouldUseAppDomain ? hostname : configuredAuthDomain;
}

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const missingFirebaseConfig = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
]
  .filter(([, value]) => !String(value || '').trim())
  .map(([name]) => name);

export const firebaseReady = missingFirebaseConfig.length === 0;

export const firebaseApp = firebaseReady ? initializeApp(firebaseConfig) : null;
if (firebaseApp) {
  initFirebaseAppCheck(firebaseApp);
}
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
