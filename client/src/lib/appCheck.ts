import { initializeAppCheck, ReCaptchaV3Provider, getToken, type AppCheck } from 'firebase/app-check';
import type { FirebaseApp } from 'firebase/app';

let appCheck: AppCheck | null = null;

export function initFirebaseAppCheck(app: FirebaseApp) {
  const siteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim();
  if (!siteKey) {
    return;
  }

  if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN?.trim()) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN.trim();
  }

  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export async function getFirebaseAppCheckToken(): Promise<string | undefined> {
  if (!appCheck) {
    return undefined;
  }

  try {
    const result = await getToken(appCheck, false);
    return result.token;
  } catch {
    return undefined;
  }
}
