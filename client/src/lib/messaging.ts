import { firebaseApp, firebaseConfig } from './firebase';

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

type ForegroundPayload = {
  notification?: {
    title?: string;
    body?: string;
  };
};

type PushResult =
  | { status: 'unsupported' | 'missing-config' | 'denied' | 'unavailable'; token: null }
  | { status: 'enabled'; token: string };

function buildServiceWorkerUrl() {
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey || '',
    authDomain: firebaseConfig.authDomain || '',
    projectId: firebaseConfig.projectId || '',
    storageBucket: firebaseConfig.storageBucket || '',
    messagingSenderId: firebaseConfig.messagingSenderId || '',
    appId: firebaseConfig.appId || '',
  });

  return `/firebase-messaging-sw.js?${params.toString()}`;
}

async function resolveMessagingSupport() {
  if (!firebaseApp || !vapidKey) {
    return false;
  }

  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  ) {
    return false;
  }

  const { isSupported } = await import('firebase/messaging');
  return isSupported();
}

async function getBrowserPushToken(requestPermission: boolean): Promise<PushResult> {
  const supported = await resolveMessagingSupport();

  if (!supported) {
    return {
      status: vapidKey ? 'unsupported' : 'missing-config',
      token: null,
    };
  }

  if (Notification.permission === 'denied') {
    return { status: 'denied', token: null };
  }

  if (Notification.permission !== 'granted') {
    if (!requestPermission) {
      return { status: 'unavailable', token: null };
    }

    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      return {
        status: permission === 'denied' ? 'denied' : 'unavailable',
        token: null,
      };
    }
  }

  const [{ getMessaging, getToken }] = await Promise.all([import('firebase/messaging')]);
  const registration = await navigator.serviceWorker.register(buildServiceWorkerUrl());
  const messaging = getMessaging(firebaseApp!);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    return { status: 'unavailable', token: null };
  }

  return { status: 'enabled', token };
}

let foregroundUnsubscribe: null | (() => void) = null;

export async function ensureBrowserPushToken() {
  return getBrowserPushToken(false);
}

export async function enableBrowserPush() {
  return getBrowserPushToken(true);
}

export async function subscribeToForegroundMessages(
  callback: (payload: ForegroundPayload) => void
) {
  const supported = await resolveMessagingSupport();

  if (!supported || foregroundUnsubscribe) {
    return foregroundUnsubscribe;
  }

  const [{ getMessaging, onMessage }] = await Promise.all([import('firebase/messaging')]);
  const messaging = getMessaging(firebaseApp!);
  foregroundUnsubscribe = onMessage(messaging, callback);
  return foregroundUnsubscribe;
}

export function hasPushConfig() {
  return Boolean(firebaseApp && vapidKey);
}
