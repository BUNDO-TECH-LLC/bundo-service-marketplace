import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CustomerHeader } from '../../components/customer/CustomerHeader';
import { BookingsPage } from '../../panels/BookingsPanel';
import { NotificationsPanel } from '../../panels/NotificationsPanel';
import type { ActionRunner, PushStatus, WorkspaceSection } from '../../appTypes';
import { auth } from '../../lib/firebase';
import { resolveApiSession } from '../../lib/authSession';
import { api } from '../../lib/api';
import {
  enableBrowserPush,
  ensureBrowserPushToken,
  hasPushConfig,
} from '../../lib/messaging';
import type { ApiUser, Booking, Notification } from '../../types';
import {
  appRoutes,
  buildCustomerWorkspacePath,
  buildCategoriesPath,
} from '../../routes/paths';

const workspaceSectionsWithRedirect = new Set(['messages']);

type WorkspaceLocationState = {
  notice?: string;
};

export default function CustomerWorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [me, setMe] = useState<ApiUser | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [pushStatus, setPushStatus] = useState<PushStatus>(hasPushConfig() ? 'idle' : 'missing-config');
  const [pushToken, setPushToken] = useState('');

  const section = (searchParams.get('section') as WorkspaceSection) || 'bookings';

  useEffect(() => {
    if (workspaceSectionsWithRedirect.has(section)) {
      navigate(buildCustomerWorkspacePath(section), { replace: true });
    }
  }, [navigate, section]);

  useEffect(() => {
    const incomingNotice = (location.state as WorkspaceLocationState | null)?.notice;
    if (incomingNotice) {
      setNotice(incomingNotice);
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (!auth) {
      navigate(appRoutes.login, { replace: true });
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        navigate(appRoutes.login, { replace: true });
        return;
      }

      try {
        const session = await resolveApiSession(user);

        if (session.user.role === 'ARTISAN') {
          navigate(appRoutes.artisanDashboard, { replace: true });
          return;
        }

        if (session.user.role === 'ADMIN') {
          navigate(appRoutes.admin, { replace: true });
          return;
        }

        setToken(session.token);
        setMe(session.user);
      } catch {
        navigate(appRoutes.login, { replace: true });
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (!token || !me) {
      return;
    }

    void refresh();
  }, [token, me?.firebaseUid]);

  useEffect(() => {
    if (!token) {
      return;
    }

    ensureBrowserPushToken()
      .then(async (result) => {
        setPushStatus(result.status);

        if (result.status === 'enabled' && result.token) {
          await syncPushToken(result.token);
        }
      })
      .catch(() => {
        setPushStatus('unsupported');
      });
  }, [token]);

  const runAction: ActionRunner = async (action, done = 'Done') => {
    setBusy(true);
    setNotice('');

    try {
      await action();
      if (done) {
        setNotice(done);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  async function refresh() {
    if (!token) {
      return;
    }

    setBusy(true);
    setNotice('');

    try {
      const [bookingResponse, notificationResponse] = await Promise.all([
        api<{ bookings: Booking[] }>('/bookings/customer?page=1&limit=20', { token }),
        api<{ notifications: Notification[] }>('/notifications', { token }),
      ]);

      setBookings(bookingResponse.bookings);
      setNotifications(notificationResponse.notifications);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load your workspace.');
    } finally {
      setBusy(false);
    }
  }

  async function syncPushToken(nextPushToken: string) {
    await api('/users/fcm-token', {
      method: 'PATCH',
      token,
      body: JSON.stringify({ fcmToken: nextPushToken }),
    });

    setPushToken(nextPushToken);
  }

  async function enablePushAlerts() {
    const result = await enableBrowserPush();
    setPushStatus(result.status);

    if (result.status === 'enabled') {
      await syncPushToken(result.token);
    }
  }

  async function logout() {
    if (auth) {
      await signOut(auth);
    }

    navigate(appRoutes.home, { replace: true });
  }

  return (
    <div className="min-h-full bg-[var(--color-paper)] py-6">
      <CustomerHeader
        firebaseUser={firebaseUser}
        me={me}
        activeNav={section === 'bookings' || section === 'messages' ? section : null}
        notificationsActive={section === 'notifications'}
        onOpenDashboard={() => navigate(appRoutes.customerDashboard)}
        onOpenMarketplace={() => navigate(buildCategoriesPath({}))}
        onOpenNotifications={() => navigate(buildCustomerWorkspacePath('notifications'))}
        onOpenWorkspace={(nextSection) => navigate(buildCustomerWorkspacePath(nextSection))}
        onUserUpdated={setMe}
        onLogout={logout}
      />

      <main className="app-screen-gutter mt-8">
        {notice ? <div className="notice mb-5">{notice}</div> : null}

        {section === 'bookings' ? (
          <BookingsPage
            bookings={bookings}
            mode="customer"
            token={token}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
            openMessages={() => navigate(buildCustomerWorkspacePath('messages'))}
          />
        ) : null}

        {section === 'notifications' ? (
          <NotificationsPanel
            token={token}
            notifications={notifications}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
            pushStatus={pushStatus}
            pushEnabled={Boolean(pushToken)}
            enablePushAlerts={enablePushAlerts}
          />
        ) : null}
      </main>
    </div>
  );
}
