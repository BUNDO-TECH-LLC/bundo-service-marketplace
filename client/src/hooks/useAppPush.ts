import { useCallback, useEffect, type MutableRefObject } from 'react';
import { api } from '../lib/api';
import {
  enableBrowserPush,
  ensureBrowserPushToken,
  subscribeToForegroundMessages,
} from '../lib/messaging';
import type { PushStatus } from '../appTypes';
import type { ApiUser } from '../types';

export function useAppPush({
  isAuthed,
  token,
  me,
  pushToken,
  setPushToken,
  setPushStatus,
  setNotice,
  loadPrivateData,
  loadNotifications,
  currentTokenRef,
}: {
  isAuthed: boolean;
  token: string;
  me: ApiUser | null;
  pushToken: string;
  setPushToken: (value: string) => void;
  setPushStatus: (value: PushStatus) => void;
  setNotice: (message: string) => void;
  loadPrivateData: (authToken: string, user?: ApiUser | null) => Promise<void>;
  loadNotifications: (authToken: string) => Promise<void>;
  currentTokenRef: MutableRefObject<string>;
}) {
  const syncPushToken = useCallback(
    async (authToken: string, nextPushToken: string | null) => {
      if (!authToken) return;

      if (!nextPushToken) {
        await api('/users/fcm-token', { method: 'DELETE', token: authToken });
        setPushToken('');
        return;
      }

      await api('/users/fcm-token', {
        method: 'PATCH',
        token: authToken,
        body: JSON.stringify({ fcmToken: nextPushToken }),
      });
      setPushToken(nextPushToken);
    },
    [setPushToken]
  );

  useEffect(() => {
    if (!isAuthed || !token) return;

    let cancelled = false;

    ensureBrowserPushToken()
      .then(async (result) => {
        if (cancelled) return;
        setPushStatus(result.status);
        if (result.status === 'enabled' && result.token && result.token !== pushToken) {
          await syncPushToken(token, result.token);
        }
      })
      .catch(() => {
        if (!cancelled) setPushStatus('unsupported');
      });

    subscribeToForegroundMessages(async (payload) => {
      const latestToken = currentTokenRef.current;
      if (latestToken) {
        await loadNotifications(latestToken);
      }
      const title = payload.notification?.title || 'New update from Bundo';
      setNotice(title);
    }).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isAuthed, loadNotifications, me, pushToken, setPushStatus, setNotice, syncPushToken, token, currentTokenRef]);

  const enablePushAlerts = useCallback(async () => {
    if (!token) {
      setNotice('Sign in first to enable alerts');
      return;
    }

    try {
      const result = await enableBrowserPush();
      setPushStatus(result.status);

      if (result.status === 'enabled') {
        await syncPushToken(token, result.token);
        setNotice('Push alerts are enabled');
        return;
      }

      if (result.status === 'denied') {
        setNotice('Browser notifications are blocked for this site');
        return;
      }

      if (result.status === 'missing-config') {
        setNotice('Push alerts need a Firebase web push VAPID key before they can be enabled');
        return;
      }

      setNotice('Push alerts are not available in this browser right now');
    } catch {
      setNotice('Could not enable push alerts');
    }
  }, [setNotice, setPushStatus, syncPushToken, token]);

  return { enablePushAlerts, syncPushToken };
}
