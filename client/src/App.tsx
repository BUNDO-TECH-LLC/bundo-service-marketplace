import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import type {
  ActionRunner,
  AdminArtisanRecord,
  AdminCategoryRecord,
  AdminSection,
  AdminUserRecord,
  BookingSuccessState,
  PaymentSuccessState,
  MarketplaceSort,
  PushStatus,
  View,
  WorkspaceSection,
} from './appTypes';
import { buildAppPath, legacyQueryToAppPath, parseAppPath } from './lib/appPaths';
import { paymentSuccessFromVerify, type VerifyPaymentResponse } from './lib/paymentReturn';
import { api, ApiError } from './lib/api';
import { needsEmailVerification } from './lib/authSignupStorage';
import { auth, firebaseReady } from './lib/firebase';
import {
  enableBrowserPush,
  ensureBrowserPushToken,
  hasPushConfig,
  subscribeToForegroundMessages,
} from './lib/messaging';
import { resolveApiSession } from './lib/resolveApiSession';
import { readStoredRoute, routeStorageKey, storedRouteToPath } from './lib/workspaceRoute';
import {
  ApiUser,
  Artisan,
  ArtisanKycSubmission,
  AvailabilitySlot,
  Booking,
  Category,
  CloudinarySignedUpload,
  Conversation,
  Notification,
  Offering,
  PortfolioImage,
  PayoutBank,
  ProviderPayoutAccount,
  Review,
  Role,
} from './types';
import { AppRoutes } from './app/AppRoutes';
import { AppRootContext, type AppRootValue } from './app/appRootContext';

function clearStoredRoute() {
  window.localStorage.removeItem(routeStorageKey);
}

