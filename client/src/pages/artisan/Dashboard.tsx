import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import bundoLogo from '../../assets/BundoLogo.png';
import { ArtisanDashboard } from '../../views/ArtisanDashboard';
import { BookingsPage } from '../../panels/BookingsPanel';
import { ChatPanel } from '../../panels/ChatPanel';
import { NotificationsPanel } from '../../panels/NotificationsPanel';
import { ArtisanReviewsPage } from './ArtisanReviewsPage';
import { ArtisanToolsPage } from './ArtisanToolsPage';
import type { ActionRunner, PushStatus, WorkspaceSection } from '../../appTypes';
import { auth } from '../../lib/firebase';
import {
  fetchOnboardingStatus,
  getFirstIncompleteStepPath,
  isOnboardingComplete,
} from '../../lib/artisanOnboarding';
import { resolveApiSession } from '../../lib/authSession';
import { api } from '../../lib/api';
import {
  enableBrowserPush,
  ensureBrowserPushToken,
  hasPushConfig,
} from '../../lib/messaging';
import type { ApiUser, Booking, Category, Conversation, Notification, Offering } from '../../types';
import {
  appRoutes,
  buildArtisanDashboardPath,
} from '../../routes/paths';

type ArtisanDashboardPageProps = {
  requireAuth?: boolean;
};

export default function ArtisanDashboardPage({ requireAuth = true }: ArtisanDashboardPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [me, setMe] = useState<ApiUser | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [myOfferings, setMyOfferings] = useState<Offering[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [pushStatus, setPushStatus] = useState<PushStatus>(hasPushConfig() ? 'idle' : 'missing-config');
  const [pushToken, setPushToken] = useState('');

  const section = (searchParams.get('section') as WorkspaceSection) || 'overview';

  useEffect(() => {
    if (!requireAuth) {
      setMe({
        firebaseUid: 'dev-artisan',
        email: 'artisan@example.com',
        phone: null,
        role: 'ARTISAN',
        status: 'ACTIVE',
      });
      setToken('dev-token');
      return undefined;
    }

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

        if (session.user.role === 'ADMIN') {
          navigate(appRoutes.admin, { replace: true });
          return;
        }

        if (session.user.role !== 'ARTISAN') {
          navigate(appRoutes.customerDashboard, { replace: true });
          return;
        }

        const onboardingStatus = await fetchOnboardingStatus(session.token);

        if (!isOnboardingComplete(onboardingStatus)) {
          navigate(getFirstIncompleteStepPath(onboardingStatus), { replace: true });
          return;
        }

        setToken(session.token);
        setMe(session.user);
      } catch {
        navigate(appRoutes.login, { replace: true });
      }
    });
  }, [navigate, requireAuth]);

  useEffect(() => {
    if (!token || !me) {
      return;
    }

    if (!requireAuth) {
      void api<{ categories: Category[] }>('/categories')
        .then((response) => {
          setCategories(response.categories);
        })
        .catch(() => undefined);
      return;
    }

    void refresh();
  }, [requireAuth, token, me?.firebaseUid]);

  useEffect(() => {
    if (!requireAuth || !token || token === 'dev-token') {
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
  }, [requireAuth, token]);

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
      const [categoryResponse, bookingResponse, offeringResponse, conversationResponse, notificationResponse] =
        await Promise.all([
          api<{ categories: Category[] }>('/categories', { token }),
          api<{ bookings: Booking[] }>('/bookings/artisan?page=1&limit=20', { token }),
          api<{ offerings: Offering[] }>('/offerings/me', { token }),
          api<{ conversations: Conversation[] }>('/conversations', { token }),
          api<{ notifications: Notification[] }>('/notifications', { token }),
        ]);

      setCategories(categoryResponse.categories);
      setBookings(bookingResponse.bookings);
      setMyOfferings(offeringResponse.offerings);
      setConversations(conversationResponse.conversations);
      setNotifications(notificationResponse.notifications);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load your artisan workspace.');
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
    if (requireAuth && auth) {
      await signOut(auth);
    }

    navigate(appRoutes.home, { replace: true });
  }

  function openSection(nextSection: WorkspaceSection) {
    setSearchParams(new URLSearchParams({ section: nextSection }));
  }

  const navItems: Array<{ id: WorkspaceSection; label: string }> = useMemo(
    () => [
      { id: 'overview', label: 'Overview' },
      { id: 'bookings', label: 'Bookings' },
      { id: 'messages', label: 'Messages' },
      { id: 'offers', label: 'Tools' },
      { id: 'reviews', label: 'Reviews' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'profile', label: 'Profile' },
    ],
    []
  );

  return (
    <div className="app-screen-gutter min-h-screen bg-[var(--color-paper)] py-6">
      {!requireAuth ? (
        <div
          className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <strong className="font-bold">Dev preview</strong> — layout only. Sign in as an artisan for live
          workspace data.
        </div>
      ) : null}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
        <button className="inline-flex items-center gap-3 bg-transparent text-[var(--color-ink)]" type="button" onClick={() => navigate(appRoutes.artisanDashboard)}>
          <img className="h-11 w-11 rounded-xl object-cover" src={bundoLogo} alt="Bundo logo" />
          <span className="text-2xl font-black">Artisan workspace</span>
        </button>

        <nav className="flex flex-wrap gap-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? 'primary-button' : 'secondary-button'}
              type="button"
              onClick={() => openSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-[var(--color-text-muted)]">
            {firebaseUser?.email || me?.email || 'artisan'}
          </span>
          <button className="secondary-button" type="button" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </header>

      {notice ? <div className="notice mb-5">{notice}</div> : null}

      {section === 'overview' ? (
        <ArtisanDashboard
          token={token}
          bookings={bookings}
          firebaseUser={firebaseUser}
          busy={busy}
          runAction={runAction}
          refresh={refresh}
          openBookings={() => navigate(buildArtisanDashboardPath('bookings'))}
          openProfile={() => navigate(buildArtisanDashboardPath('profile'))}
          openBookingDetail={(_bookingId) => navigate(buildArtisanDashboardPath('bookings'))}
        />
      ) : null}

      {section === 'bookings' ? (
        <BookingsPage
          bookings={bookings}
          mode="artisan"
          token={token}
          busy={busy}
          runAction={runAction}
          refresh={refresh}
          openMessages={() => navigate(buildArtisanDashboardPath('messages'))}
        />
      ) : null}

      {section === 'messages' && me ? (
        <ChatPanel
          token={token}
          currentUserId={me.firebaseUid}
          conversations={conversations}
          busy={busy}
          runAction={runAction}
          refresh={refresh}
        />
      ) : null}

      {section === 'notifications' ? (
        <NotificationsPanel
          token={token}
          notifications={notifications}
          busy={busy}
          runAction={runAction}
          refresh={refresh}
          onNavigate={(path) => navigate(path)}
          pushStatus={pushStatus}
          pushEnabled={Boolean(pushToken)}
          enablePushAlerts={enablePushAlerts}
        />
      ) : null}

      {section === 'offers' || section === 'profile' ? (
        <ArtisanToolsPage
          token={token}
          categories={categories}
          offerings={myOfferings}
          busy={busy}
          runAction={runAction}
          refresh={refresh}
        />
      ) : null}

      {section === 'reviews' ? <ArtisanReviewsPage token={token} /> : null}
    </div>
  );
}