/** Routes that should survive auth bootstrap (guest null user, or post-login redirect). */
function isPublicBrowsePathname(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  return (
    p === '/help' ||
    p.startsWith('/help/') ||
    p === '/marketplace' ||
    p.startsWith('/artisans/')
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [view, setView] = useState<View>('home');
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>('overview');
  const [adminSection, setAdminSection] = useState<AdminSection>('overview');
  const [routeHydrated, setRouteHydrated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeHelpTopicId, setActiveHelpTopicId] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [me, setMe] = useState<ApiUser | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [publicOfferings, setPublicOfferings] = useState<Offering[]>([]);
  const [myOfferings, setMyOfferings] = useState<Offering[]>([]);
  const [selectedArtisan, setSelectedArtisan] = useState<Artisan | null>(null);
  const [selectedArtisanReviews, setSelectedArtisanReviews] = useState<Review[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [adminConversations, setAdminConversations] = useState<Conversation[]>([]);
  const [adminStats, setAdminStats] = useState<Record<string, number> | null>(null);
  const [adminBookings, setAdminBookings] = useState<Booking[]>([]);
  const [adminKycSubmissions, setAdminKycSubmissions] = useState<ArtisanKycSubmission[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [adminArtisans, setAdminArtisans] = useState<AdminArtisanRecord[]>([]);
  const [adminCategories, setAdminCategories] = useState<AdminCategoryRecord[]>([]);
  const [selectedState, setSelectedState] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [marketplaceSort, setMarketplaceSort] = useState<MarketplaceSort>('rating');
  const [notice, setNotice] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState<BookingSuccessState | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<PaymentSuccessState | null>(null);
  const [busy, setBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>(hasPushConfig() ? 'idle' : 'missing-config');
  const [pushToken, setPushToken] = useState('');
  const currentTokenRef = useRef('');
  const currentUserRef = useRef<ApiUser | null>(null);
  const authBootstrapCompletedRef = useRef(false);
  const processedPaymentReferenceRef = useRef<string | null>(null);

  const isAuthed = Boolean(firebaseUser && token);

  useEffect(() => {
    currentTokenRef.current = token;
  }, [token]);

  useEffect(() => {
    currentUserRef.current = me;
  }, [me]);

  useEffect(() => {
    const parsed = parseAppPath(location.pathname);
    if (!parsed) {
      navigate('/', { replace: true });
      return;
    }

    const firebaseProvisional = Boolean(auth?.currentUser);

    if (
      authChecked &&
      (parsed.view === 'workspace' || parsed.view === 'admin') &&
      !firebaseProvisional &&
      !token
    ) {
      navigate('/', { replace: true });
      return;
    }

    if (parsed.view === 'admin' && me && me.role !== 'ADMIN') {
      navigate('/', { replace: true });
      return;
    }

    if (parsed.view !== 'artisan-profile') {
      setSelectedArtisan(null);
      setSelectedArtisanReviews([]);
    }

    setView(parsed.view);
    setWorkspaceSection(parsed.workspaceSection);
    setAdminSection(parsed.adminSection);
    setActiveHelpTopicId(parsed.helpTopicId);
  }, [authChecked, firebaseUser, location.pathname, me, navigate, token]);

  async function withNotice(action: () => Promise<void>, done = 'Done') {
    setBusy(true);
    setNotice('');
    try {
      await action();
      if (done) {
        setNotice(done);
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Something went wrong';
      setNotice(message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshMe(authToken = token) {
    if (!authToken) return undefined;
    const response = await api<{ user: ApiUser }>('/me', { token: authToken });
    setMe(response.user);
    return response.user;
  }

  async function syncPushToken(authToken: string, nextPushToken: string | null) {
    if (!authToken) return;

    if (!nextPushToken) {
      await api('/users/fcm-token', {
        method: 'DELETE',
        token: authToken,
      });
      setPushToken('');
      return;
    }

    await api('/users/fcm-token', {
      method: 'PATCH',
      token: authToken,
      body: JSON.stringify({ fcmToken: nextPushToken }),
    });
    setPushToken(nextPushToken);
  }

  async function loadPublicData(
    state = selectedState,
    queryText = searchTerm,
    options?: {
      categoryId?: string;
      minPrice?: string;
      maxPrice?: string;
      sort?: MarketplaceSort;
    }
  ) {
    const params = new URLSearchParams({
      page: '1',
      limit: '12',
    });
    const nextCategoryId = options?.categoryId ?? selectedCategoryId;
    const nextMinPrice = options?.minPrice ?? priceMin;
    const nextMaxPrice = options?.maxPrice ?? priceMax;
    const nextSort = options?.sort ?? marketplaceSort;

    if (state) {
      params.set('state', state);
    }

    if (queryText.trim()) {
      params.set('q', queryText.trim());
    }

    if (nextCategoryId) {
      params.set('categoryId', nextCategoryId);
    }

    if (nextMinPrice.trim()) {
      params.set('minPrice', nextMinPrice.trim());
    }

    if (nextMaxPrice.trim()) {
      params.set('maxPrice', nextMaxPrice.trim());
    }

    if (nextSort) {
      params.set('sort', nextSort);
    }

    const query = `?${params.toString()}`;
    const [categoryRes, artisanRes, offeringRes] = await Promise.all([
      api<{ categories: Category[] }>('/categories'),
      api<{ artisans: Artisan[] }>(`/artisans${query}`),
      api<{ offerings: Offering[] }>(`/offerings${query}`),
    ]);
    setCategories(categoryRes.categories);
    setArtisans(artisanRes.artisans);
    setPublicOfferings(offeringRes.offerings);
  }

  async function loadPrivateData(authToken = token, user = me) {
    if (!authToken || !user?.role) return;

    if (user.role === 'CUSTOMER') {
      const [bookingRes, conversationRes, notificationRes] = await Promise.all([
        api<{ bookings: Booking[] }>('/bookings/customer?page=1&limit=10', { token: authToken }),
        api<{ conversations: Conversation[] }>('/conversations', { token: authToken }),
        api<{ notifications: Notification[] }>('/notifications', { token: authToken }),
      ]);
      setBookings(bookingRes.bookings);
      setConversations(conversationRes.conversations);
      setNotifications(notificationRes.notifications);
      setMyOfferings([]);
    }

    if (user.role === 'ARTISAN') {
      const [bookingRes, offeringRes, conversationRes, notificationRes] = await Promise.all([
        api<{ bookings: Booking[] }>('/bookings/artisan?page=1&limit=10', { token: authToken }).catch(() => ({ bookings: [] })),
        api<{ offerings: Offering[] }>('/offerings/me', { token: authToken }).catch(() => ({ offerings: [] })),
        api<{ conversations: Conversation[] }>('/conversations', { token: authToken }),
        api<{ notifications: Notification[] }>('/notifications', { token: authToken }),
      ]);
      setBookings(bookingRes.bookings);
      setMyOfferings(offeringRes.offerings);
      setConversations(conversationRes.conversations);
      setNotifications(notificationRes.notifications);
    }

    if (user.role === 'ADMIN') {
      const [
        stats,
        conversationRes,
        bookingRes,
        notificationRes,
        kycRes,
        userRes,
        artisanRes,
        categoryRes,
      ] = await Promise.all([
        api<{ stats: Record<string, number> }>('/admin/stats', { token: authToken }),
        api<{ conversations: Conversation[] }>('/admin/conversations?page=1&limit=20', { token: authToken }),
        api<{ bookings: Booking[] }>('/admin/bookings?page=1&limit=50', { token: authToken }),
        api<{ notifications: Notification[] }>('/notifications', { token: authToken }),
        api<{ submissions: ArtisanKycSubmission[] }>('/admin/kyc-submissions?page=1&limit=12', { token: authToken }),
        api<{ users: AdminUserRecord[] }>('/admin/users?page=1&limit=24', { token: authToken }),
        api<{ artisans: AdminArtisanRecord[] }>('/admin/artisans?page=1&limit=24', { token: authToken }),
        api<{ categories: AdminCategoryRecord[] }>('/admin/categories?page=1&limit=24', { token: authToken }),
      ]);
      setAdminStats(stats.stats);
      setAdminConversations(conversationRes.conversations);
      setAdminBookings(bookingRes.bookings);
      setNotifications(notificationRes.notifications);
      setAdminKycSubmissions(kycRes.submissions);
      setAdminUsers(userRes.users);
      setAdminArtisans(artisanRes.artisans);
      setAdminCategories(categoryRes.categories);
    }
  }

  async function completePaymentReturn(reference: string, authToken: string, user: ApiUser) {
    const response = await api<VerifyPaymentResponse>('/payments/verify-reference', {
      method: 'POST',
      token: authToken,
      body: JSON.stringify({ reference }),
    });
    await loadPrivateData(authToken, user);
    setPaymentSuccess(paymentSuccessFromVerify(response));
    setNotice('Payment confirmed. Your booking is now secured.');
  }

  async function openArtisanProfile(artisanId: string) {
    navigate(`/artisans/${artisanId}`);
  }

  useEffect(() => {
    const parsed = parseAppPath(location.pathname);
    if (!parsed || parsed.view !== 'artisan-profile' || !parsed.artisanId) {
      return;
    }

    const id = parsed.artisanId;
    if (selectedArtisan?.id === id) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [artisanRes, reviewRes] = await Promise.all([
          api<{ artisan: Artisan }>(`/artisans/${id}`),
          api<{ reviews: Review[] }>(`/artisans/${id}/reviews`),
        ]);
        if (cancelled) return;
        setSelectedArtisan(artisanRes.artisan);
        setSelectedArtisanReviews(reviewRes.reviews);
      } catch {
        if (!cancelled) {
          setNotice('Could not load artisan profile');
          navigate('/marketplace', { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate, selectedArtisan?.id]);

  useEffect(() => {
    loadPublicData().catch(() => setNotice('Could not load marketplace data'));
  }, []);

  useEffect(() => {
    if (!authChecked || !token || !me) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (!reference || processedPaymentReferenceRef.current === reference) {
      return;
    }

    processedPaymentReferenceRef.current = reference;
    let cancelled = false;

    void (async () => {
      try {
        await completePaymentReturn(reference, token, me);
      } catch (error) {
        if (!cancelled) {
          setNotice(
            error instanceof ApiError
              ? error.message
              : 'Payment could not be confirmed yet. Open Bookings to check status or try again.'
          );
        }
      } finally {
        if (!cancelled) {
          navigate(buildAppPath({ view: 'workspace', workspaceSection: 'bookings' }), {
            replace: true,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authChecked, location.search, me, navigate, token]);

  useEffect(() => {
    if (!auth) {
      setAuthChecked(true);
      setRouteHydrated(true);
      return;
    }

    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        const hadSession = Boolean(currentTokenRef.current);
        if (currentTokenRef.current) {
          syncPushToken(currentTokenRef.current, null).catch(() => undefined);
        }
        setToken('');
        setMe(null);
        setBookings([]);
        setConversations([]);
        setAdminConversations([]);
        setAdminBookings([]);
        setAdminKycSubmissions([]);
        setAdminUsers([]);
        setAdminArtisans([]);
        setAdminCategories([]);
        setNotifications([]);
        setMyOfferings([]);
        setAdminStats(null);
        setPushToken('');
        setPushStatus(hasPushConfig() ? 'idle' : 'missing-config');
        setRouteHydrated(false);
        setActiveHelpTopicId(null);
        setSelectedArtisan(null);
        setSelectedArtisanReviews([]);
        clearStoredRoute();
        authBootstrapCompletedRef.current = false;
        if (hadSession) {
          navigate({ pathname: '/', search: '' }, { replace: true });
        }
        setAuthChecked(true);
        return;
      }

      if (needsEmailVerification(user)) {
        setToken('');
        setMe(null);
        setBookings([]);
        setConversations([]);
        setAdminConversations([]);
        setAdminBookings([]);
        setAdminKycSubmissions([]);
        setAdminUsers([]);
        setAdminArtisans([]);
        setAdminCategories([]);
        setNotifications([]);
        setMyOfferings([]);
        setAdminStats(null);
        setPushToken('');
        setPushStatus(hasPushConfig() ? 'idle' : 'missing-config');
        setRouteHydrated(false);
        setActiveHelpTopicId(null);
        setSelectedArtisan(null);
        setSelectedArtisanReviews([]);
        clearStoredRoute();
        authBootstrapCompletedRef.current = false;
        navigate({ pathname: '/', search: '' }, { replace: true });
        setAuthChecked(true);
        return;
      }

      const finishAuthBootstrap = () => {
        setRouteHydrated(true);
        setAuthChecked(true);
        authBootstrapCompletedRef.current = true;
      };

      if (authBootstrapCompletedRef.current) {
        try {
          const session = await resolveApiSession(user);
          setToken(session.token);
          setMe(session.user);
          if (session.user.role) {
            await loadPrivateData(session.token, session.user);
          }
        } catch {
          // Keep the current route if a background token refresh fails.
        }
        return;
      }

      try {
        const session = await resolveApiSession(user);
        setToken(session.token);
        setMe(session.user);

        if (!session.user.role) {
          finishAuthBootstrap();
          setNotice('Choose client or artisan to finish setting up your Bundo account before booking.');
          navigate({ pathname: '/', search: '' }, { replace: true });
          return;
        }

        await loadPrivateData(session.token, session.user);

        const path = window.location.pathname.replace(/\/+$/, '') || '/';
        const preservePublicRoute = isPublicBrowsePathname(path);

        const params = new URLSearchParams(window.location.search);
        const reference = params.get('reference') || params.get('trxref');

        if (reference) {
          processedPaymentReferenceRef.current = reference;
          try {
            await completePaymentReturn(reference, session.token, session.user);
          } catch (error) {
            setNotice(
              error instanceof ApiError
                ? error.message
                : 'Payment could not be confirmed yet. Open Bookings to check status or try again.'
            );
          } finally {
            navigate(buildAppPath({ view: 'workspace', workspaceSection: 'bookings' }), {
              replace: true,
            });
          }
          finishAuthBootstrap();
          return;
        }

        if (preservePublicRoute) {
          finishAuthBootstrap();
          return;
        }

        if (session.user.role === 'ADMIN') {
          const adminPath = parseAppPath(path);
          if (adminPath?.view === 'admin') {
            finishAuthBootstrap();
            return;
          }

          const storedAdminRoute = readStoredRoute(session.user.role);
          if (storedAdminRoute?.view === 'admin') {
            navigate({ pathname: storedRouteToPath(storedAdminRoute), search: '' }, { replace: true });
          } else {
            navigate({ pathname: '/admin/overview', search: '' }, { replace: true });
          }
          finishAuthBootstrap();
          return;
        }

        const legacyTarget = legacyQueryToAppPath(window.location.search);
        if (legacyTarget) {
          navigate({ pathname: legacyTarget, search: '' }, { replace: true });
          finishAuthBootstrap();
          return;
        }

        const storedRoute = readStoredRoute(session.user.role);
        if (storedRoute) {
          navigate({ pathname: storedRouteToPath(storedRoute), search: '' }, { replace: true });
        } else if (session.user.role === 'ARTISAN') {
          navigate('/workspace/overview', { replace: true });
        }
        finishAuthBootstrap();
      } catch {
        setToken('');
        setMe(null);
        setBookings([]);
        setConversations([]);
        setAdminConversations([]);
        setAdminBookings([]);
        setAdminKycSubmissions([]);
        setAdminUsers([]);
        setAdminArtisans([]);
        setAdminCategories([]);
        setNotifications([]);
        setMyOfferings([]);
        setAdminStats(null);
        setRouteHydrated(false);
        setNotice('We could not finish account sync. Please make sure the backend is running, then sign in again.');
        navigate({ pathname: '/', search: '' }, { replace: true });
        setAuthChecked(true);
      }
    });
  }, [navigate]);

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
        if (!cancelled) {
          setPushStatus('unsupported');
        }
      });

    subscribeToForegroundMessages(async (payload) => {
      const latestToken = currentTokenRef.current;
      const latestUser = currentUserRef.current;

      if (latestToken && latestUser?.role) {
        await loadPrivateData(latestToken, latestUser);
      }

      const title = payload.notification?.title || 'New update from Bundo';
      setNotice(title);
    }).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isAuthed, pushToken, token]);

  useEffect(() => {
    if (!isAuthed || !me?.role || !routeHydrated) return;

    const routeToStore =
      me.role === 'ARTISAN' && view === 'home'
        ? {
            view: 'workspace' as View,
            workspaceSection: 'overview' as WorkspaceSection,
            adminSection,
          }
        : {
            view,
            workspaceSection,
            adminSection,
          };

    window.localStorage.setItem(
      routeStorageKey,
      JSON.stringify(routeToStore)
    );
  }, [adminSection, isAuthed, me?.role, routeHydrated, view, workspaceSection]);

  async function enablePushAlerts() {
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
  }

  const categoryOptions = useMemo(
    (): ReactNode[] =>
      categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>),
    [categories]
  );
  const isRestoringAuthedRoute = isAuthed && Boolean(me?.role) && !routeHydrated;
  const isAppBootstrapping = !authChecked || isRestoringAuthedRoute;
  const usesArtisanSetupHeader = isAuthed && me?.role === 'ARTISAN' && view === 'home';
  const usesArtisanWorkspaceHeader = isAuthed && me?.role === 'ARTISAN' && view === 'workspace';
  const hideGlobalHeader = isAuthed && (me?.role === 'ADMIN' || usesArtisanSetupHeader || usesArtisanWorkspaceHeader);
  const artisanHeaderActive =
    workspaceSection === 'bookings'
      ? 'Jobs'
      : workspaceSection === 'messages'
        ? 'Messages'
        : workspaceSection === 'reviews'
          ? 'Reviews'
          : 'Dashboard';

  const rootValue: AppRootValue = {
    navigate,
    location,
    view,
    workspaceSection,
    adminSection,
    activeHelpTopicId,
    firebaseUser,
    token,
    me,
    categories,
    artisans,
    publicOfferings,
    myOfferings,
    selectedArtisan,
    selectedArtisanReviews,
    bookings,
    conversations,
    notifications,
    adminConversations,
    adminStats,
    adminBookings,
    adminKycSubmissions,
    adminUsers,
    adminArtisans,
    adminCategories,
    selectedState,
    setSelectedState,
    searchTerm,
    setSearchTerm,
    selectedCategoryId,
    setSelectedCategoryId,
    priceMin,
    setPriceMin,
    priceMax,
    setPriceMax,
    marketplaceSort,
    setMarketplaceSort,
    notice,
    setNotice,
    bookingSuccess,
    setBookingSuccess,
    paymentSuccess,
    setPaymentSuccess,
    busy,
    isAuthed,
    isAppBootstrapping,
    usesArtisanSetupHeader,
    usesArtisanWorkspaceHeader,
    hideGlobalHeader,
    artisanHeaderActive,
    categoryOptions,
    withNotice,
    loadPublicData,
    loadPrivateData,
    openArtisanProfile,
    enablePushAlerts,
    firebaseReady,
    pushStatus,
    pushToken,
    routeHydrated,
    setRouteHydrated,
    setToken,
    setMe,
  };

  return (
    <AppRootContext.Provider value={rootValue}>
      <div className="app-shell">
        <AppRoutes />
      </div>
    </AppRootContext.Provider>
  );

}



export default App;
