import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { api, ApiError } from './lib/api';
import { auth, firebaseReady } from './lib/firebase';
import {
  enableBrowserPush,
  ensureBrowserPushToken,
  hasPushConfig,
  subscribeToForegroundMessages,
} from './lib/messaging';
import {
  ApiUser,
  Artisan,
  ArtisanKycSubmission,
  Booking,
  Category,
  CloudinarySignedUpload,
  Conversation,
  Message,
  Notification,
  Offering,
  PaymentStatus,
  PortfolioImage,
  PayoutBank,
  ProviderPayoutAccount,
  Review,
  Role,
  AvailabilitySlot,
} from './types';
import bundoLogo from './assets/bundo-logo.png';

type View = 'home' | 'marketplace' | 'workspace' | 'admin' | 'help' | 'artisan-profile';
type WorkspaceSection = 'overview' | 'bookings' | 'messages' | 'offers' | 'notifications' | 'reviews' | 'profile';
type AdminSection = 'overview' | 'profiles' | 'jobs' | 'messages' | 'verification' | 'catalog';
type ActionRunner = (action: () => Promise<void>, done?: string) => Promise<void>;
type PushStatus = 'idle' | 'unsupported' | 'missing-config' | 'unavailable' | 'enabled' | 'denied';
type MarketplaceSort = 'newest' | 'rating' | 'price_low' | 'price_high';
type SignupRole = Extract<Role, 'CUSTOMER' | 'ARTISAN'>;
type BookingSuccessState = {
  bookingId?: string;
  serviceTitle: string;
  artisanName: string;
};
type AdminUserRecord = ApiUser & {
  artisanProfile?: {
    id: string;
    displayName: string;
    verifyStatus: Artisan['verifyStatus'];
  } | null;
};
type AdminArtisanRecord = Artisan & {
  user?: Pick<ApiUser, 'firebaseUid' | 'email' | 'phone' | 'role' | 'status'>;
  _count?: {
    offerings: number;
    bookingsReceived: number;
    reviewsReceived: number;
  };
};
type AdminCategoryRecord = Category & {
  _count?: {
    offerings: number;
  };
};

const heroImage =
  'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1300&q=80';
const phoneImage =
  'https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=1000&q=80';

const nigeriaStates = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
  'FCT',
];

function money(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value);
}

const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

async function uploadChatImage(token: string, file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Chat images must be 5MB or smaller.');
  }

  const signatureResponse = await api<{ upload: CloudinarySignedUpload }>('/messages/sign-upload', {
    method: 'POST',
    token,
  });
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signatureResponse.upload.apiKey);
  formData.append('timestamp', String(signatureResponse.upload.timestamp));
  formData.append('folder', signatureResponse.upload.folder);
  formData.append('signature', signatureResponse.upload.signature);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureResponse.upload.cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );
  const uploadData = await uploadResponse.json();

  if (!uploadResponse.ok) {
    throw new Error(uploadData?.error?.message || 'Could not upload image');
  }

  return {
    imageUrl: uploadData.secure_url as string,
    imageCloudinaryId: uploadData.public_id as string,
  };
}

function userDisplayName(firebaseUser: User | null, me: ApiUser | null) {
  const name = firebaseUser?.displayName?.trim();

  if (name) {
    return name.split(' ')[0];
  }

  const email = firebaseUser?.email || me?.email;

  if (!email) {
    return 'Account';
  }

  return email.split('@')[0].split(/[._-]/)[0] || 'Account';
}

function clearUrlSearch() {
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState({}, '', url.toString());
}

const routeStorageKey = 'bundo:last-route';
const validStoredViews: View[] = ['home', 'marketplace', 'workspace', 'admin', 'help'];
const validStoredWorkspaceSections: WorkspaceSection[] = [
  'overview',
  'bookings',
  'messages',
  'offers',
  'notifications',
  'reviews',
  'profile',
];

function readStoredRoute(role: Role | null) {
  try {
    const rawRoute = window.localStorage.getItem(routeStorageKey);
    if (!rawRoute) return null;

    const parsed = JSON.parse(rawRoute) as {
      view?: View;
      workspaceSection?: WorkspaceSection;
      adminSection?: AdminSection;
    };

    if (!parsed.view || !validStoredViews.includes(parsed.view)) {
      return null;
    }

    if (parsed.view === 'admin' && role !== 'ADMIN') {
      return null;
    }

    if (role === 'ARTISAN' && parsed.view === 'home') {
      window.localStorage.removeItem(routeStorageKey);
      return {
        view: 'workspace' as View,
        workspaceSection: 'overview' as WorkspaceSection,
        adminSection: 'overview' as AdminSection,
      };
    }

    return {
      view: parsed.view,
      workspaceSection:
        parsed.workspaceSection && validStoredWorkspaceSections.includes(parsed.workspaceSection)
          ? parsed.workspaceSection
          : 'overview',
      adminSection: parsed.adminSection || 'overview',
    };
  } catch {
    return null;
  }
}

function clearStoredRoute() {
  window.localStorage.removeItem(routeStorageKey);
}

const pendingSignupRoleStorageKey = 'bundo:pending-signup-role';

function pendingSignupRoleKey(emailAddress: string) {
  return `${pendingSignupRoleStorageKey}:${emailAddress.trim().toLowerCase()}`;
}

function savePendingSignupRole(emailAddress: string | null, role: SignupRole | null) {
  if (!emailAddress || !role) return;
  window.localStorage.setItem(pendingSignupRoleKey(emailAddress), role);
}

function readPendingSignupRole(emailAddress: string | null) {
  if (!emailAddress) return null;
  const storedRole = window.localStorage.getItem(pendingSignupRoleKey(emailAddress));
  return storedRole === 'CUSTOMER' || storedRole === 'ARTISAN' ? storedRole : null;
}

function clearPendingSignupRole(emailAddress: string | null) {
  if (!emailAddress) return;
  window.localStorage.removeItem(pendingSignupRoleKey(emailAddress));
}

function needsEmailVerification(user: User) {
  return user.providerData.some((provider) => provider.providerId === 'password') && !user.emailVerified;
}

function resetWorkspaceState() {
  return {
    view: 'home' as View,
    workspaceSection: 'overview' as WorkspaceSection,
  };
}

async function resolveApiSession(user: User, forceRefresh = false) {
  let idToken = await user.getIdToken(forceRefresh);

  try {
    const response = await api<{ user: ApiUser }>('/me', { token: idToken });
    return { token: idToken, user: response.user };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    idToken = await user.getIdToken(true);
    const retryResponse = await api<{ user: ApiUser }>('/me', { token: idToken });
    return { token: idToken, user: retryResponse.user };
  }
}

function notificationTypeLabel(type: Notification['type']) {
  return type
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function relativeNotificationTime(value: string) {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const minutes = Math.round(diffMs / (1000 * 60));

  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, 'minute');
  }

  const hours = Math.round(minutes / 60);

  if (Math.abs(hours) < 24) {
    return formatter.format(hours, 'hour');
  }

  const days = Math.round(hours / 24);

  if (Math.abs(days) < 7) {
    return formatter.format(days, 'day');
  }

  return bookingDate(value);
}

function App() {
  const [view, setView] = useState<View>('home');
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>('overview');
  const [adminSection, setAdminSection] = useState<AdminSection>('overview');
  const [routeHydrated, setRouteHydrated] = useState(false);
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
  const [busy, setBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>(hasPushConfig() ? 'idle' : 'missing-config');
  const [pushToken, setPushToken] = useState('');
  const currentTokenRef = useRef('');
  const currentUserRef = useRef<ApiUser | null>(null);

  const isAuthed = Boolean(firebaseUser && token);

  useEffect(() => {
    currentTokenRef.current = token;
  }, [token]);

  useEffect(() => {
    currentUserRef.current = me;
  }, [me]);

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
        api<{ bookings: Booking[] }>('/admin/bookings?page=1&limit=12', { token: authToken }),
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

  async function openArtisanProfile(artisanId: string) {
    await withNotice(async () => {
      const [artisanRes, reviewRes] = await Promise.all([
        api<{ artisan: Artisan }>(`/artisans/${artisanId}`),
        api<{ reviews: Review[] }>(`/artisans/${artisanId}/reviews`),
      ]);

      setSelectedArtisan(artisanRes.artisan);
      setSelectedArtisanReviews(reviewRes.reviews);
      setView('artisan-profile');
    }, 'Artisan profile loaded');
  }

  useEffect(() => {
    loadPublicData().catch(() => setNotice('Could not load marketplace data'));
  }, []);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        if (currentTokenRef.current) {
          syncPushToken(currentTokenRef.current, null).catch(() => undefined);
        }
        const resetState = resetWorkspaceState();
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
        setWorkspaceSection(resetState.workspaceSection);
        setView(resetState.view);
        setActiveHelpTopicId(null);
        setSelectedArtisan(null);
        setSelectedArtisanReviews([]);
        clearStoredRoute();
        clearUrlSearch();
        return;
      }

      if (needsEmailVerification(user)) {
        const resetState = resetWorkspaceState();
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
        setWorkspaceSection(resetState.workspaceSection);
        setView(resetState.view);
        setActiveHelpTopicId(null);
        setSelectedArtisan(null);
        setSelectedArtisanReviews([]);
        clearStoredRoute();
        return;
      }

      try {
        const session = await resolveApiSession(user);
        setToken(session.token);
        setMe(session.user);
        await loadPrivateData(session.token, session.user);

        const params = new URLSearchParams(window.location.search);
        const reference = params.get('reference') || params.get('trxref');
        const requestedView = params.get('view');
        const requestedSection = params.get('section');

        if (reference) {
          try {
            await api('/payments/verify-reference', {
              method: 'POST',
              token: session.token,
              body: JSON.stringify({ reference }),
            });
            await loadPrivateData(session.token, session.user);
            setWorkspaceSection('bookings');
            setView('workspace');
            setNotice('Payment confirmed and your booking has been updated');
          } catch (error) {
            setWorkspaceSection('bookings');
            setView('workspace');
            setNotice(
              error instanceof ApiError
                ? error.message
                : 'Payment callback received, but verification is still pending'
            );
          } finally {
            clearUrlSearch();
          }
          return;
        }

        if (session.user.role === 'ADMIN') {
          setAdminSection('overview');
          setView('admin');
          setRouteHydrated(true);
          clearUrlSearch();
          return;
        }

        if (
          requestedView &&
          ['home', 'marketplace', 'workspace', 'admin', 'help'].includes(
            requestedView
          )
        ) {
          setView(requestedView as View);
          if (
            requestedSection &&
            ['overview', 'bookings', 'messages', 'offers', 'notifications', 'reviews', 'profile'].includes(
              requestedSection
            )
          ) {
            setWorkspaceSection(requestedSection as WorkspaceSection);
          }
          setRouteHydrated(true);
          clearUrlSearch();
          return;
        }

        const storedRoute = readStoredRoute(session.user.role);
        if (storedRoute) {
          setWorkspaceSection(storedRoute.workspaceSection);
          setAdminSection(storedRoute.adminSection);
          setView(storedRoute.view);
        } else if (session.user.role === 'ARTISAN') {
          setWorkspaceSection('overview');
          setView('workspace');
        }
        setRouteHydrated(true);
      } catch {
        const resetState = resetWorkspaceState();
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
        setWorkspaceSection(resetState.workspaceSection);
        setView(resetState.view);
        setNotice('We could not finish account sync. Please make sure the backend is running, then sign in again.');
      }
    });
  }, []);

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
    () => categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>),
    [categories]
  );
  const isRestoringAuthedRoute = isAuthed && Boolean(me?.role) && !routeHydrated;
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

  return (
    <div className="app-shell">
      {!hideGlobalHeader && (
      <header className={`topbar ${isAuthed ? 'signed-in-topbar' : ''}`}>
        <button className="brand" onClick={() => setView('home')}>
          <img className="brand-logo" src={bundoLogo} alt="Bundo logo" />
          <span>Bundo</span>
        </button>
        <nav aria-label="Main navigation">
          {isAuthed && (
            <>
              <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>Dashboard</button>
              <button className={view === 'marketplace' ? 'active' : ''} onClick={() => setView('marketplace')}>Categories</button>
              <button
                className={view === 'workspace' && workspaceSection === 'bookings' ? 'active' : ''}
                onClick={() => {
                  setWorkspaceSection('bookings');
                  setView('workspace');
                }}
              >
                {me?.role === 'ARTISAN' ? 'Jobs' : 'Bookings'}
              </button>
              <button
                className={view === 'workspace' && workspaceSection === 'messages' ? 'active' : ''}
                onClick={() => {
                  setWorkspaceSection('messages');
                  setView('workspace');
                }}
              >
                Messages
              </button>
              {me?.role === 'ARTISAN' && (
                <button
                  className={view === 'workspace' && workspaceSection === 'reviews' ? 'active' : ''}
                  onClick={() => {
                    setWorkspaceSection('reviews');
                    setView('workspace');
                  }}
                >
                  Reviews
                </button>
              )}
            </>
          )}
          {me?.role === 'ADMIN' && <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>Admin</button>}
          <button
            className={view === 'help' ? 'active' : ''}
            onClick={() => {
              setActiveHelpTopicId(null);
              setView('help');
            }}
          >
            Help
          </button>
        </nav>
        {isAuthed && (
          <form
            className="topbar-search"
            onSubmit={(event) => {
              event.preventDefault();
              void withNotice(async () => {
                await loadPublicData(selectedState, searchTerm);
                setView('marketplace');
              }, searchTerm.trim() ? `Searching for ${searchTerm.trim()}` : 'Showing available services');
            }}
          >
            <label>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search for artisan"
              />
            </label>
            <label>
              <span aria-hidden="true">⌖</span>
              <select
                value={selectedState}
                onChange={(event) => {
                  setSelectedState(event.target.value);
                }}
              >
                <option value="">Nigeria</option>
                {nigeriaStates.map((state) => (
                  <option key={state} value={state}>
                    {state}, Nigeria
                  </option>
                ))}
              </select>
            </label>
          </form>
        )}
        <AuthBox
          firebaseUser={firebaseUser}
          me={me}
          unreadCount={notifications.filter((notification) => !notification.readAt).length}
          onReady={(nextToken, nextUser) => {
            setToken(nextToken);
            setMe(nextUser);
            loadPrivateData(nextToken, nextUser).catch(() => undefined);
            if (nextUser.role === 'ADMIN') {
              setView('admin');
            } else if (nextUser.role === 'CUSTOMER') {
              setView('home');
            }
            setRouteHydrated(true);
          }}
          onNavigate={setView}
          onWorkspaceSection={setWorkspaceSection}
          onNotice={setNotice}
        />
      </header>
      )}

      {notice && <div className={`notice ${usesArtisanSetupHeader ? 'setup-notice' : ''}`}>{notice}</div>}
      {bookingSuccess && (
        <BookingSuccessDialog
          booking={bookingSuccess}
          onClose={() => setBookingSuccess(null)}
          onViewBookings={() => {
            setBookingSuccess(null);
            setWorkspaceSection('bookings');
            setView('workspace');
          }}
        />
      )}

      {isRestoringAuthedRoute && (
        <main className="page route-loading">
          <EmptyState title="Loading your workspace" body="Restoring the right page for your account." />
        </main>
      )}

      {!isRestoringAuthedRoute && view === 'home' && (
        isAuthed && me ? (
          me.role === 'ARTISAN' ? (
            <ArtisanLanding
              token={token}
              categories={categories}
              offerings={myOfferings}
              bookings={bookings}
              firebaseUser={firebaseUser}
              busy={busy}
              runAction={withNotice}
              refresh={async () => {
                await loadPublicData();
                await loadPrivateData();
              }}
              openBookings={() => {
                setWorkspaceSection('bookings');
                setView('workspace');
              }}
              openMessages={() => {
                setWorkspaceSection('messages');
                setView('workspace');
              }}
              openReviews={() => {
                setWorkspaceSection('reviews');
                setView('workspace');
              }}
              openProfile={() => {
                setWorkspaceSection('profile');
                setView('workspace');
              }}
            />
          ) : (
            <LoggedInHome
              me={me}
              firebaseUser={firebaseUser}
              categories={categories}
              offerings={publicOfferings}
              artisans={artisans}
              selectedState={selectedState}
              searchTerm={searchTerm}
              token={token}
              busy={busy}
              onSearchTermChange={setSearchTerm}
              onSelectedStateChange={setSelectedState}
              onBrowse={async (categoryId) => {
                setSelectedCategoryId(categoryId || '');
                await withNotice(async () => {
                  await loadPublicData(selectedState, searchTerm, { categoryId: categoryId || '' });
                  setView('marketplace');
                }, categoryId ? 'Category selected' : 'Opening marketplace');
              }}
              onSearch={async () => {
                await withNotice(async () => {
                  await loadPublicData(selectedState, searchTerm);
                  setView('marketplace');
                }, searchTerm.trim() ? `Searching for ${searchTerm.trim()}` : 'Showing available services');
              }}
              onViewProfile={openArtisanProfile}
              runAction={withNotice}
              reloadPrivate={() => loadPrivateData()}
              onBookingSuccess={setBookingSuccess}
              openBookings={() => {
                setWorkspaceSection('bookings');
                setView('workspace');
              }}
            />
          )
        ) : (
          <main>
            <Hero
              selectedState={selectedState}
              states={nigeriaStates}
              onStateChange={async (state) => {
                setSelectedState(state);
                await withNotice(async () => {
                  await loadPublicData(state, searchTerm);
                  setView('marketplace');
                }, state ? `Showing services in ${state}` : 'Showing all services');
              }}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              onSearch={async (state, queryText) => {
                setSelectedState(state);
                setSearchTerm(queryText);
                await withNotice(async () => {
                  await loadPublicData(state, queryText);
                  setView('marketplace');
                }, queryText.trim() ? `Searching for ${queryText.trim()}` : 'Showing available services');
              }}
              onBrowse={() => setView('marketplace')}
            />
            <WhySection />
            <ServicesSection categories={categories} onBrowse={() => setView('marketplace')} />
            <MarketplacePreview offerings={publicOfferings} onBrowse={() => setView('marketplace')} />
            <AppPromo />
            <Footer
              onOpenHelpTopic={(topicId) => {
                setActiveHelpTopicId(topicId);
                setView('help');
              }}
            />
          </main>
        )
      )}

      {view === 'marketplace' && (
        <main className="page">
          <section className="section-head">
            <p className="eyebrow">Book trusted help</p>
            <h1>Find skilled professionals near you</h1>
            <p>
              {selectedState || searchTerm
                ? `Browse approved artisans and offerings${selectedState ? ` in ${selectedState}` : ''}${searchTerm ? ` matching "${searchTerm}"` : ''}.`
                : 'Browse approved artisans, compare services, send a message, or place a booking request.'}
            </p>
          </section>

          <section className="toolbar" aria-label="Marketplace summary">
            {selectedState && <span>Location: {selectedState}</span>}
            {searchTerm && <span>Search: {searchTerm}</span>}
            {selectedCategoryId && (
              <span>
                Category: {categories.find((category) => category.id === selectedCategoryId)?.name || 'Selected'}
              </span>
            )}
            <span>{publicOfferings.length} services</span>
            <span>{artisans.length} artisans</span>
            <span>{categories.length} categories</span>
          </section>

          <MarketplaceFilters
            categories={categories}
            selectedState={selectedState}
            states={nigeriaStates}
            searchTerm={searchTerm}
            selectedCategoryId={selectedCategoryId}
            priceMin={priceMin}
            priceMax={priceMax}
            sort={marketplaceSort}
            onSelectedStateChange={setSelectedState}
            onSearchTermChange={setSearchTerm}
            onCategoryChange={setSelectedCategoryId}
            onPriceMinChange={setPriceMin}
            onPriceMaxChange={setPriceMax}
            onSortChange={setMarketplaceSort}
            onApply={() =>
              withNotice(
                async () => {
                  await loadPublicData(selectedState, searchTerm);
                },
                'Marketplace filters updated'
              )
            }
            onClear={async () => {
              setSelectedState('');
              setSearchTerm('');
              setSelectedCategoryId('');
              setPriceMin('');
              setPriceMax('');
              setMarketplaceSort('rating');
              await withNotice(
                async () => {
                  await loadPublicData('', '', {
                    categoryId: '',
                    minPrice: '',
                    maxPrice: '',
                    sort: 'rating',
                  });
                },
                'Marketplace filters cleared'
              );
            }}
          />

          <OfferingGrid
            offerings={publicOfferings}
            isAuthed={isAuthed}
            role={me?.role || null}
            token={token}
            busy={busy}
            runAction={withNotice}
            reloadPrivate={() => loadPrivateData()}
            onViewProfile={openArtisanProfile}
            onBookingSuccess={setBookingSuccess}
          />

          <section className="section-head compact">
            <h2>Approved artisans</h2>
            <p>Public profiles now respond to category, price, location, and sort signals to make discovery sharper.</p>
          </section>
          <div className="grid three">
            {artisans.length === 0 && <EmptyState title="No artisans yet" body="Approve artisan profiles from admin to make them visible here." />}
            {artisans.map((artisan) => (
              <article className="artisan-card" key={artisan.id}>
                <div className="avatar">{artisan.displayName.slice(0, 1).toUpperCase()}</div>
                <div>
                  <h3>{artisan.displayName}</h3>
                  <p>{artisan.bio || 'Trusted professional'}</p>
                  <p className="muted">{artisan.city}{artisan.area ? `, ${artisan.area}` : ''}</p>
                  <p className="rating">Rating {artisan.avgRating || 0} · {artisan.ratingCount} reviews</p>
                  <button className="text-button" onClick={() => openArtisanProfile(artisan.id)}>View profile</button>
                </div>
              </article>
            ))}
          </div>
        </main>
      )}

      {view === 'artisan-profile' && selectedArtisan && (
        <ArtisanProfilePage
          artisan={selectedArtisan}
          reviews={selectedArtisanReviews}
          isAuthed={isAuthed}
          role={me?.role || null}
          token={token}
          busy={busy}
          runAction={withNotice}
          onBack={() => setView('marketplace')}
          reloadPrivate={() => loadPrivateData()}
          onBookingSuccess={setBookingSuccess}
        />
      )}

      {view === 'help' && (
        <HelpCenter
          activeTopicId={activeHelpTopicId}
          onOpenTopic={setActiveHelpTopicId}
          onBack={() => {
            setActiveHelpTopicId(null);
            setView('home');
          }}
        />
      )}

      {usesArtisanWorkspaceHeader && (
        <ArtisanAppHeader
          displayName={userDisplayName(firebaseUser, me)}
          active={artisanHeaderActive}
          onDashboard={() => {
            setWorkspaceSection('overview');
            setView('workspace');
          }}
          onJobs={() => {
            setWorkspaceSection('bookings');
            setView('workspace');
          }}
          onMessages={() => {
            setWorkspaceSection('messages');
            setView('workspace');
          }}
          onReviews={() => {
            setWorkspaceSection('reviews');
            setView('workspace');
          }}
          onProfile={() => {
            setWorkspaceSection('profile');
            setView('workspace');
          }}
        />
      )}

      {view === 'workspace' && (
        <main className={`page workspace-page ${workspaceSection === 'messages' ? 'messages-workspace' : ''} ${me?.role === 'ARTISAN' ? 'artisan-workspace-page' : ''}`}>
          {workspaceSection !== 'messages' && me?.role !== 'ARTISAN' && (
            <section className="section-head">
              <p className="eyebrow">Workspace</p>
              <h1>
                {workspaceSection === 'bookings'
                  ? 'Bookings'
                  : workspaceSection === 'offers'
                    ? 'Manage offers'
                    : 'Manage your Bundo account'}
              </h1>
              <p>
                {workspaceSection === 'bookings'
                  ? 'Track service requests and booking activity.'
                  : workspaceSection === 'offers'
                    ? 'Update your artisan profile and service listings.'
                    : firebaseUser
                      ? firebaseUser.email
                      : 'Sign in to manage profile settings, bookings, messages, and account updates.'}
              </p>
            </section>
          )}

          {!firebaseReady && (
            <div className="notice warning">
              Add Firebase web config in <code>client/.env</code> to enable login.
            </div>
          )}

          {!me && (
            <EmptyState
              title="Sign in to continue"
              body="Use the login form in the header, then choose customer or artisan to unlock the matching workspace."
            />
          )}

          {me && workspaceSection === 'messages' && (
            <ChatPanel
              token={token}
              currentUserId={me.firebaseUid}
              conversations={conversations}
              busy={busy}
              runAction={withNotice}
              refresh={() => loadPrivateData()}
            />
          )}

          {me && workspaceSection === 'bookings' && (
            <BookingsPage
              bookings={bookings}
              mode={me.role === 'ARTISAN' ? 'artisan' : 'customer'}
              token={token}
              busy={busy}
              runAction={withNotice}
              refresh={() => loadPrivateData()}
              openMessages={() => setWorkspaceSection('messages')}
            />
          )}

          {me && workspaceSection === 'offers' && me.role === 'ARTISAN' && (
            <div className="dashboard-grid">
              <ArtisanOffersPanel
                token={token}
                categories={categoryOptions}
                offerings={myOfferings}
                busy={busy}
                runAction={withNotice}
                refresh={async () => {
                  await loadPublicData();
                  await loadPrivateData();
                }}
              />
            </div>
          )}

          {me && workspaceSection === 'offers' && me.role !== 'ARTISAN' && (
            <EmptyState
              title="Artisan tools"
              body="Apply as an artisan from profile settings, then complete KYC and wait for admin approval before listing offers."
            />
          )}

          {me && workspaceSection === 'notifications' && (
            <NotificationsPanel
              token={token}
              notifications={notifications}
              busy={busy}
              runAction={withNotice}
              refresh={() => loadPrivateData()}
              pushStatus={pushStatus}
              pushEnabled={Boolean(pushToken)}
              enablePushAlerts={enablePushAlerts}
            />
          )}

          {me && workspaceSection === 'reviews' && me.role === 'ARTISAN' && (
            <ArtisanReviewsPanel token={token} />
          )}

          {me && workspaceSection === 'profile' && me.role === 'ARTISAN' && (
            <ArtisanProfileSettings
              token={token}
              firebaseUser={firebaseUser}
              busy={busy}
              runAction={withNotice}
              refresh={() => loadPrivateData()}
            />
          )}

          {me && workspaceSection === 'overview' && (
            me.role === 'ARTISAN' ? (
              <ArtisanDashboard
                token={token}
                bookings={bookings}
                firebaseUser={firebaseUser}
                busy={busy}
                runAction={withNotice}
                refresh={() => loadPrivateData()}
                openBookings={() => setWorkspaceSection('bookings')}
                openMessages={() => setWorkspaceSection('messages')}
                openReviews={() => setWorkspaceSection('reviews')}
                openProfile={() => setWorkspaceSection('profile')}
                openOffers={() => setWorkspaceSection('offers')}
              />
            ) : (
              <div className="dashboard-grid">
                <AccountSettingsPanel
                  token={token}
                  me={me}
                  busy={busy}
                  runAction={withNotice}
                  refresh={async () => {
                    const user = await refreshMe();
                    await loadPrivateData(token, user || me);
                  }}
                />
                <BookingsSummary bookings={bookings} title="My bookings" />
              </div>
            )
          )}
        </main>
      )}

      {view === 'admin' && (
        <main className="admin-page">
          <AdminConsole
            section={adminSection}
            setSection={setAdminSection}
            stats={adminStats}
            users={adminUsers}
            artisans={adminArtisans}
            bookings={adminBookings}
            conversations={adminConversations}
            submissions={adminKycSubmissions}
            categories={adminCategories}
            token={token}
            adminLabel={firebaseUser?.email || me?.email || 'Admin'}
            busy={busy}
            runAction={withNotice}
            refresh={() => loadPrivateData()}
            onSignOut={() => {
              setAdminSection('overview');
              setView('home');
              setNotice('Signed out');
              auth && signOut(auth);
            }}
          />
        </main>
      )}
    </div>
  );
}

function AuthBox({
  firebaseUser,
  me,
  unreadCount,
  onReady,
  onNavigate,
  onWorkspaceSection,
  onNotice,
}: {
  firebaseUser: User | null;
  me: ApiUser | null;
  unreadCount: number;
  onReady: (token: string, user: ApiUser) => void;
  onNavigate: (view: View) => void;
  onWorkspaceSection: (section: WorkspaceSection) => void;
  onNotice: (message: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [authStep, setAuthStep] = useState<'role' | 'account' | 'verify'>('account');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preferredRole, setPreferredRole] = useState<SignupRole | null>(null);
  const [pendingAuthUser, setPendingAuthUser] = useState<User | null>(null);
  const [pendingEmailVerificationUser, setPendingEmailVerificationUser] = useState<User | null>(null);

  async function finishAuth(
    firebaseAuthUser: User,
    authMode = mode,
    roleOverride = preferredRole,
    forceTokenRefresh = false
  ) {
    const rememberedRole = readPendingSignupRole(firebaseAuthUser.email);
    const intendedRole = roleOverride || rememberedRole;
    let session = await resolveApiSession(firebaseAuthUser, forceTokenRefresh);

    if (
      intendedRole &&
      session.user.role !== intendedRole &&
      session.user.role !== 'ADMIN' &&
      !(session.user.role === 'ARTISAN' && intendedRole === 'CUSTOMER')
    ) {
      await api('/users/role', {
        method: 'PATCH',
        token: session.token,
        body: JSON.stringify({ role: intendedRole }),
      });
      const refreshed = await api<{ user: ApiUser }>('/me', { token: session.token });
      session = {
        token: session.token,
        user: refreshed.user,
      };
    }

    if (!session.user.role && session.user.role !== 'ADMIN') {
      setPendingAuthUser(firebaseAuthUser);
      setPreferredRole(rememberedRole);
      setMode('signup');
      setAuthStep(rememberedRole ? 'account' : 'role');
      setDrawerOpen(true);
      onNotice('Choose client or artisan to finish setting up your Bundo account.');
      return;
    }

    clearPendingSignupRole(firebaseAuthUser.email);
    onReady(session.token, session.user);
    if (session.user.role === 'ARTISAN') {
      onWorkspaceSection('overview');
      onNavigate(authMode === 'signup' || intendedRole === 'ARTISAN' ? 'home' : 'workspace');
      onNotice(
        'Your artisan onboarding is ready. Complete your profile, KYC, and offerings for admin review.'
      );
    } else if (authMode === 'signup') {
      onNotice('Account created. Welcome to Bundo.');
    } else {
      onNotice('Signed in');
    }

    setDrawerOpen(false);
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setPreferredRole(null);
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setAuthStep('account');
  }

  async function sendVerification(user: User) {
    savePendingSignupRole(user.email, preferredRole);
    await sendEmailVerification(user);
    setPendingEmailVerificationUser(user);
    setAuthStep('verify');
    onNotice('Verification email sent. Check your inbox, then come back to continue.');
  }

  async function confirmEmailVerification() {
    const user = pendingEmailVerificationUser || auth?.currentUser;

    if (!user) {
      onNotice('Sign in again so we can check your verification status.');
      return;
    }

    setSubmitting(true);
    try {
      await user.reload();
      const refreshedUser = auth?.currentUser || user;

      if (!refreshedUser.emailVerified) {
        onNotice('Email is not verified yet. Open the verification link, then try again.');
        return;
      }

      await finishAuth(refreshedUser, 'signup', readPendingSignupRole(refreshedUser.email) || preferredRole, true);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not check verification status');
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerification() {
    const user = pendingEmailVerificationUser || auth?.currentUser;

    if (!user) {
      onNotice('Sign in again so we can send a verification email.');
      return;
    }

    setSubmitting(true);
    try {
      await sendVerification(user);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not send verification email');
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;

    if (!email.trim()) {
      onNotice('Enter your email address first.');
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      onNotice('Password reset email sent. Check your inbox.');
      setMode('login');
      setAuthStep('account');
      setPassword('');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not send password reset email');
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;

    if (mode === 'signup' && !preferredRole) {
      setAuthStep('role');
      onNotice('Choose how you want to use Bundo first.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      onNotice('Passwords do not match. Please retype them and try again.');
      return;
    }

    setSubmitting(true);
    onNotice('');
    try {
      const credential =
        mode === 'login'
          ? await signInWithEmailAndPassword(auth, email, password)
          : await createUserWithEmailAndPassword(auth, email, password);

      if (mode === 'signup' && fullName.trim()) {
        await updateProfile(credential.user, { displayName: fullName.trim() });
      }

      if (mode === 'signup' && !credential.user.emailVerified) {
        await sendVerification(credential.user);
        return;
      }

      if (mode === 'login' && credential.user.providerData.some((provider) => provider.providerId === 'password') && !credential.user.emailVerified) {
        setPendingEmailVerificationUser(credential.user);
        setAuthStep('verify');
        onNotice('Please verify your email before continuing.');
        return;
      }

      await finishAuth(credential.user);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setSubmitting(false);
    }
  }

  async function continueWithGoogle() {
    if (!auth) return;

    if (mode === 'signup' && !preferredRole) {
      setAuthStep('role');
      onNotice('Choose how you want to use Bundo first.');
      return;
    }

    setSubmitting(true);
    onNotice('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);
      await finishAuth(credential.user);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not continue with Google');
    } finally {
      setSubmitting(false);
    }
  }

  function chooseRole(role: SignupRole) {
    setPreferredRole(role);

    if (pendingAuthUser) {
      void finishAuth(pendingAuthUser, 'signup', role);
      return;
    }

    setAuthStep('account');
    onNotice('');
  }

  function openLogin() {
    setPreferredRole(null);
    setConfirmPassword('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setMode('login');
    setAuthStep('account');
    setDrawerOpen(true);
  }

  function openSignup(role: SignupRole | null = null) {
    setPreferredRole(role);
    setConfirmPassword('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setMode('signup');
    setAuthStep(role ? 'account' : 'role');
    setDrawerOpen(true);
  }

  function openResetPassword() {
    setPassword('');
    setConfirmPassword('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setMode('reset');
    setAuthStep('account');
  }

  function switchMode() {
    if (mode === 'login' || mode === 'reset') {
      openSignup();
      return;
    }

    setMode('login');
    setPreferredRole(null);
    setConfirmPassword('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setAuthStep('account');
  }

  if (firebaseUser && me) {
    const displayName = userDisplayName(firebaseUser, me);
    const initial = displayName.slice(0, 1).toUpperCase();
    const role = me?.role || null;
    const roleLabel = role ? role.toLowerCase() : 'setup account';

    const goTo = (target: View, message?: string) => {
      setMenuOpen(false);
      onNavigate(target);
      if (message) {
        onNotice(message);
      }
    };

    const goToWorkspace = (section: WorkspaceSection, message?: string) => {
      onWorkspaceSection(section);
      goTo('workspace', message);
    };

    return (
      <div className="auth-summary">
        <button
          className="account-chip"
          type="button"
          aria-label="Open account menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="account-avatar">{initial}</span>
          {unreadCount > 0 && <span className="account-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>

        {menuOpen && (
          <div className="account-menu">
            <div className="account-menu-head">
              <span className="account-avatar large">{initial}</span>
              <div>
                <strong>{displayName}</strong>
                <small>{firebaseUser.email || me?.email || roleLabel}</small>
                <em>{roleLabel}</em>
              </div>
            </div>

            {role === 'ARTISAN' ? (
              <>
                <button onClick={() => goToWorkspace('overview')}>Dashboard</button>
                <button onClick={() => goToWorkspace('profile')}>Your profile</button>
                <button onClick={() => goToWorkspace('offers')}>Manage offers</button>
                <button onClick={() => goToWorkspace('bookings')}>Booking requests</button>
                <button onClick={() => goToWorkspace('messages')}>Messages</button>
                <button onClick={() => goToWorkspace('reviews')}>Reviews</button>
                <button onClick={() => goToWorkspace('notifications')}>Notifications</button>
              </>
            ) : role === 'ADMIN' ? (
              <>
                <button onClick={() => goTo('admin')}>Admin center</button>
                <button onClick={() => goToWorkspace('overview')}>Dashboard</button>
                <button onClick={() => goTo('admin', 'Support chats are in the admin conversation panel')}>Support chats</button>
                <button onClick={() => goToWorkspace('notifications')}>Notifications</button>
              </>
            ) : (
              <>
                <button onClick={() => goToWorkspace('overview')}>Dashboard</button>
                <button onClick={() => goToWorkspace('bookings')}>My bookings</button>
                <button onClick={() => goToWorkspace('messages')}>Messages</button>
                <button onClick={() => goToWorkspace('notifications')}>Notifications</button>
              </>
            )}

            <button onClick={() => goTo('help')}>Help</button>
            <button
              className="danger-menu-item"
              onClick={() => {
                setMenuOpen(false);
                onWorkspaceSection('overview');
                onNavigate('home');
                onNotice('Signed out');
                auth && signOut(auth);
              }}
            >
              Log out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="auth-entry">
      <button type="button" onClick={openLogin}>
        Login
      </button>
      <button type="button" className="signup-link" onClick={() => openSignup()}>
        Sign up
      </button>

      {drawerOpen && (
        <div className="auth-overlay" role="presentation" onClick={() => setDrawerOpen(false)}>
          <aside
            className="auth-drawer"
            aria-label="Authentication panel"
            aria-modal="true"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-head">
              <img className="drawer-logo" src={bundoLogo} alt="Bundo logo" />
              <button type="button" onClick={() => setDrawerOpen(false)}>Close</button>
            </div>

            {authStep === 'verify' ? (
              <>
                <p className="eyebrow">Verify your email</p>
                <h2>Check your inbox</h2>
                <p className="drawer-copy">
                  We sent a verification link to {pendingEmailVerificationUser?.email || email || 'your email address'}.
                  Open that link, then return here to continue into your Bundo account.
                </p>
                <div className="auth-status-card">
                  <strong>Email verification required</strong>
                  <span>
                    This helps protect bookings, messages, payments, and artisan verification from fake or mistyped accounts.
                  </span>
                </div>
                <div className="auth-action-stack">
                  <button type="button" onClick={confirmEmailVerification} disabled={submitting}>
                    {submitting ? 'Checking...' : "I've verified my email"}
                  </button>
                  <button type="button" className="secondary-button" onClick={resendVerification} disabled={submitting}>
                    Resend verification email
                  </button>
                  <button type="button" className="mode-switch" onClick={openLogin}>
                    Back to login
                  </button>
                </div>
              </>
            ) : mode === 'signup' && authStep === 'role' ? (
              <>
                <p className="eyebrow">Create your account</p>
                <h2>How will you use Bundo?</h2>
                <p className="drawer-copy">
                  Choose the account type that matches your first workflow. You can manage your setup from the dashboard after login.
                </p>

                <div className="role-choice-grid" aria-label="Choose account type">
                  <button type="button" className="role-choice-card" onClick={() => chooseRole('CUSTOMER')}>
                    <span>Client</span>
                    <strong>Find and book trusted services</strong>
                    <small>Browse professionals, message artisans, request bookings, and track jobs.</small>
                  </button>
                  <button type="button" className="role-choice-card artisan" onClick={() => chooseRole('ARTISAN')}>
                    <span>Artisan</span>
                    <strong>Offer services on Bundo</strong>
                    <small>Create a profile, add offerings, complete verification, and receive bookings.</small>
                  </button>
                </div>

                <button type="button" className="mode-switch" onClick={switchMode}>
                  Already have an account? Login
                </button>
              </>
            ) : (
              <>
                <p className="eyebrow">
                  {mode === 'reset'
                    ? 'Reset access'
                    : mode === 'login'
                    ? 'Welcome back'
                    : preferredRole === 'ARTISAN'
                      ? 'Join as an artisan'
                      : 'Join as a client'}
                </p>
            <h2>
                  {mode === 'reset'
                    ? 'Reset your password'
                    : mode === 'login'
                    ? 'Login to your account'
                    : preferredRole === 'ARTISAN'
                      ? 'Create your artisan account'
                      : 'Create your client account'}
            </h2>
            <p className="drawer-copy">
                  {mode === 'reset'
                    ? 'Enter your account email and Firebase will send a secure password reset link.'
                    : mode === 'login'
                    ? 'Continue with Google or your email to pick up your marketplace workflow.'
                    : preferredRole === 'ARTISAN'
                      ? 'Start with your login, then complete profile setup, verification, offerings, and admin review from your workspace.'
                      : 'Start with your login, then browse, message, book, and manage service requests from your dashboard.'}
            </p>

                {mode === 'signup' && (
                  <div className="selected-role-banner">
                    <span>{preferredRole === 'ARTISAN' ? 'Artisan account' : 'Client account'}</span>
                    <button type="button" onClick={() => setAuthStep('role')}>Change</button>
                  </div>
                )}

                {mode !== 'reset' && (
                  <>
                    <button type="button" className="google-auth-button" onClick={continueWithGoogle} disabled={!firebaseReady || submitting}>
                      <span aria-hidden="true">G</span>
                      Continue with Google
                    </button>

                    <div className="auth-divider"><span>or</span></div>
                  </>
                )}

            <form className="auth-form" onSubmit={mode === 'reset' ? resetPassword : submit}>
                  {mode === 'signup' && (
                    <label>
                      Full name
                      <input
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="Your full name"
                        type="text"
                        autoComplete="name"
                        required
                      />
                    </label>
                  )}
              <label>
                Email
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      autoComplete="email"
                      required
                    />
              </label>
                  {mode !== 'reset' && (
                    <label>
                      Password
                      <input
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Your password"
                        type="password"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        minLength={6}
                        required
                      />
                    </label>
                  )}
                  {mode === 'signup' && (
                    <label>
                      Verify password
                      <input
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Retype your password"
                        type="password"
                        autoComplete="new-password"
                        minLength={6}
                        required
                      />
                    </label>
                  )}
              <button disabled={!firebaseReady || submitting}>
                    {submitting
                      ? 'Please wait'
                      : mode === 'reset'
                        ? 'Send reset link'
                      : mode === 'login'
                        ? 'Login'
                        : preferredRole === 'ARTISAN'
                          ? 'Create artisan account'
                          : 'Create client account'}
              </button>
            </form>

                {mode === 'login' && (
                  <button type="button" className="forgot-password-link" onClick={openResetPassword}>
                    Forgot password?
                  </button>
                )}

                <button type="button" className="mode-switch" onClick={switchMode}>
              {mode === 'login' || mode === 'reset' ? 'New here? Sign up' : 'Already have an account? Login'}
            </button>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function categoryIcon(iconKey?: string) {
  const icons: Record<string, string> = {
    broom: '▤',
    cake: '◐',
    camera: '◉',
    needle: '⌁',
    scissors: '✂',
    sparkles: '✦',
    wrench: '⌁',
  };

  return icons[iconKey || ''] || '■';
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <article className="artisan-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function ArtisanAppHeader({
  displayName,
  active,
  onDashboard,
  onJobs,
  onMessages,
  onReviews,
  onProfile,
}: {
  displayName: string;
  active: 'Dashboard' | 'Jobs' | 'Messages' | 'Reviews';
  onDashboard: () => void;
  onJobs: () => void;
  onMessages: () => void;
  onReviews: () => void;
  onProfile: () => void;
}) {
  const navItems = [
    ['Dashboard', onDashboard],
    ['Jobs', onJobs],
    ['Messages', onMessages],
    ['Reviews', onReviews],
  ] as const;

  return (
    <header className="artisan-app-header">
      <button className="brand" onClick={onDashboard}>
        <img className="brand-logo" src={bundoLogo} alt="Bundo logo" />
        <span>Bundo</span>
      </button>
      <nav aria-label="Artisan navigation">
        {navItems.map(([label, action]) => (
          <button
            key={label}
            className={active === label ? 'active' : ''}
            onClick={action}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="artisan-header-actions">
        <button aria-label="Notifications">⌂</button>
        <button className="artisan-user-chip" onClick={onProfile}>
          <span>{displayName.slice(0, 1).toUpperCase()}</span>
          {displayName.split(' ')[0]}
        </button>
      </div>
    </header>
  );
}

function ArtisanLanding({
  token,
  categories,
  offerings,
  bookings,
  firebaseUser,
  busy,
  runAction,
  refresh,
  openBookings,
  openMessages,
  openReviews,
  openProfile,
}: {
  token: string;
  categories: Category[];
  offerings: Offering[];
  bookings: Booking[];
  firebaseUser: User | null;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  openBookings: () => void;
  openMessages: () => void;
  openReviews: () => void;
  openProfile: () => void;
}) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [portfolioImages, setPortfolioImages] = useState<PortfolioImage[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const [step, setStep] = useState(1);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [setup, setSetup] = useState({
    fullName: firebaseUser?.displayName || '',
    businessName: '',
    categoryId: '',
    location: 'Lagos',
    area: 'Lekki',
    lat: '6.5244',
    lng: '3.3792',
    title: 'Basic inspection',
    priceFrom: '',
    description: '',
    documentNumber: '',
    address: 'Lagos',
  });
  const [servicePackages, setServicePackages] = useState([
    {
      localId: 'package-1',
      categoryId: '',
      title: 'Basic inspection',
      priceFrom: '',
      description: '',
    },
  ]);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [agreed, setAgreed] = useState(false);
  const [submitAgreed, setSubmitAgreed] = useState(false);
  const kycStatus = kycSubmission?.status ?? 'NOT_SUBMITTED';
  const approved = profile?.verifyStatus === 'APPROVED' && kycStatus === 'APPROVED';
  const displayName = profile?.displayName || firebaseUser?.displayName || 'Artisan';

  useEffect(() => {
    let mounted = true;

    Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ images: PortfolioImage[] }>('/artisans/portfolio-images/me', { token }).catch(() => ({ images: [] })),
      api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', { token }).catch(() => ({ slots: [] })),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }),
    ]).then(([profileResponse, imageResponse, slotResponse, kycResponse]) => {
      if (!mounted) return;
      const nextProfile = profileResponse.profile || null;
      setProfile(nextProfile);
      setPortfolioImages(imageResponse.images);
      setAvailabilitySlots(slotResponse.slots);
      setKycSubmission(kycResponse.submission);
      setSetup((current) => ({
        ...current,
        fullName: current.fullName || nextProfile?.displayName || firebaseUser?.displayName || '',
        businessName: nextProfile?.displayName || current.businessName,
        location: nextProfile?.city || current.location,
        area: nextProfile?.area || current.area,
        lat: String(nextProfile?.lat ?? current.lat),
        lng: String(nextProfile?.lng ?? current.lng),
        address: kycResponse.submission?.address || current.address,
        documentNumber: kycResponse.submission?.documentNumber || current.documentNumber,
      }));
    });

    return () => {
      mounted = false;
    };
  }, [firebaseUser, token]);

  async function hydrateOnboarding() {
    const [profileResponse, imageResponse, slotResponse, kycResponse] = await Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ images: PortfolioImage[] }>('/artisans/portfolio-images/me', { token }).catch(() => ({ images: [] })),
      api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', { token }).catch(() => ({ slots: [] })),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }),
    ]);
    setProfile(profileResponse.profile || null);
    setPortfolioImages(imageResponse.images);
    setAvailabilitySlots(slotResponse.slots);
    setKycSubmission(kycResponse.submission);
  }

  function updateSetup(field: keyof typeof setup, value: string) {
    setSetup((current) => ({ ...current, [field]: value }));
  }

  function updateServicePackage(
    localId: string,
    field: 'categoryId' | 'title' | 'priceFrom' | 'description',
    value: string
  ) {
    setServicePackages((current) =>
      current.map((servicePackage) =>
        servicePackage.localId === localId
          ? { ...servicePackage, [field]: value }
          : servicePackage
      )
    );
  }

  function addServicePackage() {
    setServicePackages((current) => [
      ...current,
      {
        localId: `package-${Date.now()}`,
        categoryId: setup.categoryId,
        title: '',
        priceFrom: '',
        description: '',
      },
    ]);
  }

  function removeServicePackage(localId: string) {
    setServicePackages((current) =>
      current.length === 1
        ? current
        : current.filter((servicePackage) => servicePackage.localId !== localId)
    );
  }

  async function saveBasicInfo() {
    await api('/artisans/profile', {
      method: profile ? 'PATCH' : 'POST',
      token,
      body: JSON.stringify({
        displayName: setup.businessName.trim() || setup.fullName.trim(),
        bio: categories.find((category) => category.id === setup.categoryId)?.name || 'Bundo artisan',
        city: setup.location.trim(),
        area: setup.area.trim(),
        lat: Number(setup.lat),
        lng: Number(setup.lng),
      }),
    });
    await hydrateOnboarding();
    await refresh();
    setStep(2);
  }

  async function saveOffering() {
    const packagesToSave = servicePackages
      .map((servicePackage) => ({
        ...servicePackage,
        categoryId: servicePackage.categoryId || setup.categoryId || categories[0]?.id || '',
        title: servicePackage.title.trim(),
        description: servicePackage.description.trim(),
        priceFrom: Number(servicePackage.priceFrom.replace(/[^\d]/g, '')),
      }))
      .filter((servicePackage) => servicePackage.categoryId && servicePackage.title && servicePackage.priceFrom > 0);

    if (!packagesToSave.length) {
      throw new Error('Add at least one service package with a category, name, and price.');
    }

    for (const servicePackage of packagesToSave) {
      const alreadyExists = offerings.some(
        (offering) =>
          offering.categoryId === servicePackage.categoryId &&
          offering.title.trim().toLowerCase() === servicePackage.title.toLowerCase() &&
          offering.priceFrom === servicePackage.priceFrom
      );

      if (alreadyExists) continue;

      await api('/offerings', {
        method: 'POST',
        token,
        body: JSON.stringify({
          categoryId: servicePackage.categoryId,
          title: servicePackage.title,
          description: servicePackage.description || undefined,
          priceFrom: servicePackage.priceFrom,
        }),
      });
    }

    await refresh();
    setStep(3);
  }

  async function uploadPortfolioFile(file: File, displayOrder: number) {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please choose an image file.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Each image must be 5MB or smaller.');
    }

    setUploadingPortfolio(true);
    try {
      const signatureResponse = await api<{ upload: CloudinarySignedUpload }>(
        '/artisans/portfolio-images/sign-upload',
        { method: 'POST', token }
      );
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signatureResponse.upload.apiKey);
      formData.append('timestamp', String(signatureResponse.upload.timestamp));
      formData.append('folder', signatureResponse.upload.folder);
      formData.append('signature', signatureResponse.upload.signature);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signatureResponse.upload.cloudName}/image/upload`,
        { method: 'POST', body: formData }
      );
      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData?.error?.message || 'Could not upload image');
      }

      await api('/artisans/portfolio-images', {
        method: 'POST',
        token,
        body: JSON.stringify({
          cloudinaryId: uploadData.public_id,
          url: uploadData.secure_url,
          displayOrder,
        }),
      });
      await hydrateOnboarding();
    } finally {
      setUploadingPortfolio(false);
    }
  }

  async function uploadPortfolioFiles(files: File[]) {
    if (!files.length) return;

    const remainingSlots = Math.max(0, 12 - portfolioImages.length);
    const selectedFiles = files.slice(0, remainingSlots);

    if (!selectedFiles.length) {
      throw new Error('You can upload up to 12 portfolio images.');
    }

    for (const [index, file] of selectedFiles.entries()) {
      await uploadPortfolioFile(file, portfolioImages.length + index);
    }
  }

  async function submitForVerification() {
    await Promise.all(
      selectedDays
        .filter(
          (dayOfWeek) =>
            !availabilitySlots.some(
              (slot) =>
                slot.dayOfWeek === dayOfWeek &&
                slot.startTime === startTime &&
                slot.endTime === endTime
            )
        )
        .map((dayOfWeek) =>
          api('/artisans/availability-slots', {
            method: 'POST',
            token,
            body: JSON.stringify({ dayOfWeek, startTime, endTime }),
          })
        )
    );

    const response = await api<{ submission: ArtisanKycSubmission }>('/artisans/kyc', {
      method: 'POST',
      token,
      body: JSON.stringify({
        legalName: setup.fullName || displayName,
        documentType: 'NIN',
        documentNumber: setup.documentNumber,
        documentImageUrl: `pending-manual-review:${setup.documentNumber}`,
        address: setup.address || setup.location,
        city: setup.location,
      }),
    });
    setKycSubmission(response.submission);
    await hydrateOnboarding();
    await refresh();
  }

  if (approved) {
    const requestedBookings = bookings.filter((booking) => booking.status === 'REQUESTED');
    const activeBookings = bookings.filter((booking) => ['ACCEPTED', 'COMPLETED'].includes(booking.status));

    return (
      <>
      <ArtisanAppHeader
        displayName={displayName}
        active="Dashboard"
        onDashboard={() => undefined}
        onJobs={openBookings}
        onMessages={openMessages}
        onReviews={openReviews}
        onProfile={openProfile}
      />
      <main className="artisan-dashboard-page">
        <section className="artisan-dashboard-hero">
          <h1>Good morning, {displayName.split(' ')[0]}</h1>
          <div className="artisan-stat-grid">
            <StatCard label="Total bookings" value={bookings.length} hint="All time" />
            <StatCard label="Ratings" value={`${profile?.avgRating || 0}/5.0`} hint={`${profile?.ratingCount || 0} reviews`} />
            <StatCard label="Active jobs" value={activeBookings.length} hint="This week" />
            <StatCard label="New requests" value={requestedBookings.length} hint="Needs your response" />
          </div>
        </section>

        <section className="artisan-dashboard-grid">
          <div className="artisan-request-stack">
            <div className="logged-section-head">
              <h2>New Requests</h2>
              <button type="button" onClick={openBookings}>view all</button>
            </div>
            {requestedBookings.length === 0 && <EmptyState title="No new requests" body="New booking requests will appear here." />}
            {requestedBookings.slice(0, 2).map((booking) => (
              <article className="artisan-request-card" key={booking.id}>
                <span className="recommended-avatar">{(booking.customerUser?.email || 'C').slice(0, 1).toUpperCase()}</span>
                <div>
                  <h3>{booking.customerUser?.email?.split('@')[0] || 'Customer'}</h3>
                  <small>{booking.offering?.title || 'Service request'}</small>
                  <p>{bookingDate(booking.scheduledAt)} · {booking.artisan?.area || profile?.area || 'Lagos'}</p>
                  <div className="actions">
                    <button className="secondary-button" disabled={busy}>Decline</button>
                    <button disabled={busy}>Accept</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <aside className="artisan-side-stack">
            <article className="artisan-soft-card">
              <div className="logged-section-head">
                <h2>Availability</h2>
                <button type="button" onClick={() => setStep(4)}>Edit</button>
              </div>
              <div className="availability-dots">
                {dayLabels.slice(1).concat(dayLabels[0]).map((day, index) => {
                  const dayIndex = index === 6 ? 0 : index + 1;
                  return (
                    <span key={day} className={availabilitySlots.some((slot) => slot.dayOfWeek === dayIndex) ? 'active' : ''}>
                      {day.slice(0, 1)}
                    </span>
                  );
                })}
              </div>
            </article>
            <article className="artisan-soft-card">
              <h2>This week</h2>
              <dl className="summary-list">
                <div><dt>Jobs Completed</dt><dd>{bookings.filter((booking) => booking.status === 'COMPLETED').length}</dd></div>
                <div><dt>Jobs Upcoming</dt><dd>{activeBookings.length}</dd></div>
                <div><dt>Earnings</dt><dd>{money(0)}</dd></div>
              </dl>
            </article>
            <article className="artisan-soft-card quick-links">
              <h2>Quick links</h2>
              <button onClick={() => setStep(4)}>Update availability</button>
              <button onClick={() => setStep(2)}>Edit pricing</button>
              <button onClick={openBookings}>View jobs</button>
            </article>
          </aside>
        </section>
      </main>
      </>
    );
  }

  return (
    <main className="artisan-setup-page">
      <div className="artisan-setup-topline">
        <button className="brand setup-brand" type="button" onClick={() => setStep(1)}>
          <img className="brand-logo" src={bundoLogo} alt="Bundo logo" />
          <span>Bundo</span>
        </button>
      </div>

      <section className="artisan-setup-head">
        <div>
          <h1>Set up your artisan profile</h1>
          <p className="muted">Follow the steps below. Your profile goes live only after KYC and admin approval.</p>
        </div>
        <strong>Step {step} of 4</strong>
      </section>

      <div className="artisan-stepper" aria-label="Artisan setup steps">
        {['Basic info', 'Services & pricing', 'Portfolio', 'Availability & submit'].map((label, index) => {
          const number = index + 1;
          return (
            <button
              key={label}
              type="button"
              className={number <= step ? 'active' : ''}
              onClick={() => setStep(number)}
            >
              <span>{number}</span>
              {label}
            </button>
          );
        })}
      </div>

      {kycSubmission && (
        <div className={`payment-note artisan-review-note ${kycSubmission.status === 'APPROVED' ? 'success' : ''}`}>
          <strong>KYC status: {kycSubmission.status.toLowerCase().replace(/_/g, ' ')}</strong>
          <span>{kycSubmission.reviewNote || 'Admin will review your profile before it appears publicly.'}</span>
        </div>
      )}

      {step === 1 && (
        <section className="artisan-setup-card">
          <h2>Basic Information</h2>
          <p>Tell us a bit about yourself so customers can find and trust you.</p>
          <label>Full Name<span>*</span><input value={setup.fullName} onChange={(event) => updateSetup('fullName', event.target.value)} placeholder="Enter your name" required /></label>
          <small>As in any legal documentation</small>
          <label>Business Name<span>(Optional)</span><input value={setup.businessName} onChange={(event) => updateSetup('businessName', event.target.value)} placeholder="e.g Plumber, Hair stylist...etc" /></label>
          <small>Leave blank to use your full name</small>
          <label>Service Category<span>(Required)</span>
            <select value={setup.categoryId} onChange={(event) => updateSetup('categoryId', event.target.value)} required>
              <option value="">Select a category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <small>E.g Plumbing, Carpentry, Make-up Artist</small>
          <label>Location<span>(Required)</span><input value={setup.location} onChange={(event) => updateSetup('location', event.target.value)} placeholder="Search for your city or area" required /></label>
          <button className="location-link" type="button">⌖ Use your current location</button>
          <label className="terms-row"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> <span>By continuing, you agree to our Terms of Service and Privacy Policy.</span></label>
        </section>
      )}

      {step === 2 && (
        <section className="artisan-setup-card wide">
          <h2>Set your pricing</h2>
          <p>Give customers a clear idea of what to expect before they book. You can update this any time.</p>
          <div className="setup-package-stack">
            {servicePackages.map((servicePackage, index) => (
              <article className="setup-package-card" key={servicePackage.localId}>
                <div className="setup-package-head">
                  <h3>Package {index + 1}</h3>
                  {servicePackages.length > 1 && (
                    <button type="button" onClick={() => removeServicePackage(servicePackage.localId)}>
                      Remove
                    </button>
                  )}
                </div>
                <label>
                  Primary Service
                  <select
                    value={servicePackage.categoryId || setup.categoryId}
                    onChange={(event) => updateServicePackage(servicePackage.localId, 'categoryId', event.target.value)}
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <div className="setup-two-col">
                  <label>
                    Service name
                    <input
                      value={servicePackage.title}
                      onChange={(event) => updateServicePackage(servicePackage.localId, 'title', event.target.value)}
                      placeholder="Basic inspection"
                      required
                    />
                  </label>
                  <label>
                    Price(₦)
                    <input
                      value={servicePackage.priceFrom}
                      onChange={(event) => updateServicePackage(servicePackage.localId, 'priceFrom', event.target.value)}
                      placeholder="5,000"
                      inputMode="numeric"
                      required
                    />
                  </label>
                </div>
                <label>
                  Description
                  <textarea
                    value={servicePackage.description}
                    onChange={(event) => updateServicePackage(servicePackage.localId, 'description', event.target.value)}
                    placeholder="Diagnosis and minor fixes"
                  />
                </label>
              </article>
            ))}
          </div>
          <p className="orange-note">Packages help customers understand your offering upfront. You can still negotiate pricing directly with customers after a booking request is made.</p>
          <button type="button" className="full-orange" onClick={addServicePackage}>＋ Add another Package</button>
        </section>
      )}

      {step === 3 && (
        <section className="artisan-setup-card media-step">
          <h2>Add your photos</h2>
          <p>A great profile photo and strong portfolio help customers choose you with confidence.</p>
          <label className="profile-upload">
            <span>Upload a photo <small>JPG or PNG · Max 5MB · Square crop recommended</small></span>
            <strong>Choose file</strong>
            <input type="file" accept="image/*" multiple disabled={busy || uploadingPortfolio} onChange={(event) => {
              const files = Array.from(event.target.files || []);
              if (!files.length) return;
              void runAction(() => uploadPortfolioFiles(files), files.length > 1 ? 'Photos uploaded' : 'Photo uploaded');
              event.currentTarget.value = '';
            }} />
          </label>
          <h3>Portfolio images</h3>
          <small>Show customers examples of your past work. Upload up to 12 photos.</small>
          <div className="setup-portfolio-grid">
            <label className="portfolio-upload-tile">
              <span>⇧</span>
              Upload a photo
              <input type="file" accept="image/*" multiple disabled={busy || uploadingPortfolio || portfolioImages.length >= 12} onChange={(event) => {
                const files = Array.from(event.target.files || []);
                if (!files.length) return;
                void runAction(() => uploadPortfolioFiles(files), files.length > 1 ? 'Portfolio images uploaded' : 'Portfolio image uploaded');
                event.currentTarget.value = '';
              }} />
            </label>
            {portfolioImages.slice(0, 11).map((image) => <img key={image.id} src={image.url} alt="Portfolio" />)}
            {Array.from({ length: Math.max(0, 11 - portfolioImages.length) }).map((_, index) => <div className="portfolio-placeholder" key={index}>▧</div>)}
          </div>
          <p className="muted">Artisans with 6+ portfolio photos get up to 3x more booking requests.</p>
        </section>
      )}

      {step === 4 && (
        <section className="artisan-setup-card availability-step">
          <h2>When are you available?</h2>
          <p>Customers will only be able to book you on days and times you select. You can update this anytime from your dashboard.</p>
          <h3>Days available</h3>
          <div className="day-picker">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <button
                key={day}
                type="button"
                className={selectedDays.includes(day) ? 'active' : ''}
                onClick={() => setSelectedDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])}
              >
                {dayLabels[day].slice(0, 1)}
              </button>
            ))}
          </div>
          <div className="setup-two-col">
            <label>From<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
            <label>To<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
          </div>
          <label>Residential address<input value={setup.address} onChange={(event) => updateSetup('address', event.target.value)} placeholder="Address for manual verification" /></label>
          <label>NIN or ID number<input value={setup.documentNumber} onChange={(event) => updateSetup('documentNumber', event.target.value)} placeholder="Required for verification" /></label>
          <label className="terms-row"><input type="checkbox" checked={submitAgreed} onChange={(event) => setSubmitAgreed(event.target.checked)} /> <span>Submitting for verification means our team will review your profile before it goes live.</span></label>
        </section>
      )}

      <div className="artisan-setup-actions">
        <button type="button" className="secondary-button" onClick={() => setStep((current) => Math.max(1, current - 1))}>{step === 1 ? 'Back' : 'Skip'}</button>
        {step === 1 && <button disabled={busy || !agreed || !setup.fullName || !setup.categoryId || !setup.location} onClick={() => runAction(saveBasicInfo, 'Basic profile saved')}>Next</button>}
        {step === 2 && <button disabled={busy || !servicePackages.some((servicePackage) => servicePackage.title.trim() && servicePackage.priceFrom.trim())} onClick={() => runAction(saveOffering, servicePackages.length > 1 ? 'Service packages saved' : 'Service package saved')}>Next</button>}
        {step === 3 && <button disabled={busy || uploadingPortfolio} onClick={() => setStep(4)}>Next</button>}
        {step === 4 && <button disabled={busy || !submitAgreed || !setup.documentNumber || selectedDays.length === 0} onClick={() => runAction(submitForVerification, 'Submitted for verification')}>Submit for verification</button>}
      </div>
    </main>
  );
}

function LoggedInHome({
  me,
  firebaseUser,
  categories,
  offerings,
  artisans,
  selectedState,
  searchTerm,
  token,
  busy,
  onSearchTermChange,
  onSelectedStateChange,
  onBrowse,
  onSearch,
  onViewProfile,
  runAction,
  reloadPrivate,
  onBookingSuccess,
  openBookings,
}: {
  me: ApiUser;
  firebaseUser: User | null;
  categories: Category[];
  offerings: Offering[];
  artisans: Artisan[];
  selectedState: string;
  searchTerm: string;
  token: string;
  busy: boolean;
  onSearchTermChange: (value: string) => void;
  onSelectedStateChange: (value: string) => void;
  onBrowse: (categoryId?: string) => Promise<void>;
  onSearch: () => Promise<void>;
  onViewProfile: (artisanId: string) => Promise<void>;
  runAction: ActionRunner;
  reloadPrivate: () => Promise<void>;
  onBookingSuccess: (booking: BookingSuccessState) => void;
  openBookings: () => void;
}) {
  const displayName = userDisplayName(firebaseUser, me);
  const recommendedOfferings = offerings.slice(0, 3);
  const featuredArtisan = artisans[0];
  const [activeOfferingAction, setActiveOfferingAction] = useState<string | null>(null);

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSearch();
  }

  async function bookRecommendedOffering(offering: Offering) {
    const actionKey = `book:${offering.id}`;
    setActiveOfferingAction(actionKey);

    try {
      await runAction(async () => {
        const response = await api<{ booking: Booking }>('/bookings', {
          method: 'POST',
          token,
          body: JSON.stringify({
            offeringId: offering.id,
            note: 'Booked from dashboard',
          }),
        });
        await reloadPrivate();
        onBookingSuccess({
          bookingId: response.booking.id,
          serviceTitle: offering.title,
          artisanName: offering.artisan?.displayName || 'this artisan',
        });
      }, 'Booking requested');
    } finally {
      setActiveOfferingAction(null);
    }
  }

  return (
    <main className="logged-home">
      <section className="logged-hero">
        <div className="logged-hero-copy">
          <p className="eyebrow">Welcome back, {displayName}</p>
          <h1>
            Connect with artisans who <span>deliver.</span>
          </h1>
          <form className="logged-hero-search" onSubmit={submitSearch}>
            <label>
              Search
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => onSearchTermChange(event.target.value)}
                placeholder="Cleaning, tailoring, repairs"
              />
            </label>
            <label>
              Location
              <select value={selectedState} onChange={(event) => onSelectedStateChange(event.target.value)}>
                <option value="">All Nigeria</option>
                {nigeriaStates.map((state) => (
                  <option key={state} value={state}>
                    {state}, Nigeria
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Search</button>
          </form>
          <div className="quick-service-grid" aria-label="Quick service picks">
            {categories.slice(0, 6).map((category) => (
              <button key={category.id} type="button" onClick={() => void onBrowse(category.id)}>
                <span>{categoryIcon(category.iconKey)}</span>
                {category.name}
              </button>
            ))}
            <button className="wide" type="button" onClick={() => void onBrowse()}>
              Browse marketplace
            </button>
            <button className="wide" type="button" onClick={openBookings}>
              My bookings
            </button>
          </div>
        </div>

        <div className="logged-hero-media">
          <img src={heroImage} alt="Bundo artisan completing a home service" />
          <div>
            <strong>{featuredArtisan?.displayName || 'Trusted professionals'}</strong>
            <span>
              {featuredArtisan
                ? `${featuredArtisan.city}${featuredArtisan.area ? `, ${featuredArtisan.area}` : ''}`
                : 'Available across your marketplace'}
            </span>
          </div>
        </div>
      </section>

      <section className="logged-section">
        <div className="logged-section-head">
          <h2>Categories</h2>
          <button type="button" onClick={() => void onBrowse()}>View all categories</button>
        </div>
        <div className="logged-category-row">
          {categories.length === 0 && <span className="muted">Categories will appear here after seeding.</span>}
          {categories.slice(0, 7).map((category) => (
            <button key={category.id} type="button" onClick={() => void onBrowse(category.id)}>
              <span>{categoryIcon(category.iconKey)}</span>
              {category.name}
            </button>
          ))}
        </div>
      </section>

      <section className="logged-section">
        <div className="logged-section-head">
          <h2>Recommended</h2>
          <button type="button" onClick={() => void onBrowse()}>Browse artisans</button>
        </div>
        <div className="recommended-row">
          {recommendedOfferings.length === 0 && (
            <EmptyState
              title="No recommendations yet"
              body="Approved artisan offerings will appear here as your marketplace grows."
            />
          )}
          {recommendedOfferings.map((offering) => {
            const actionKey = `book:${offering.id}`;
            const isBookingThisOffering = activeOfferingAction === actionKey;

            return (
              <article className="recommended-card" key={offering.id}>
                <div className="recommended-card-head">
                  <span className="recommended-avatar">
                    {(offering.artisan?.displayName || 'B').slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <h3>{offering.artisan?.displayName || 'Approved artisan'}</h3>
                    <p>{offering.artisan?.area || offering.artisan?.city || 'Nearby'}</p>
                  </div>
                  <small>{offering.artisan?.city || 'Bundo'}</small>
                </div>
                <div className="recommended-tags">
                  <span>{offering.category?.name || 'Service'}</span>
                  <span>{offering.title}</span>
                </div>
                <div className="recommended-meta">
                  <span className="rating">★★★★★</span>
                  <span>{(offering.artisan?.avgRating || 0).toFixed(1)}({offering.artisan?.ratingCount || 0})</span>
                  <strong>From {money(offering.priceFrom)}</strong>
                </div>
                <button
                  className="primary-button"
                  disabled={me.role !== 'CUSTOMER' || isBookingThisOffering}
                  onClick={() => void bookRecommendedOffering(offering)}
                >
                  {isBookingThisOffering ? 'Booking...' : 'Book'}
                </button>
                {offering.artisan?.id && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => void onViewProfile(offering.artisan!.id)}
                  >
                    View profile
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Hero({
  selectedState,
  states,
  onStateChange,
  searchTerm,
  onSearchTermChange,
  onSearch,
  onBrowse,
}: {
  selectedState: string;
  states: string[];
  onStateChange: (state: string) => Promise<void>;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: (state: string, queryText: string) => Promise<void>;
  onBrowse: () => void;
}) {
  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSearch(selectedState, searchTerm);
  }

  return (
    <section className="hero">
      <div className="hero-media">
        <img src={heroImage} alt="Professional cleaning a bright home" />
      </div>
      <div className="hero-copy">
        <p className="eyebrow">BUNDO MARKETPLACE</p>
        <h1>Quality home services, on demand</h1>
        <p>Experienced professionals for the work that keeps daily life moving.</p>
        <form className="hero-search" onSubmit={submitSearch}>
          <div className="search-heading">
            <label htmlFor="service-state">Where do you need a service?</label>
            <span>Find trusted help near you</span>
          </div>
          <div className="location-control">
            <div className="field-shell">
              <span>Location</span>
              <select
                id="service-state"
                value={selectedState}
                onChange={(event) => onStateChange(event.target.value)}
              >
                <option value="">Select your state</option>
                {states.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            <div className="field-shell">
              <span>Service</span>
              <input
                value={searchTerm}
                onChange={(event) => onSearchTermChange(event.target.value)}
                placeholder="Cleaning, baking, repairs"
                type="search"
              />
            </div>
            <button type="submit">
              Search
            </button>
          </div>
          <button className="browse-link" type="button" onClick={onBrowse}>
            Browse all services
          </button>
        </form>
      </div>
    </section>
  );
}

function WhySection() {
  return (
    <section className="why">
      <div>
        <h2>Why Bundo?</h2>
        {[
          ['Transparent pricing', 'See service prices before you book.'],
          ['Verified professionals', 'Approved profiles, ratings, and real reviews.'],
          ['Built for trust', 'Chat, booking tracking, and admin moderation included.'],
        ].map(([title, body], index) => (
          <div className="why-row" key={title}>
            <span className="icon-box">{index + 1}</span>
            <div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="assurance">
        <span>100%</span>
        <h2>Quality assured</h2>
        <p>Profiles, bookings, messages, and reviews work together to keep the marketplace accountable.</p>
      </div>
    </section>
  );
}

function ServicesSection({ categories, onBrowse }: { categories: Category[]; onBrowse: () => void }) {
  return (
    <section className="services">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Explore</p>
          <h2>Services offered</h2>
        </div>
        <button onClick={onBrowse}>View all</button>
      </div>
      <div className="chips">
        {categories.length === 0 && <span className="muted">Categories will appear here after seeding.</span>}
        {categories.map((category) => (
          <button key={category.id} onClick={onBrowse}>
            <span>{category.iconKey || '•'}</span>
            {category.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function BookingSuccessDialog({
  booking,
  onClose,
  onViewBookings,
}: {
  booking: BookingSuccessState;
  onClose: () => void;
  onViewBookings: () => void;
}) {
  return (
    <div className="success-overlay" role="presentation" onClick={onClose}>
      <section
        className="booking-success-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="success-mark" aria-hidden="true">✓</span>
        <p className="eyebrow">Booking request sent</p>
        <h2 id="booking-success-title">Your request is with {booking.artisanName}</h2>
        <p>
          We created a booking for {booking.serviceTitle}. You can track the request,
          continue to chat, and pay after the artisan responds.
        </p>
        {booking.bookingId && <small>Booking #{booking.bookingId.slice(0, 8)}</small>}
        <div className="booking-success-actions">
          <button type="button" onClick={onViewBookings}>View my bookings</button>
          <button type="button" className="secondary-button" onClick={onClose}>Continue browsing</button>
        </div>
      </section>
    </div>
  );
}

function MarketplaceFilters({
  categories,
  selectedState,
  states,
  searchTerm,
  selectedCategoryId,
  priceMin,
  priceMax,
  sort,
  onSelectedStateChange,
  onSearchTermChange,
  onCategoryChange,
  onPriceMinChange,
  onPriceMaxChange,
  onSortChange,
  onApply,
  onClear,
}: {
  categories: Category[];
  selectedState: string;
  states: string[];
  searchTerm: string;
  selectedCategoryId: string;
  priceMin: string;
  priceMax: string;
  sort: MarketplaceSort;
  onSelectedStateChange: (value: string) => void;
  onSearchTermChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onPriceMinChange: (value: string) => void;
  onPriceMaxChange: (value: string) => void;
  onSortChange: (value: MarketplaceSort) => void;
  onApply: () => Promise<void>;
  onClear: () => Promise<void>;
}) {
  return (
    <section className="marketplace-filters">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Refine results</p>
          <h2>Search with more control</h2>
        </div>
      </div>
      <div className="marketplace-filter-grid">
        <label>
          State
          <select value={selectedState} onChange={(event) => onSelectedStateChange(event.target.value)}>
            <option value="">All states</option>
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select value={selectedCategoryId} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Artisan, service, category"
          />
        </label>
        <label>
          Min price
          <input type="number" min="0" value={priceMin} onChange={(event) => onPriceMinChange(event.target.value)} placeholder="5000" />
        </label>
        <label>
          Max price
          <input type="number" min="0" value={priceMax} onChange={(event) => onPriceMaxChange(event.target.value)} placeholder="50000" />
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(event) => onSortChange(event.target.value as MarketplaceSort)}>
            <option value="rating">Top rated</option>
            <option value="newest">Newest</option>
            <option value="price_low">Lowest price</option>
            <option value="price_high">Highest price</option>
          </select>
        </label>
      </div>
      <div className="marketplace-filter-actions">
        <button onClick={() => void onApply()}>Apply filters</button>
        <button className="secondary-button" onClick={() => void onClear()}>
          Clear
        </button>
      </div>
    </section>
  );
}

function MarketplacePreview({ offerings, onBrowse }: { offerings: Offering[]; onBrowse: () => void }) {
  return (
    <section className="preview-band">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Marketplace</p>
          <h2>Ready to book</h2>
        </div>
        <button onClick={onBrowse}>Open marketplace</button>
      </div>
      <div className="grid three">
        {offerings.slice(0, 3).map((offering) => (
          <article className="service-card" key={offering.id}>
            <p className="pill">{offering.category?.name || 'Service'}</p>
            <h3>{offering.title}</h3>
            <p>{offering.artisan?.displayName || 'Approved artisan'}</p>
            <p className="price">{money(offering.priceFrom)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function OfferingGrid({
  offerings,
  isAuthed,
  role,
  token,
  busy,
  runAction,
  reloadPrivate,
  onViewProfile,
  onBookingSuccess,
}: {
  offerings: Offering[];
  isAuthed: boolean;
  role: Role | null;
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  reloadPrivate: () => Promise<void>;
  onViewProfile: (artisanId: string) => Promise<void>;
  onBookingSuccess: (booking: BookingSuccessState) => void;
}) {
  const [activeOfferingAction, setActiveOfferingAction] = useState<string | null>(null);

  async function runOfferingAction(actionKey: string, action: () => Promise<void>, done: string) {
    setActiveOfferingAction(actionKey);

    try {
      await runAction(action, done);
    } finally {
      setActiveOfferingAction(null);
    }
  }

  return (
    <div className="grid two">
      {offerings.length === 0 && <EmptyState title="No services yet" body="Approved artisan offerings will appear here." />}
      {offerings.map((offering) => {
        const bookActionKey = `book:${offering.id}`;
        const messageActionKey = `message:${offering.id}`;
        const viewActionKey = `view:${offering.artisan?.id || offering.id}`;
        const isBookingThisOffering = activeOfferingAction === bookActionKey;
        const isMessagingThisOffering = activeOfferingAction === messageActionKey;
        const isViewingThisArtisan = activeOfferingAction === viewActionKey;

        return (
          <article className="service-card" key={offering.id}>
            <div className="card-topline">
              <p className="pill">{offering.category?.name || 'Service'}</p>
              <span>{offering.artisan?.city || 'Nearby'}</span>
            </div>
            <h3>{offering.title}</h3>
            <p>{offering.description || 'Professional home service'}</p>
            <p className="price">
              {money(offering.priceFrom)}
              {offering.priceTo ? ` - ${money(offering.priceTo)}` : ''}
            </p>
            <p className="muted">{offering.artisan?.displayName || 'Approved artisan'} · {offering.artisan?.area || 'Bundo'}</p>
            <div className="actions">
              <button
                className="secondary-button"
                disabled={!offering.artisan?.id || isViewingThisArtisan}
                onClick={() =>
                  offering.artisan?.id &&
                  void runOfferingAction(
                    viewActionKey,
                    () => onViewProfile(offering.artisan!.id),
                    'Artisan profile loaded'
                  )
                }
              >
                {isViewingThisArtisan ? 'Opening...' : 'View profile'}
              </button>
              <button
                disabled={!isAuthed || role !== 'CUSTOMER' || isBookingThisOffering}
                onClick={() =>
                  void runOfferingAction(
                    bookActionKey,
                    async () => {
                      const response = await api<{ booking: Booking }>('/bookings', {
                        method: 'POST',
                        token,
                        body: JSON.stringify({
                          offeringId: offering.id,
                          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
                          note: 'Booked from web client',
                        }),
                      });
                      await reloadPrivate();
                      onBookingSuccess({
                        bookingId: response.booking.id,
                        serviceTitle: offering.title,
                        artisanName: offering.artisan?.displayName || 'this artisan',
                      });
                    },
                    'Booking requested'
                  )
                }
              >
                {isBookingThisOffering ? 'Booking...' : 'Book'}
              </button>
              <button
                className="secondary-button"
                disabled={!isAuthed || !offering.artisan?.id || isMessagingThisOffering}
                onClick={() =>
                  void runOfferingAction(
                    messageActionKey,
                    async () => {
                      await api('/messages', {
                        method: 'POST',
                        token,
                        body: JSON.stringify({
                          artisanId: offering.artisan!.id,
                          body: 'Hello, I am interested in this service.',
                        }),
                      });
                      await reloadPrivate();
                    },
                    'Message sent'
                  )
                }
              >
                {isMessagingThisOffering ? 'Sending...' : 'Message'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ArtisanProfilePage({
  artisan,
  reviews,
  isAuthed,
  role,
  token,
  busy,
  runAction,
  onBack,
  reloadPrivate,
  onBookingSuccess,
}: {
  artisan: Artisan;
  reviews: Review[];
  isAuthed: boolean;
  role: Role | null;
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  onBack: () => void;
  reloadPrivate: () => Promise<void>;
  onBookingSuccess: (booking: BookingSuccessState) => void;
}) {
  const offerings = artisan.offerings || [];
  const firstOffering = offerings[0];
  const [offeringId, setOfferingId] = useState(firstOffering?.id || '');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('09:00');
  const selectedOffering = offerings.find((offering) => offering.id === offeringId) || firstOffering;
  const initials = artisan.displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const joined = artisan.createdAt
    ? new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(artisan.createdAt))
    : 'Recently';

  async function createBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOffering || !date) return;

    const response = await api<{ booking: Booking }>('/bookings', {
      method: 'POST',
      token,
      body: JSON.stringify({
        offeringId: selectedOffering.id,
        scheduledAt: new Date(`${date}T${timeSlot}:00`).toISOString(),
        note: `Booked from ${artisan.displayName} profile`,
      }),
    });
    await reloadPrivate();
    onBookingSuccess({
      bookingId: response.booking.id,
      serviceTitle: selectedOffering.title,
      artisanName: artisan.displayName,
    });
  }

  async function sendMessage() {
    await api('/messages', {
      method: 'POST',
      token,
      body: JSON.stringify({
        artisanId: artisan.id,
        body: `Hello ${artisan.displayName}, I am interested in your service.`,
      }),
    });
    await reloadPrivate();
  }

  return (
    <main className="artisan-profile-page">
      <button className="back-button profile-back" onClick={onBack}>Back to marketplace</button>

      <section className="profile-hero-card">
        <div className="profile-avatar">{initials || 'BP'}</div>
        <div className="profile-summary">
          <p className="eyebrow">Verified professional</p>
          <h1>{artisan.displayName}</h1>
          <p>{offerings[0]?.category?.name || 'Bundo artisan'}</p>
          <div className="profile-meta">
            <span>{artisan.area || 'Available area'}, {artisan.city}</span>
            <span>{artisan.avgRating || 0} rating ({artisan.ratingCount} reviews)</span>
          </div>
        </div>
        <button
          disabled={!isAuthed || role !== 'CUSTOMER' || busy || !selectedOffering}
          onClick={() => document.getElementById('profile-booking-card')?.scrollIntoView({ behavior: 'smooth' })}
        >
          Book now
        </button>
      </section>

      <nav className="profile-tabs" aria-label="Artisan profile sections">
        <a href="#about">About</a>
        <a href="#portfolio">Portfolio</a>
        <a href="#pricing">Pricing</a>
        <a href="#reviews">Reviews</a>
      </nav>

      <section className="profile-layout">
        <div className="profile-main">
          <section id="about" className="profile-section">
            <h2>About</h2>
            <p>
              {artisan.bio ||
                `${artisan.displayName} is an approved Bundo professional serving customers around ${artisan.area || artisan.city}. Review their services, send a message, or request a booking when you are ready.`}
            </p>
          </section>

          <section id="portfolio" className="profile-section">
            <h2>Portfolio</h2>
            <div className="portfolio-grid">
              {(artisan.portfolioImages || []).length > 0
                ? artisan.portfolioImages?.slice(0, 8).map((image) => (
                    <img key={image.id} src={image.url} alt={`${artisan.displayName} portfolio`} />
                  ))
                : Array.from({ length: 8 }).map((_, index) => (
                    <div className="portfolio-placeholder" key={index} />
                  ))}
            </div>
          </section>

          <section id="pricing" className="profile-section">
            <h2>Pricing</h2>
            <div className="pricing-list">
              {offerings.length === 0 && <EmptyState title="No offerings yet" body="This artisan has not listed public services." />}
              {offerings.map((offering) => (
                <article className="pricing-row" key={offering.id}>
                  <div>
                    <strong>{offering.title}</strong>
                    <p>{offering.description || offering.category?.name || 'Professional service'}</p>
                  </div>
                  <span>
                    {money(offering.priceFrom)}
                    {offering.priceTo ? ` - ${money(offering.priceTo)}` : ''}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section id="reviews" className="profile-section">
            <h2>Reviews</h2>
            <div className="review-list">
              {reviews.length === 0 && <EmptyState title="No reviews yet" body="Completed customer reviews will appear here." />}
              {reviews.map((review) => {
                const reviewer = userDisplayName(null, {
                  firebaseUid: review.customerId,
                  email: review.customer?.email || null,
                  phone: review.customer?.phone || null,
                  role: null,
                  status: 'ACTIVE',
                });

                return (
                  <article className="review-card" key={review.id}>
                    <div className="review-head">
                      <span className="review-avatar">{reviewer.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <strong>{reviewer}</strong>
                        <small>{new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(review.createdAt))}</small>
                      </div>
                    </div>
                    <p className="rating-dots">{Array.from({ length: 5 }).map((_, index) => <span key={index} className={index < review.rating ? 'active' : ''} />)}</p>
                    <p>{review.comment || 'Reliable service from this Bundo professional.'}</p>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="booking-card" id="profile-booking-card">
          <h2>Book {artisan.displayName.split(' ')[0]}</h2>
          <form onSubmit={(event) => runAction(() => createBooking(event), 'Booking requested')}>
            <label>
              Select service
              <select value={offeringId} onChange={(event) => setOfferingId(event.target.value)} required>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>{offering.title}</option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input value={date} onChange={(event) => setDate(event.target.value)} type="date" required />
            </label>
            <label>
              Time slot
              <select value={timeSlot} onChange={(event) => setTimeSlot(event.target.value)}>
                <option value="09:00">Morning (9am - 12pm)</option>
                <option value="13:00">Afternoon (1pm - 4pm)</option>
                <option value="17:00">Evening (5pm - 7pm)</option>
              </select>
            </label>

            <div className="booking-total">
              <span>Estimated total</span>
              <strong>{selectedOffering ? money(selectedOffering.priceFrom) : 'Select service'}</strong>
            </div>

            <button disabled={!isAuthed || role !== 'CUSTOMER' || busy || !selectedOffering}>Book now</button>
          </form>
          <button
            className="outline-button"
            disabled={!isAuthed || busy}
            onClick={() => runAction(sendMessage, 'Message sent')}
          >
            Send a message
          </button>

          <div className="profile-stats">
            <span>Jobs completed <strong>{artisan.ratingCount + offerings.length}</strong></span>
            <span>Response time <strong>Under 1 hour</strong></span>
            <span>Member since <strong>{joined}</strong></span>
          </div>
        </aside>
      </section>
    </main>
  );
}

function AppPromo() {
  return (
    <section className="app-promo">
      <div>
        <p className="eyebrow">Mobile ready</p>
        <h2>Book professionals from your phone</h2>
        <p>Use the web client now, then extend the same customer, artisan, booking, and chat flows into mobile.</p>
        <div className="phone-input">
          <span>+234</span>
          <input placeholder="Mobile number" />
          <button>Send</button>
        </div>
      </div>
      <img src={phoneImage} alt="Person using a mobile booking app" />
    </section>
  );
}

function Footer({
  onOpenHelpTopic,
}: {
  onOpenHelpTopic: (topicId: string) => void;
}) {
  const cities = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Enugu', 'Uyo', 'Benin City'];
  const footerTopics = [
    ['About us', 'getting-started'],
    ['Payments', 'payments'],
    ['Disputes', 'disputes'],
    ['Cancellations', 'cancellations'],
    ['Provider standards', 'artisan-standards'],
    ['Privacy', 'privacy'],
    ['Quick links', 'support'],
  ] as const;

  return (
    <footer>
      <div className="footer-links">
        {footerTopics.map(([label, topicId]) => (
          <button key={label} type="button" onClick={() => onOpenHelpTopic(topicId)}>
            {label}
          </button>
        ))}
      </div>
      <h4>Currently live in</h4>
      <div className="city-list">{cities.map((city) => <span key={city}>{city}</span>)}</div>
      <div className="footer-bottom">
        <img className="brand-logo" src={bundoLogo} alt="Bundo logo" />
        <span>Bundo</span>
        <small>© 2026 Bundo Marketplace</small>
      </div>
    </footer>
  );
}

const helpTopics = [
  {
    id: 'getting-started',
    icon: '01',
    title: 'Getting started with Bundo',
    sections: [
      {
        heading: 'About Bundo',
        questions: [
          ['What is Bundo?', 'Bundo connects customers with approved local artisans for home and lifestyle services. Customers discover services, message artisans, request bookings, and leave reviews after completed jobs.'],
          ['Where does Bundo work?', 'Bundo is built for Nigeria. Start by selecting your state, then browse available offerings from approved artisans in that location.'],
        ],
      },
      {
        heading: 'Account setup',
        questions: [
          ['How do I create an account?', 'Use Login or Sign up in the top navigation, then choose client or artisan during signup.'],
          ['Can one account become an artisan?', 'Yes. Apply from profile settings, create a public artisan profile, submit KYC, and wait for admin approval before listing services.'],
        ],
      },
    ],
  },
  {
    id: 'customers',
    icon: '02',
    title: 'Booking services as a customer',
    sections: [
      {
        heading: 'Finding professionals',
        questions: [
          ['How do I find a service?', 'Select your state from the homepage dropdown, open the marketplace, then compare available offerings and approved artisan profiles.'],
          ['What should I check before booking?', 'Check the service price, artisan location, rating count, profile details, and send a message if you need more information.'],
        ],
      },
      {
        heading: 'Bookings',
        questions: [
          ['How do I place a booking?', 'Sign in as a customer, open a service card, and select Book. Your booking request appears in your customer dashboard.'],
          ['Can I chat before booking?', 'Yes. Use Message on a service card to start a conversation with the artisan before requesting the service.'],
        ],
      },
    ],
  },
  {
    id: 'artisans',
    icon: '03',
    title: 'Working as an artisan',
    sections: [
      {
        heading: 'Profile setup',
        questions: [
          ['How do I become an artisan?', 'Choose artisan during signup or apply from profile settings, then create your profile and submit KYC.'],
          ['When will customers see my profile?', 'Your profile becomes publicly discoverable after KYC and admin approval. This helps keep the marketplace trustworthy.'],
        ],
      },
      {
        heading: 'Offerings',
        questions: [
          ['How do I list a service?', 'After KYC and admin approval, use the artisan dashboard to choose a category, add service details, and create the offering.'],
          ['Can customers message me?', 'Yes. Customer messages appear in your conversations, and you can reply back inside the thread.'],
        ],
      },
    ],
  },
  {
    id: 'trust',
    icon: '04',
    title: 'Trust, reviews, and safety',
    sections: [
      {
        heading: 'Reviews',
        questions: [
          ['Who can leave a review?', 'Only customers can review an artisan, and reviews are tied to completed bookings.'],
          ['Why do ratings matter?', 'Ratings help customers choose reliable artisans and help strong professionals build credibility.'],
        ],
      },
      {
        heading: 'Marketplace safety',
        questions: [
          ['How does Bundo protect users?', 'Bundo uses role-based access, verified artisan profiles, admin moderation, booking history, and conversation records.'],
          ['Can admin review chats?', 'Admins can inspect conversations and add private operational notes when support or moderation is needed.'],
        ],
      },
    ],
  },
  {
    id: 'payments',
    icon: '05',
    title: 'Payments, held funds, and payouts',
    sections: [
      {
        heading: 'Customer payments',
        questions: [
          ['How does Bundo handle payment?', 'Customers pay through Paystack. Once the transaction is confirmed, Bundo marks the payment as held while the booking is still in progress.'],
          ['When does the artisan get paid?', 'Bundo releases payout after the service is completed and the booking is reviewed on the operations side. This helps reduce fraud and incomplete-service risk.'],
          ['Does Bundo store card details?', 'No. Card and payment authorization are handled by Paystack. Bundo stores payment references and booking-linked status updates.'],
        ],
      },
      {
        heading: 'Payouts',
        questions: [
          ['How does an artisan receive payout?', 'An artisan adds a verified Nigerian payout account in their workspace. Once a held payment is approved for release, Bundo sends the payout to that account.'],
          ['Why might payout be delayed?', 'Payout may be delayed if the booking is not completed, a dispute is open, the payout account is missing, or internal review is still ongoing.'],
        ],
      },
    ],
  },
  {
    id: 'disputes',
    icon: '06',
    title: 'Disputes and refunds',
    sections: [
      {
        heading: 'Dispute flow',
        questions: [
          ['When should I raise a dispute?', 'Raise a dispute when payment has been secured but the service outcome is contested, incomplete, or materially different from what was agreed.'],
          ['Who can raise a dispute?', 'The booking owner and the assigned artisan can open a dispute on the booking while payment is still held.'],
        ],
      },
      {
        heading: 'Refund decisions',
        questions: [
          ['What outcomes are possible?', 'Bundo can release payout to the artisan, issue a full refund to the customer, or issue a partial refund depending on the review outcome.'],
          ['How are decisions recorded?', 'Dispute outcomes are logged in the booking, payment history, and admin tooling so there is a clear internal audit trail.'],
        ],
      },
    ],
  },
  {
    id: 'cancellations',
    icon: '07',
    title: 'Cancellations and rescheduling',
    sections: [
      {
        heading: 'Before service starts',
        questions: [
          ['Can I cancel a booking?', 'Yes. Customers can cancel a booking while it is still requested or accepted.'],
          ['Can I reschedule a booking?', 'Yes. Customers and artisans can reschedule a requested or accepted booking. If the artisan has active availability slots, the new time must fit those availability windows.'],
        ],
      },
      {
        heading: 'Operational rules',
        questions: [
          ['What happens after completion?', 'Completed bookings are not meant to be casually rewritten. Changes after completion should go through support and dispute handling instead.'],
          ['Why are time windows checked?', 'Availability checks reduce missed appointments and help keep booking promises aligned with the artisan’s declared working hours.'],
        ],
      },
    ],
  },
  {
    id: 'artisan-standards',
    icon: '08',
    title: 'Artisan standards and KYC',
    sections: [
      {
        heading: 'Verification and trust',
        questions: [
          ['Why does Bundo ask for KYC?', 'KYC helps Bundo confirm artisan identity before scaling profile visibility, payments, and payouts. It strengthens trust for customers and reduces fraud risk.'],
          ['What does an artisan submit?', 'The current flow supports legal name, document type, document number, identity document image, optional selfie image, and address details for review.'],
        ],
      },
      {
        heading: 'Review outcomes',
        questions: [
          ['What KYC outcomes can happen?', 'A submission can be approved, rejected, or returned with changes requested. Artisans are notified in their workspace when the review result changes.'],
          ['Does KYC replace profile approval?', 'No. KYC supports the broader trust workflow. Admin verification and marketplace approval still matter for public discovery and payout readiness.'],
        ],
      },
    ],
  },
  {
    id: 'privacy',
    icon: '09',
    title: 'Privacy and platform rules',
    sections: [
      {
        heading: 'Data handling',
        questions: [
          ['What account data does Bundo keep?', 'Bundo stores the minimum account, booking, review, payout, and notification data needed to operate the marketplace and support users.'],
          ['Who can see private conversation details?', 'Customers and the assigned artisan can see their thread. Admins can inspect conversations for moderation, support, fraud prevention, and dispute handling.'],
        ],
      },
      {
        heading: 'Marketplace rules',
        questions: [
          ['Can Bundo restrict accounts?', 'Yes. Bundo may restrict accounts involved in abuse, fraud, repeated cancellations, impersonation, or policy violations.'],
          ['Why do platform rules matter?', 'A service marketplace depends on trust. Clear platform rules help protect customers, reliable artisans, and payment operations.'],
        ],
      },
    ],
  },
  {
    id: 'support',
    icon: '10',
    title: 'Support and account issues',
    sections: [
      {
        heading: 'Getting help',
        questions: [
          ['What if something goes wrong?', 'Use the conversation thread first so there is a clear record. Admin support can review chats and booking context when needed.'],
          ['What if my account is restricted?', 'An admin may restrict accounts that violate marketplace rules. Contact support with your account email and a short explanation.'],
        ],
      },
    ],
  },
];

function HelpCenter({
  activeTopicId,
  onOpenTopic,
  onBack,
}: {
  activeTopicId: string | null;
  onOpenTopic: (topicId: string | null) => void;
  onBack: () => void;
}) {
  const activeTopic = helpTopics.find((topic) => topic.id === activeTopicId);

  return (
    <main className="help-page">
      <section className="help-panel">
        <button className="back-button" onClick={activeTopic ? () => onOpenTopic(null) : onBack}>
          Back
        </button>

        {!activeTopic && (
          <>
            <p className="eyebrow">Bundo help center</p>
            <h1>How can we help you?</h1>
            <div className="help-highlight">
              <strong>Trust policies for payments, disputes, cancellations, and provider reviews live here.</strong>
              <p>Use these topics to understand how Bundo protects customers, artisans, and marketplace funds during the MVP stage.</p>
            </div>
            <div className="help-topic-list">
              {helpTopics.map((topic) => (
                <button key={topic.id} className="help-topic-row" onClick={() => onOpenTopic(topic.id)}>
                  <span>{topic.icon}</span>
                  <strong>{topic.title}</strong>
                  <em>&gt;</em>
                </button>
              ))}
            </div>
          </>
        )}

        {activeTopic && (
          <>
            <p className="eyebrow">Help topic</p>
            <h1>{activeTopic.title}</h1>
            <div className="help-section-list">
              {activeTopic.sections.map((section) => (
                <section className="help-section" key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.questions.map(([question, answer]) => (
                    <details key={question} className="help-question">
                      <summary>{question}</summary>
                      <p>{answer}</p>
                    </details>
                  ))}
                </section>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function AccountSettingsPanel({
  token,
  me,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  me: ApiUser;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const canApplyAsArtisan = me.role !== 'ARTISAN' && me.role !== 'ADMIN';

  return (
    <article className="panel-card">
      <p className="eyebrow">Profile settings</p>
      <h2>Account type</h2>
      <p>
        Current account: <strong>{me.role ? me.role.toLowerCase() : 'not selected'}</strong>
      </p>
      {me.role === 'ARTISAN' ? (
        <p className="muted">
          Artisan access is controlled by KYC and admin approval. Complete verification
          before listing services.
        </p>
      ) : me.role === 'ADMIN' ? (
        <p className="muted">Admin access is managed from the admin console.</p>
      ) : (
        <p className="muted">
          Client accounts can apply to become artisans. Listing services remains locked
          until profile setup, KYC, and admin approval are complete.
        </p>
      )}
      {canApplyAsArtisan && (
        <div className="actions">
          {!me.role && (
            <button
              disabled={busy}
              onClick={() =>
                runAction(async () => {
                  await api('/users/role', {
                    method: 'PATCH',
                    token,
                    body: JSON.stringify({ role: 'CUSTOMER' }),
                  });
                  await refresh();
                }, 'Client account selected')
              }
            >
              Continue as client
            </button>
          )}
          <button
            disabled={busy}
            onClick={() =>
              runAction(async () => {
                await api('/users/role', {
                  method: 'PATCH',
                  token,
                  body: JSON.stringify({ role: 'ARTISAN' }),
                });
                await refresh();
              }, 'Artisan application started')
            }
          >
            Apply as artisan
          </button>
        </div>
      )}
    </article>
  );
}

function ArtisanReviewsPanel({ token }: { token: string }) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let mounted = true;
    api<{ profile: Artisan }>('/artisans/me', { token })
      .then(async (profileResponse) => {
        const reviewResponse = await api<{ reviews: Review[] }>(`/artisans/${profileResponse.profile.id}/reviews`);
        if (!mounted) return;
        setProfile(profileResponse.profile);
        setReviews(reviewResponse.reviews);
      })
      .catch(() => {
        if (!mounted) return;
        setProfile(null);
        setReviews([]);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  const average = profile?.avgRating || 0;

  return (
    <section className="artisan-reviews-page">
      <h2>Reviews</h2>
      <div className="reviews-summary">
        <div className="reviews-score">
          <strong>{average.toFixed(1)}</strong>
          <span>★★★★★</span>
          <p>{reviews.length ? 'Based on customer reviews' : 'No reviews yet'}</p>
        </div>
        <div className="reviews-bars">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = reviews.filter((review) => review.rating === rating).length;
            const percent = reviews.length ? (count / reviews.length) * 100 : 0;
            return (
              <div key={rating}>
                <span>{rating} Stars</span>
                <i><b style={{ width: `${percent}%` }} /></i>
                <small>{count}</small>
              </div>
            );
          })}
        </div>
      </div>
      <div className="reviews-list">
        {reviews.length === 0 && <EmptyState title="No reviews yet" body="Reviews from completed jobs will appear here." />}
        {reviews.map((review) => (
          <article className="review-card artisan-review-card" key={review.id}>
            <div className="review-head">
              <span className="recommended-avatar">{(review.customer?.email || 'C').slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{review.customer?.email?.split('@')[0] || 'Customer'}</strong>
                <span className="verified-hire">Verified hire</span>
                <p>{'★'.repeat(review.rating)} <small>{bookingDate(review.createdAt)}</small></p>
              </div>
            </div>
            <p>{review.comment || 'Customer left a rating for this completed job.'}</p>
            <small>JOB: {review.booking?.offering?.title || 'Service booking'}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ArtisanProfileSettings({
  token,
  firebaseUser,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  firebaseUser: User | null;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [payoutAccount, setPayoutAccount] = useState<ProviderPayoutAccount | null>(null);
  const [banks, setBanks] = useState<PayoutBank[]>([]);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const kycStatus = kycSubmission?.status ?? 'NOT_SUBMITTED';
  const approved = profile?.verifyStatus === 'APPROVED' && kycStatus === 'APPROVED';

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
      api<{ banks: PayoutBank[] }>('/payments/banks', { token }),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ])
      .then(([profileResponse, accountResponse, bankResponse, kycResponse]) => {
        if (!mounted) return;
        setProfile(profileResponse.profile || null);
        setPayoutAccount(accountResponse.account);
        setBanks(bankResponse.banks);
        setKycSubmission(kycResponse.submission);
      })
      .catch(() => {
        if (!mounted) return;
        setProfile(null);
        setPayoutAccount(null);
        setBanks([]);
        setKycSubmission(null);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  async function hydrateSettings() {
    const [profileResponse, accountResponse, kycResponse] = await Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ]);
    setProfile(profileResponse.profile || null);
    setPayoutAccount(accountResponse.account);
    setKycSubmission(kycResponse.submission);
  }

  async function saveProfile(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    await api('/artisans/profile', {
      method: profile ? 'PATCH' : 'POST',
      token,
      body: JSON.stringify({
        displayName: form.get('displayName'),
        bio: profile?.bio || 'Bundo artisan',
        city: form.get('city'),
        area: form.get('area'),
        lat: profile?.lat ?? 6.5244,
        lng: profile?.lng ?? 3.3792,
      }),
    });
    const response = await api<{ profile: Artisan }>('/artisans/me', { token });
    setProfile(response.profile);
    await refresh();
  }

  async function submitKyc(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const response = await api<{ submission: ArtisanKycSubmission }>('/artisans/kyc', {
      method: 'POST',
      token,
      body: JSON.stringify({
        legalName: form.get('legalName'),
        documentType: form.get('documentType'),
        documentNumber: form.get('documentNumber'),
        documentImageUrl: form.get('documentImageUrl'),
        selfieImageUrl: form.get('selfieImageUrl') || undefined,
        address: form.get('address'),
        city: form.get('city'),
      }),
    });
    setKycSubmission(response.submission);
    await refresh();
  }

  async function savePayoutAccount(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const selectedBank = banks.find(
      (bank) => bank.code === String(form.get('bankCode') || '')
    );
    const response = await api<{ account: ProviderPayoutAccount }>('/artisans/payout-account', {
      method: 'POST',
      token,
      body: JSON.stringify({
        bankCode: form.get('bankCode'),
        bankName: selectedBank?.name,
        accountNumber: form.get('accountNumber'),
        accountName: form.get('accountName'),
      }),
    });
    setPayoutAccount(response.account);
    await hydrateSettings();
  }

  return (
    <section className="artisan-profile-settings-page">
      <aside className="artisan-settings-sidebar">
        <span className="recommended-avatar large">{(profile?.displayName || 'A').slice(0, 1).toUpperCase()}</span>
        <h2>{profile?.displayName || 'Your profile'}</h2>
        <p>@{(firebaseUser?.email || 'artisan').split('@')[0]}</p>
        <span className={`booking-status ${approved ? 'completed' : 'pending'}`}>
          {approved ? 'Approved' : kycStatus.toLowerCase().replace(/_/g, ' ')}
        </span>
        <button>Edit Profile</button>
        {['Your Profile', 'KYC verification', 'Bank information', 'Business information', 'Job history', 'Service and pricing', 'Settings', 'Notifications'].map((item, index) => (
          <span className={index === 0 ? 'active' : ''} key={item}>{item}</span>
        ))}
        <button className="danger-outline">Log out</button>
      </aside>

      <div className="artisan-settings-stack">
        <form
          className="artisan-settings-card"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => saveProfile(form), 'Profile saved');
          }}
        >
          <h2>Edit Personal Information</h2>
          <p>Update the public profile details customers see on Bundo.</p>
          <div className="profile-picture-row">
            <span className="recommended-avatar large">{(profile?.displayName || 'A').slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>Profile Picture</strong>
              <p>JPG, GIF or PNG. Max size of 800K</p>
              <button type="button" className="text-button">Upload new</button>
            </div>
          </div>
          <label>Full Name<input name="displayName" defaultValue={profile?.displayName || ''} required /></label>
          <label>Email Address<input defaultValue={firebaseUser?.email || ''} disabled /></label>
          <label>Phone Number<input placeholder="+234" disabled /></label>
          <label>Location<input name="city" defaultValue={profile?.city || 'Lagos'} required /></label>
          <label>Area<input name="area" defaultValue={profile?.area || ''} /></label>
          <div className="settings-actions">
            <button type="button" className="secondary-button">Cancel</button>
            <button disabled={busy}>Save Changes</button>
          </div>
        </form>

        <form
          className="artisan-settings-card"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => submitKyc(form), 'KYC submission saved');
          }}
        >
          <h2>KYC verification</h2>
          <p>Identity details stay in settings and are reviewed by admin before your profile is fully approved.</p>
          {kycSubmission && (
            <div className={`payment-note ${kycSubmission.status === 'APPROVED' ? 'success' : ''}`}>
              <strong>KYC status: {kycSubmission.status.toLowerCase().replace(/_/g, ' ')}</strong>
              <span>{kycSubmission.reviewNote || 'Admin will review your submission.'}</span>
            </div>
          )}
          <label>Legal Name<input name="legalName" defaultValue={kycSubmission?.legalName || ''} required /></label>
          <label>Document Type
            <select name="documentType" defaultValue={kycSubmission?.documentType || 'NIN'} required>
              <option value="NIN">NIN</option>
              <option value="BVN">BVN</option>
              <option value="DRIVERS_LICENSE">Driver's license</option>
              <option value="INTERNATIONAL_PASSPORT">International passport</option>
            </select>
          </label>
          <label>Document Number<input name="documentNumber" defaultValue={kycSubmission?.documentNumber || ''} required /></label>
          <label>Document Image URL<input name="documentImageUrl" defaultValue={kycSubmission?.documentImageUrl || ''} required /></label>
          <label>Selfie Image URL<input name="selfieImageUrl" defaultValue={kycSubmission?.selfieImageUrl || ''} /></label>
          <label>Residential Address<input name="address" defaultValue={kycSubmission?.address || ''} required /></label>
          <label>City<input name="city" defaultValue={kycSubmission?.city || profile?.city || 'Lagos'} required /></label>
          <button disabled={busy}>Save KYC details</button>
        </form>

        <form
          className="artisan-settings-card"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => savePayoutAccount(form), 'Payout account saved');
          }}
        >
          <h2>Bank information</h2>
          <p>Add the Nigerian bank account where approved completed-service payouts should be sent.</p>
          {payoutAccount && (
            <div className="payment-note success">
              <strong>{payoutAccount.accountName || 'Saved payout account'}</strong>
              <span>
                {payoutAccount.bankName || payoutAccount.bankCode} · ****{payoutAccount.accountNumber.slice(-4)}
              </span>
            </div>
          )}
          <label>Bank
            <select name="bankCode" defaultValue={payoutAccount?.bankCode || ''} required>
              <option value="" disabled>Select bank</option>
              {banks.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
                </option>
              ))}
            </select>
          </label>
          <label>Account Number<input name="accountNumber" defaultValue={payoutAccount?.accountNumber || ''} required /></label>
          <label>Account Name<input name="accountName" defaultValue={payoutAccount?.accountName || ''} /></label>
          <button disabled={busy}>Save bank information</button>
        </form>
      </div>
    </section>
  );
}

function ArtisanOffersPanel({
  token,
  categories,
  offerings,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  categories: ReactNode[];
  offerings: Offering[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const kycStatus = kycSubmission?.status ?? 'NOT_SUBMITTED';
  const artisanApproved = profile?.verifyStatus === 'APPROVED' && kycStatus === 'APPROVED';
  const reviewMessage = !profile
    ? 'Create your artisan profile in Profile settings before listing services.'
    : kycStatus === 'APPROVED' && profile.verifyStatus !== 'APPROVED'
      ? 'Your KYC is approved. Admin approval for your artisan profile is still pending.'
      : kycStatus === 'APPROVED'
        ? 'Your artisan account is approved. Add service offers that match your profile.'
        : 'Service offers unlock after KYC and admin approval.';

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ]).then(([profileResponse, kycResponse]) => {
      if (!mounted) return;
      setProfile(profileResponse.profile || null);
      setKycSubmission(kycResponse.submission);
    });
    return () => {
      mounted = false;
    };
  }, [token]);

  async function createOffering(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    await api('/offerings', {
      method: 'POST',
      token,
      body: JSON.stringify({
        categoryId: form.get('categoryId'),
        title: form.get('title'),
        description: form.get('description'),
        priceFrom: Number(form.get('priceFrom')),
        priceTo: form.get('priceTo') ? Number(form.get('priceTo')) : undefined,
      }),
    });
    await refresh();
    formElement.reset();
  }

  return (
    <>
      <section className="section-head compact">
        <p className="eyebrow">Services</p>
        <h1>Service offers</h1>
        <p>{reviewMessage}</p>
      </section>

      {!artisanApproved && (
        <article className="panel-card locked-card">
          <p className="eyebrow">Locked until approval</p>
          <h2>Offer creation is not available yet</h2>
          <div className="approval-steps">
            <span className={profile ? 'complete' : ''}>Profile</span>
            <span className={kycStatus !== 'NOT_SUBMITTED' ? 'complete' : ''}>KYC submitted</span>
            <span className={kycStatus === 'APPROVED' ? 'complete' : ''}>KYC approved</span>
            <span className={profile?.verifyStatus === 'APPROVED' ? 'complete' : ''}>Admin approved</span>
          </div>
        </article>
      )}

      {artisanApproved && (
        <form
          className="panel-card form-card"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => createOffering(form), 'Offering created');
          }}
        >
          <p className="eyebrow">Create offer</p>
          <h2>Add a service package</h2>
          <select name="categoryId" required>{categories}</select>
          <input name="title" placeholder="Service title" required />
          <input name="description" placeholder="Description" />
          <input name="priceFrom" placeholder="Price from" required />
          <input name="priceTo" placeholder="Price to" />
          <button disabled={busy}>Create offering</button>
        </form>
      )}

      <article className="panel-card">
        <p className="eyebrow">Services</p>
        <h2>My offerings</h2>
        {offerings.length === 0 && <p>No offerings created yet.</p>}
        {offerings.map((offering) => (
          <div className="list-item" key={offering.id}>
            <strong>{offering.title}</strong>
            <span>
              {money(offering.priceFrom)}
              {offering.category?.name ? ` · ${offering.category.name}` : ''}
            </span>
          </div>
        ))}
      </article>
    </>
  );
}

function ArtisanPanel({
  token,
  categories,
  offerings,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  categories: ReactNode[];
  offerings: Offering[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [portfolioImages, setPortfolioImages] = useState<PortfolioImage[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [payoutAccount, setPayoutAccount] = useState<ProviderPayoutAccount | null>(null);
  const [banks, setBanks] = useState<PayoutBank[]>([]);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const kycStatus = kycSubmission?.status ?? 'NOT_SUBMITTED';
  const artisanApproved =
    profile?.verifyStatus === 'APPROVED' && kycStatus === 'APPROVED';
  const reviewMessage = !profile
    ? 'Create your artisan profile first, then submit KYC for admin review.'
    : kycStatus === 'NOT_SUBMITTED'
      ? 'Submit KYC so admin can verify your identity before you list services.'
      : kycStatus === 'APPROVED' && profile.verifyStatus !== 'APPROVED'
        ? 'Your KYC is approved. Admin approval for your artisan profile is still pending.'
        : kycStatus === 'APPROVED'
          ? 'Your artisan account is approved. You can now create offers for matching categories.'
          : kycStatus === 'REJECTED'
            ? 'Your KYC was rejected. Review the admin note, update your details, and resubmit.'
            : kycStatus === 'CHANGES_REQUESTED'
              ? 'Admin requested changes. Update your KYC details and resubmit for review.'
              : 'Your KYC is under admin review. Offer creation unlocks after approval.';

  useEffect(() => {
    let mounted = true;

    Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ images: PortfolioImage[] }>('/artisans/portfolio-images/me', { token }).catch(() => ({ images: [] })),
      api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', { token }).catch(() => ({ slots: [] })),
      api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
      api<{ banks: PayoutBank[] }>('/payments/banks', { token }),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }),
    ])
      .then(([profileResponse, imageResponse, slotResponse, accountResponse, bankResponse, kycResponse]) => {
        if (!mounted) return;
        setProfile(profileResponse.profile || null);
        setPortfolioImages(imageResponse.images);
        setAvailabilitySlots(slotResponse.slots);
        setPayoutAccount(accountResponse.account);
        setBanks(bankResponse.banks);
        setKycSubmission(kycResponse.submission);
      })
      .catch(() => {
        if (!mounted) return;
        setProfile(null);
        setPortfolioImages([]);
        setAvailabilitySlots([]);
        setPayoutAccount(null);
        setBanks([]);
        setKycSubmission(null);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  async function hydrateWorkspace() {
    const [profileResponse, imageResponse, slotResponse, accountResponse, kycResponse] = await Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ images: PortfolioImage[] }>('/artisans/portfolio-images/me', { token }).catch(() => ({ images: [] })),
      api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', { token }).catch(() => ({ slots: [] })),
      api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }),
    ]);

    setProfile(profileResponse.profile || null);
    setPortfolioImages(imageResponse.images);
    setAvailabilitySlots(slotResponse.slots);
    setPayoutAccount(accountResponse.account);
    setKycSubmission(kycResponse.submission);
  }

  async function createProfile(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    await api('/artisans/profile', {
      method: profile ? 'PATCH' : 'POST',
      token,
      body: JSON.stringify({
        displayName: form.get('displayName'),
        bio: form.get('bio'),
        city: form.get('city'),
        area: form.get('area'),
        lat: Number(form.get('lat')),
        lng: Number(form.get('lng')),
      }),
    });
    await refresh();
    await hydrateWorkspace();
  }

  async function savePayoutAccount(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const selectedBank = banks.find(
      (bank) => bank.code === String(form.get('bankCode') || '')
    );
    const response = await api<{ account: ProviderPayoutAccount }>('/artisans/payout-account', {
      method: 'POST',
      token,
      body: JSON.stringify({
        bankCode: form.get('bankCode'),
        bankName: selectedBank?.name,
        accountNumber: form.get('accountNumber'),
        accountName: form.get('accountName'),
      }),
    });
    setPayoutAccount(response.account);
  }

  async function createOffering(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    await api('/offerings', {
      method: 'POST',
      token,
      body: JSON.stringify({
        categoryId: form.get('categoryId'),
        title: form.get('title'),
        description: form.get('description'),
        priceFrom: Number(form.get('priceFrom')),
        priceTo: form.get('priceTo') ? Number(form.get('priceTo')) : undefined,
      }),
    });
    await refresh();
    formElement.reset();
  }

  async function addAvailability(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    await api('/artisans/availability-slots', {
      method: 'POST',
      token,
      body: JSON.stringify({
        dayOfWeek: Number(form.get('dayOfWeek')),
        startTime: form.get('startTime'),
        endTime: form.get('endTime'),
      }),
    });
    await hydrateWorkspace();
    formElement.reset();
  }

  async function toggleAvailability(slot: AvailabilitySlot) {
    await api(`/artisans/availability-slots/${slot.id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        isActive: !slot.isActive,
      }),
    });
    await hydrateWorkspace();
  }

  async function removeAvailability(slotId: string) {
    await api(`/artisans/availability-slots/${slotId}`, {
      method: 'DELETE',
      token,
    });
    await hydrateWorkspace();
  }

  async function uploadPortfolioFile(file: File) {
    setUploadingPortfolio(true);

    try {
      const signatureResponse = await api<{ upload: CloudinarySignedUpload }>(
        '/artisans/portfolio-images/sign-upload',
        {
          method: 'POST',
          token,
        }
      );

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signatureResponse.upload.apiKey);
      formData.append('timestamp', String(signatureResponse.upload.timestamp));
      formData.append('folder', signatureResponse.upload.folder);
      formData.append('signature', signatureResponse.upload.signature);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signatureResponse.upload.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData?.error?.message || 'Could not upload image');
      }

      await api('/artisans/portfolio-images', {
        method: 'POST',
        token,
        body: JSON.stringify({
          cloudinaryId: uploadData.public_id,
          url: uploadData.secure_url,
          displayOrder: portfolioImages.length,
        }),
      });

      await hydrateWorkspace();
    } finally {
      setUploadingPortfolio(false);
    }
  }

  async function removePortfolioImage(imageId: string) {
    await api(`/artisans/portfolio-images/${imageId}`, {
      method: 'DELETE',
      token,
    });
    await hydrateWorkspace();
  }

  async function submitKyc(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const response = await api<{ submission: ArtisanKycSubmission }>('/artisans/kyc', {
      method: 'POST',
      token,
      body: JSON.stringify({
        legalName: form.get('legalName'),
        documentType: form.get('documentType'),
        documentNumber: form.get('documentNumber'),
        documentImageUrl: form.get('documentImageUrl'),
        selfieImageUrl: form.get('selfieImageUrl') || undefined,
        address: form.get('address'),
        city: form.get('city'),
      }),
    });
    setKycSubmission(response.submission);
  }

  return (
    <>
      <form
        className="panel-card form-card"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          runAction(() => createProfile(form), 'Artisan profile saved');
        }}
      >
        <p className="eyebrow">Onboarding</p>
        <h2>Artisan profile</h2>
        <input name="displayName" placeholder="Display name" defaultValue={profile?.displayName || ''} required />
        <input name="bio" placeholder="Bio" defaultValue={profile?.bio || ''} />
        <input name="city" placeholder="City" defaultValue={profile?.city || 'Lagos'} required />
        <input name="area" placeholder="Area" defaultValue={profile?.area || 'Lekki'} />
        <input name="lat" placeholder="Latitude" defaultValue={profile?.lat ?? '6.5244'} required />
        <input name="lng" placeholder="Longitude" defaultValue={profile?.lng ?? '3.3792'} required />
        <button disabled={busy}>{profile ? 'Update profile' : 'Save profile'}</button>
      </form>
      <form
        className="panel-card form-card"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          runAction(() => submitKyc(form), 'KYC submission saved');
        }}
      >
        <p className="eyebrow">Compliance</p>
        <h2>KYC submission</h2>
        <p>
          Submit your identity details so Bundo can review your artisan account before broader rollout.
        </p>
        {kycSubmission && (
          <div className={`payment-note ${kycSubmission.status === 'APPROVED' ? 'success' : ''}`}>
            <strong>KYC status: {kycSubmission.status.toLowerCase().replace(/_/g, ' ')}</strong>
            <span>
              {kycSubmission.reviewNote
                ? kycSubmission.reviewNote
                : 'We will update you once the review is complete.'}
            </span>
          </div>
        )}
        <input
          name="legalName"
          placeholder="Legal name"
          defaultValue={kycSubmission?.legalName || ''}
          required
        />
        <select name="documentType" defaultValue={kycSubmission?.documentType || 'NIN'} required>
          <option value="NIN">NIN</option>
          <option value="BVN">BVN</option>
          <option value="DRIVERS_LICENSE">Driver's license</option>
          <option value="INTERNATIONAL_PASSPORT">International passport</option>
        </select>
        <input
          name="documentNumber"
          placeholder="Document number"
          defaultValue={kycSubmission?.documentNumber || ''}
          required
        />
        <input
          name="documentImageUrl"
          placeholder="Document image URL"
          defaultValue={kycSubmission?.documentImageUrl || ''}
          required
        />
        <input
          name="selfieImageUrl"
          placeholder="Selfie image URL"
          defaultValue={kycSubmission?.selfieImageUrl || ''}
        />
        <input
          name="address"
          placeholder="Residential address"
          defaultValue={kycSubmission?.address || ''}
          required
        />
        <input
          name="city"
          placeholder="City"
          defaultValue={kycSubmission?.city || 'Lagos'}
          required
        />
        <button disabled={busy}>Submit KYC</button>
      </form>
      {!artisanApproved ? (
        <article className="panel-card locked-card">
          <p className="eyebrow">Locked until approval</p>
          <h2>Offers are not available yet</h2>
          <p>{reviewMessage}</p>
          <div className="approval-steps">
            <span className={profile ? 'complete' : ''}>Profile</span>
            <span className={kycStatus !== 'NOT_SUBMITTED' ? 'complete' : ''}>KYC submitted</span>
            <span className={kycStatus === 'APPROVED' ? 'complete' : ''}>KYC approved</span>
            <span className={profile?.verifyStatus === 'APPROVED' ? 'complete' : ''}>Admin approved</span>
          </div>
        </article>
      ) : (
        <>
          <form
            className="panel-card form-card"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              runAction(() => createOffering(form), 'Offering created');
            }}
          >
            <p className="eyebrow">Services</p>
            <h2>Create offering</h2>
            <select name="categoryId" required>{categories}</select>
            <input name="title" placeholder="Service title" required />
            <input name="description" placeholder="Description" />
            <input name="priceFrom" placeholder="Price from" required />
            <input name="priceTo" placeholder="Price to" />
            <button disabled={busy}>Create offering</button>
          </form>
      <form
        className="panel-card form-card"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          runAction(() => savePayoutAccount(form), 'Payout account saved');
        }}
      >
        <p className="eyebrow">Payments</p>
        <h2>Payout account</h2>
        <p>
          Add the Nigerian bank account where completed-service payouts should be sent.
          Paystack verifies and stores the transfer recipient.
        </p>
        {payoutAccount && (
          <div className="payment-note success">
            <strong>{payoutAccount.accountName || 'Verified account'}</strong>
            <span>
              {payoutAccount.bankName || payoutAccount.bankCode} · {payoutAccount.accountNumber}
            </span>
          </div>
        )}
        <select name="bankCode" defaultValue={payoutAccount?.bankCode || ''} required>
          <option value="" disabled>Select bank</option>
          {banks.map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </select>
        <input name="accountNumber" placeholder="Account number" required />
        <input name="accountName" placeholder="Account name" />
        <button disabled={busy}>Save payout account</button>
      </form>
      <article className="panel-card">
        <p className="eyebrow">Services</p>
        <h2>My offerings</h2>
        {offerings.length === 0 && <p>No offerings created yet.</p>}
        {offerings.map((offering) => (
          <div className="list-item" key={offering.id}>
            <strong>{offering.title}</strong>
            <span>
              {money(offering.priceFrom)}
              {offering.category?.name ? ` · ${offering.category.name}` : ''}
            </span>
          </div>
        ))}
      </article>
      <article className="panel-card form-card">
        <p className="eyebrow">Portfolio</p>
        <h2>Upload work samples</h2>
        <p>Add a few clean job photos so customers can trust what you do before they book.</p>
        <label className="upload-field">
          <span>Choose image</span>
          <input
            type="file"
            accept="image/*"
            disabled={busy || uploadingPortfolio}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void runAction(
                () => uploadPortfolioFile(file),
                'Portfolio image uploaded'
              );
              event.currentTarget.value = '';
            }}
          />
        </label>
        <div className="workspace-media-grid">
          {portfolioImages.length === 0 && <p className="muted">No portfolio images uploaded yet.</p>}
          {portfolioImages.map((image) => (
            <div className="workspace-media-card" key={image.id}>
              <img src={image.url} alt="Portfolio upload" />
              <button
                className="secondary-button"
                disabled={busy || uploadingPortfolio}
                onClick={() => runAction(() => removePortfolioImage(image.id), 'Portfolio image removed')}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </article>
      <article className="panel-card form-card">
        <p className="eyebrow">Availability</p>
        <h2>Working hours</h2>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => addAvailability(form), 'Availability added');
          }}
        >
          <select name="dayOfWeek" defaultValue="1" required>
            {dayLabels.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </select>
          <input name="startTime" type="time" defaultValue="09:00" required />
          <input name="endTime" type="time" defaultValue="17:00" required />
          <button disabled={busy}>Add slot</button>
        </form>
        {availabilitySlots.length === 0 && <p className="muted">No availability slots yet.</p>}
        {availabilitySlots.map((slot) => (
          <div className="list-item" key={slot.id}>
            <strong>
              {dayLabels[slot.dayOfWeek]} · {slot.startTime} - {slot.endTime}
            </strong>
            <span>{slot.isActive ? 'Active' : 'Paused'}</span>
            <div className="actions">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => runAction(() => toggleAvailability(slot), slot.isActive ? 'Availability paused' : 'Availability activated')}
              >
                {slot.isActive ? 'Pause' : 'Activate'}
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => runAction(() => removeAvailability(slot.id), 'Availability removed')}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </article>
        </>
      )}
    </>
  );
}

function ArtisanDashboard({
  token,
  bookings,
  firebaseUser,
  busy,
  runAction,
  refresh,
  openBookings,
  openMessages,
  openReviews,
  openProfile,
  openOffers,
}: {
  token: string;
  bookings: Booking[];
  firebaseUser: User | null;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  openBookings: () => void;
  openMessages: () => void;
  openReviews: () => void;
  openProfile: () => void;
  openOffers: () => void;
}) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const displayName = profile?.displayName || firebaseUser?.displayName || userDisplayName(firebaseUser, null) || 'Artisan';
  const requestedBookings = bookings.filter((booking) => booking.status === 'REQUESTED');
  const activeBookings = bookings.filter((booking) => ['ACCEPTED', 'COMPLETED'].includes(booking.status));
  const isApproved = profile?.verifyStatus === 'APPROVED' && kycSubmission?.status === 'APPROVED';

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', { token }).catch(() => ({ slots: [] })),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ]).then(([profileResponse, slotResponse, kycResponse]) => {
      if (!mounted) return;
      setProfile(profileResponse.profile || null);
      setAvailabilitySlots(slotResponse.slots);
      setKycSubmission(kycResponse.submission);
    });
    return () => {
      mounted = false;
    };
  }, [token]);

  async function updateBookingStatus(bookingId: string, status: 'ACCEPTED' | 'DECLINED' | 'COMPLETED') {
    await api(`/bookings/${bookingId}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  return (
    <>
      <section className="artisan-dashboard-hero">
        <div>
          <h1>Good morning, {displayName.split(' ')[0]}</h1>
          <p className="muted">
            {isApproved
              ? 'Your profile is approved. Manage jobs, service offers, messages, and reviews from here.'
              : 'Your profile is still being reviewed. Complete profile settings while admin approval is pending.'}
          </p>
        </div>
        <span className={`booking-status ${isApproved ? 'completed' : 'pending'}`}>
          {isApproved ? 'Approved' : kycSubmission?.status?.toLowerCase().replace(/_/g, ' ') || 'Pending review'}
        </span>
        <div className="artisan-stat-grid">
          <StatCard label="Total bookings" value={bookings.length} hint="All time" />
          <StatCard label="Ratings" value={`${profile?.avgRating || 0}/5.0`} hint={`${profile?.ratingCount || 0} reviews`} />
          <StatCard label="Active jobs" value={activeBookings.length} hint="This week" />
          <StatCard label="New requests" value={requestedBookings.length} hint="Needs your response" />
        </div>
      </section>

      <section className="artisan-dashboard-grid">
        <div className="artisan-request-stack">
          <div className="logged-section-head">
            <h2>New Requests</h2>
            <button type="button" onClick={openBookings}>view all</button>
          </div>
          {requestedBookings.length === 0 && <EmptyState title="No new requests" body="New booking requests will appear here." />}
          {requestedBookings.slice(0, 2).map((booking) => (
            <article className="artisan-request-card" key={booking.id}>
              <span className="recommended-avatar">{(booking.customerUser?.email || 'C').slice(0, 1).toUpperCase()}</span>
              <div>
                <h3>{booking.customerUser?.email?.split('@')[0] || 'Customer'}</h3>
                <small>{booking.offering?.title || 'Service request'}</small>
                <p>{bookingDate(booking.scheduledAt)} · {booking.artisan?.area || profile?.area || 'Lagos'}</p>
                <div className="actions">
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => runAction(() => updateBookingStatus(booking.id, 'DECLINED'), 'Booking request declined')}
                  >
                    Decline
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => runAction(() => updateBookingStatus(booking.id, 'ACCEPTED'), 'Booking request accepted')}
                  >
                    Accept
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <aside className="artisan-side-stack">
          <article className="artisan-soft-card">
            <div className="logged-section-head">
              <h2>Availability</h2>
              <button type="button" onClick={openProfile}>Edit</button>
            </div>
            <div className="availability-dots">
              {dayLabels.slice(1).concat(dayLabels[0]).map((day, index) => {
                const dayIndex = index === 6 ? 0 : index + 1;
                return (
                  <span key={day} className={availabilitySlots.some((slot) => slot.dayOfWeek === dayIndex) ? 'active' : ''}>
                    {day.slice(0, 1)}
                  </span>
                );
              })}
            </div>
          </article>
          <article className="artisan-soft-card">
            <h2>This week</h2>
            <dl className="summary-list">
              <div><dt>Jobs Completed</dt><dd>{bookings.filter((booking) => booking.status === 'COMPLETED').length}</dd></div>
              <div><dt>Jobs Upcoming</dt><dd>{activeBookings.length}</dd></div>
              <div><dt>Earnings</dt><dd>{money(0)}</dd></div>
            </dl>
          </article>
          <article className="artisan-soft-card quick-links">
            <h2>Quick links</h2>
            <button onClick={openProfile}>Profile settings</button>
            <button onClick={openOffers}>Service offers</button>
            <button onClick={openMessages}>Messages</button>
            <button onClick={openReviews}>Reviews</button>
          </article>
        </aside>
      </section>
    </>
  );
}

function statusLabel(status: Booking['status']) {
  return status.toLowerCase().replace(/_/g, ' ');
}

function paymentLabel(status?: PaymentStatus) {
  if (!status) return 'unpaid';
  return status.toLowerCase().replace(/_/g, ' ');
}

function bookingDate(value: string | null) {
  if (!value) return 'Not scheduled';

  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function bookingInputValue(value: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function parseBookingInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.includes('T')
    ? trimmed
    : trimmed.replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function BookingsSummary({ bookings, title = 'My bookings' }: { bookings: Booking[]; title?: string }) {
  return (
    <article className="panel-card">
      <p className="eyebrow">Customer</p>
      <h2>{title}</h2>
      {bookings.length === 0 && <p>No bookings yet.</p>}
      {bookings.map((booking) => (
        <div className="list-item" key={booking.id}>
          <strong>{booking.offering?.title || 'Booking'}</strong>
          <span>{booking.status}</span>
        </div>
      ))}
    </article>
  );
}

function bookingContactName(booking: Booking) {
  return booking.customerUser?.email?.split('@')[0] || 'Customer';
}

function bookingLocation(booking: Booking) {
  return booking.artisan?.area || booking.offering?.artisan?.area || 'Lagos';
}

function ArtisanJobsPage({
  bookings,
  visibleBookings,
  selectedBooking,
  filter,
  tabs,
  busy,
  setFilter,
  selectBooking,
  openMessages,
  updateBookingStatus,
}: {
  bookings: Booking[];
  visibleBookings: Booking[];
  selectedBooking: Booking | null;
  filter: 'ALL' | Booking['status'];
  tabs: Array<{ label: string; value: 'ALL' | Booking['status'] }>;
  busy: boolean;
  setFilter: (filter: 'ALL' | Booking['status']) => void;
  selectBooking: (bookingId: string | null) => void;
  openMessages: () => void;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => Promise<void>;
}) {
  if (selectedBooking) {
    const isAccepted = selectedBooking.status === 'ACCEPTED';
    const customerName = bookingContactName(selectedBooking);
    const serviceName = selectedBooking.offering?.title || 'Basic inspection';

    return (
      <section className="artisan-job-detail-page">
        <div className="artisan-job-detail-head">
          <div>
            <h2>Active bookings</h2>
            <p>
              {isAccepted ? 'Accepted' : statusLabel(selectedBooking.status)} · Booking #{selectedBooking.id.slice(0, 6)}
            </p>
          </div>
          <span className={`booking-status ${selectedBooking.status.toLowerCase()}`}>
            {statusLabel(selectedBooking.status)}
          </span>
        </div>

        <div className="artisan-job-customer">
          <small>Customer</small>
          <div className="booking-person">
            <span>{customerName.slice(0, 1).toUpperCase()}</span>
            <div>
              <h3>{customerName}</h3>
              <p>{bookingLocation(selectedBooking)} · 3 past bookings</p>
            </div>
          </div>
        </div>

        <article className="artisan-job-detail-card">
          <h3>Booking Details</h3>
          <dl>
            <div><dt>Service type</dt><dd>{serviceName}</dd></div>
            <div><dt>Date</dt><dd>{bookingDate(selectedBooking.scheduledAt)}</dd></div>
            <div><dt>Time slot</dt><dd>{selectedBooking.scheduledAt ? formatMessageTime(selectedBooking.scheduledAt) : 'To be confirmed'}</dd></div>
            <div className="full"><dt>NOTE</dt><dd>{selectedBooking.note || 'No note added'}</dd></div>
          </dl>
        </article>

        <div className="artisan-job-actions">
          {selectedBooking.status === 'REQUESTED' && (
            <button disabled={busy} onClick={() => updateBookingStatus(selectedBooking.id, 'ACCEPTED')}>
              Accept request
            </button>
          )}
          {selectedBooking.status === 'ACCEPTED' && (
            <button disabled={busy} onClick={() => updateBookingStatus(selectedBooking.id, 'COMPLETED')}>
              Mark as completed
            </button>
          )}
          <button className="secondary-button" onClick={openMessages}>Open Chat</button>
          <button className="text-button" onClick={() => selectBooking(null)}>Back to jobs</button>
        </div>
      </section>
    );
  }

  return (
    <section className="artisan-jobs-page">
      <div className="artisan-jobs-head">
        <h2>Active bookings</h2>
        <p>You have {bookings.length} Active bookings</p>
      </div>
      <div className="booking-tabs artisan-tabs" role="tablist" aria-label="Booking filters">
        {tabs.map((tab) => (
          <button key={tab.value} className={filter === tab.value ? 'active' : ''} onClick={() => setFilter(tab.value)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="artisan-job-list">
        {visibleBookings.length === 0 && <EmptyState title="No jobs here" body="Bookings matching this status will appear here." />}
        {visibleBookings.map((booking) => {
          const customerName = bookingContactName(booking);
          return (
            <article className="artisan-job-row" key={booking.id}>
              <div className="booking-person">
                <span>{customerName.slice(0, 1).toUpperCase()}</span>
                <div>
                  <h3>{customerName}</h3>
                  <p>{booking.offering?.title || 'Service booking'}</p>
                </div>
              </div>
              <p>{bookingDate(booking.scheduledAt)} · {bookingLocation(booking)}</p>
              <span className={`booking-status ${booking.status.toLowerCase()}`}>{statusLabel(booking.status)}</span>
              <button onClick={() => selectBooking(booking.id)}>
                {booking.status === 'REQUESTED' ? 'View booking request' : 'View active bookings'}
              </button>
              <button className="secondary-button" onClick={openMessages}>Open Chat</button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function BookingsPage({
  bookings,
  mode,
  token,
  busy,
  runAction,
  refresh,
  openMessages,
}: {
  bookings: Booking[];
  mode: 'customer' | 'artisan';
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  openMessages: () => void;
}) {
  const [filter, setFilter] = useState<'ALL' | Booking['status']>('ALL');
  const tabs: Array<{ label: string; value: 'ALL' | Booking['status'] }> = [
    { label: 'All', value: 'ALL' },
    { label: 'Pending', value: 'REQUESTED' },
    { label: 'Accepted', value: 'ACCEPTED' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Declined', value: 'DECLINED' },
  ];
  const visibleBookings = filter === 'ALL' ? bookings : bookings.filter((booking) => booking.status === filter);
  const [selectedArtisanBookingId, setSelectedArtisanBookingId] = useState<string | null>(null);
  const selectedArtisanBooking = bookings.find((booking) => booking.id === selectedArtisanBookingId) || null;

  async function cancelBooking(bookingId: string) {
    await api(`/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      token,
    });
    await refresh();
  }

  async function updateBookingStatus(bookingId: string, status: Booking['status']) {
    await api(`/bookings/${bookingId}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  async function startPayment(bookingId: string) {
    const response = await api<{ authorizationUrl?: string }>('/payments/initialize', {
      method: 'POST',
      token,
      body: JSON.stringify({ bookingId }),
    });

    if (response.authorizationUrl) {
      window.location.href = response.authorizationUrl;
      return;
    }

    await refresh();
  }

  async function openDispute(bookingId: string) {
    await api(`/bookings/${bookingId}/dispute`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        reason: 'Customer requested admin review from the bookings page',
      }),
    });
    await refresh();
  }

  async function reschedule(booking: Booking) {
    const nextValue = window.prompt(
      'Enter the new date and time in this format: YYYY-MM-DD HH:MM',
      bookingInputValue(booking.scheduledAt)
    );

    if (!nextValue) {
      return;
    }

    const parsed = parseBookingInput(nextValue);

    if (!parsed) {
      throw new Error('Please enter a valid date and time like 2026-05-15 14:30');
    }

    const nextNote = window.prompt(
      'Optional note for the reschedule',
      booking.note || ''
    );

    await api(`/bookings/${booking.id}/reschedule`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        scheduledAt: parsed.toISOString(),
        note: nextNote === null ? booking.note : nextNote,
      }),
    });
    await refresh();
  }

  if (mode === 'artisan') {
    return (
      <ArtisanJobsPage
        bookings={bookings}
        visibleBookings={visibleBookings}
        selectedBooking={selectedArtisanBooking}
        filter={filter}
        tabs={tabs}
        busy={busy}
        setFilter={setFilter}
        selectBooking={setSelectedArtisanBookingId}
        openMessages={openMessages}
        updateBookingStatus={(bookingId, status) =>
          runAction(() => updateBookingStatus(bookingId, status), `Booking ${status.toLowerCase()}`)
        }
      />
    );
  }

  return (
    <section className="bookings-page">
      <div className="bookings-toolbar">
        <div>
          <p className="eyebrow">Booking details</p>
          <h2>My bookings</h2>
        </div>
        <span>{bookings.length} total</span>
      </div>

      <div className="booking-tabs" role="tablist" aria-label="Booking filters">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className={filter === tab.value ? 'active' : ''}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visibleBookings.length === 0 && (
        <EmptyState
          title="No bookings yet"
          body="Your service bookings will appear here after you request a service."
        />
      )}

      <div className="booking-list">
        {visibleBookings.map((booking) => {
          const contactName =
            booking.artisan?.displayName || booking.offering?.artisan?.displayName || 'Bundo professional';
          const contactInitials = contactName
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          const serviceName = booking.offering?.title || 'Service booking';
          const price = booking.offering?.priceFrom ? money(booking.offering.priceFrom) : 'To be confirmed';
          const paymentStatus = booking.payment?.status;
          const latestDispute = booking.disputes?.[0];
          const canPay =
            mode === 'customer' &&
            !['CANCELLED', 'DECLINED', 'COMPLETED'].includes(booking.status) &&
            (!paymentStatus || ['UNPAID', 'PAYMENT_PENDING', 'FAILED'].includes(paymentStatus));
          const canDispute =
            mode === 'customer' &&
            paymentStatus === 'PAID_HELD' &&
            !booking.disputes?.some((dispute) => dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW');

          return (
            <article className="booking-detail-card" key={booking.id}>
              <header className="booking-detail-head">
                <div className="booking-person">
                  <span>{contactInitials}</span>
                  <div>
                    <h3>{contactName}</h3>
                    <p>{booking.offering?.category?.name || serviceName}</p>
                  </div>
                </div>
                <span className={`booking-status ${booking.status.toLowerCase()}`}>{statusLabel(booking.status)}</span>
              </header>

              <dl className="booking-detail-list">
                <div>
                  <dt>Service</dt>
                  <dd>{serviceName}</dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>{bookingDate(booking.scheduledAt)}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{booking.scheduledAt ? formatMessageTime(booking.scheduledAt) : 'To be confirmed'}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{booking.artisan?.area || booking.offering?.artisan?.area || 'To be confirmed'}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{booking.note || 'No note added'}</dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>
                    <span className={`payment-chip ${(paymentStatus || 'UNPAID').toLowerCase()}`}>
                      {paymentLabel(paymentStatus)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Dispute</dt>
                  <dd>{latestDispute ? latestDispute.status.toLowerCase().replace(/_/g, ' ') : 'None'}</dd>
                </div>
              </dl>

              <div className="booking-total-row">
                <span>Estimated total</span>
                <strong>{price}</strong>
              </div>

              <div className="booking-card-actions">
                {canPay && (
                  <button
                    className="primary-action"
                    disabled={busy}
                    onClick={() => runAction(() => startPayment(booking.id), 'Payment checkout opened')}
                  >
                    Pay securely
                  </button>
                )}
                {paymentStatus === 'PAID_HELD' && (
                  <button className="secondary-button" disabled>
                    Payment secured
                  </button>
                )}
                {paymentStatus === 'RELEASED' && (
                  <button className="secondary-button" disabled>
                    Payment released
                  </button>
                )}
                {['REQUESTED', 'ACCEPTED'].includes(booking.status) && (
                  <button
                    disabled={busy}
                    onClick={() => runAction(() => cancelBooking(booking.id), 'Booking cancelled')}
                  >
                    Cancel request
                  </button>
                )}
                {(['REQUESTED', 'ACCEPTED'] as Booking['status'][]).includes(booking.status) && (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => runAction(() => reschedule(booking), 'Booking rescheduled')}
                  >
                    Reschedule
                  </button>
                )}
                {booking.status === 'COMPLETED' && (
                  <button disabled={busy} onClick={() => runAction(async () => undefined, 'Reviews are created from completed booking flow')}>
                    Leave review
                  </button>
                )}
                {booking.status === 'ACCEPTED' && (
                  <button className="secondary-button" onClick={openMessages}>
                    Open chat
                  </button>
                )}
                {canDispute && (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => runAction(() => openDispute(booking.id), 'Dispute opened')}
                  >
                    Raise dispute
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AdminBookingsPanel({
  token,
  bookings,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  bookings: Booking[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  async function releasePayment(bookingId: string) {
    await api(`/admin/bookings/${bookingId}/release-payment`, {
      method: 'POST',
      token,
    });
    await refresh();
  }

  async function resolveDispute(
    disputeId: string,
    action: 'RELEASE' | 'REFUND_FULL' | 'REFUND_PARTIAL'
  ) {
    const resolution = window.prompt(
      action === 'RELEASE'
        ? 'Add a short admin note for this payout release'
        : 'Add a short admin note for this refund decision',
      ''
    );

    let refundAmount: number | undefined;

    if (action === 'REFUND_PARTIAL') {
      const rawAmount = window.prompt('Enter the refund amount in NGN', '');
      if (!rawAmount) {
        return;
      }
      refundAmount = Number(rawAmount);
    }

    await api(`/admin/disputes/${disputeId}/resolve`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        action,
        resolution: resolution || undefined,
        refundAmount,
      }),
    });
    await refresh();
  }

  return (
    <section className="admin-bookings">
      <div className="section-head compact">
        <div>
          <p className="eyebrow">Payments</p>
          <h2>Held booking funds</h2>
          <p>Release artisan payouts only after service completion and internal review.</p>
        </div>
      </div>

      {bookings.length === 0 && (
        <EmptyState
          title="No admin bookings yet"
          body="Completed and paid bookings will appear here once customers start transacting."
        />
      )}

      <div className="booking-list">
        {bookings.map((booking) => {
          const paymentStatus = booking.payment?.status;
          const openDispute = booking.disputes?.find(
            (dispute) =>
              dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW'
          );
          const canRelease =
            booking.status === 'COMPLETED' &&
            paymentStatus === 'PAID_HELD' &&
            !openDispute;

          return (
            <article className="booking-detail-card" key={booking.id}>
              <header className="booking-detail-head">
                <div className="booking-person">
                  <span>{(booking.artisan?.displayName || 'B').slice(0, 1).toUpperCase()}</span>
                  <div>
                    <h3>{booking.artisan?.displayName || 'Artisan profile'}</h3>
                    <p>{booking.offering?.title || booking.offering?.category?.name || 'Service booking'}</p>
                  </div>
                </div>
                <div className="admin-status-stack">
                  <span className={`booking-status ${booking.status.toLowerCase()}`}>{statusLabel(booking.status)}</span>
                  <span className={`payment-chip ${(paymentStatus || 'UNPAID').toLowerCase()}`}>
                    {paymentLabel(paymentStatus)}
                  </span>
                </div>
              </header>

              <dl className="booking-detail-list">
                <div>
                  <dt>Customer</dt>
                  <dd>{booking.customerUser?.email || 'Unknown customer'}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{booking.artisan?.city || 'Unknown city'}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{booking.payment ? money(booking.payment.amount) : money(booking.offering?.priceFrom || 0)}</dd>
                </div>
                <div>
                  <dt>Provider earns</dt>
                  <dd>{booking.payment ? money(booking.payment.providerEarning) : 'Pending payment'}</dd>
                </div>
                <div>
                  <dt>Disputes</dt>
                  <dd>{openDispute ? openDispute.status.toLowerCase().replace(/_/g, ' ') : booking.disputes?.length || 0}</dd>
                </div>
              </dl>

              <div className="booking-card-actions">
                {openDispute && (
                  <>
                    <button
                      className="primary-action"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () => resolveDispute(openDispute.id, 'RELEASE'),
                          'Dispute resolved with artisan release'
                        )
                      }
                    >
                      Resolve and release
                    </button>
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () => resolveDispute(openDispute.id, 'REFUND_FULL'),
                          'Dispute resolved with full refund'
                        )
                      }
                    >
                      Full refund
                    </button>
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () => resolveDispute(openDispute.id, 'REFUND_PARTIAL'),
                          'Dispute resolved with partial refund'
                        )
                      }
                    >
                      Partial refund
                    </button>
                  </>
                )}
                {canRelease ? (
                  <button
                    className="primary-action"
                    disabled={busy}
                    onClick={() => runAction(() => releasePayment(booking.id), 'Payout released to artisan')}
                  >
                    Release payout
                  </button>
                ) : !openDispute ? (
                  <button className="secondary-button" disabled>
                    {paymentStatus === 'RELEASED'
                      ? 'Already released'
                      : paymentStatus === 'PAID_HELD'
                        ? 'Awaiting completion'
                        : 'No held funds yet'}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AdminKycPanel({
  token,
  submissions,
  artisans: _artisans,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  submissions: ArtisanKycSubmission[];
  artisans?: AdminArtisanRecord[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  async function reviewSubmission(
    submissionId: string,
    status: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'
  ) {
    const reviewNote = window.prompt(
      status === 'APPROVED'
        ? 'Optional approval note'
        : 'Add a short note for the artisan',
      ''
    );

    await api(`/admin/kyc-submissions/${submissionId}/review`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        status,
        reviewNote: reviewNote || undefined,
      }),
    });
    await refresh();
  }

  return (
    <section className="admin-bookings">
      <div className="section-head compact">
        <div>
          <p className="eyebrow">Compliance</p>
          <h2>Artisan KYC review</h2>
          <p>Review submitted identity details before scaling artisan approvals and payouts.</p>
        </div>
      </div>

      {submissions.length === 0 && (
        <EmptyState
          title="No KYC submissions yet"
          body="Artisan KYC submissions will appear here once providers start sending their identity details."
        />
      )}

      <div className="booking-list">
        {submissions.map((submission) => (
          <article className="booking-detail-card" key={submission.id}>
            <header className="booking-detail-head">
              <div className="booking-person">
                <span>{(submission.legalName || 'K').slice(0, 1).toUpperCase()}</span>
                <div>
                  <h3>{submission.legalName}</h3>
                  <p>{submission.artisan?.displayName || submission.artisan?.user?.email || 'Artisan submission'}</p>
                </div>
              </div>
              <span className={`booking-status ${submission.status.toLowerCase().replace(/_/g, '-')}`}>
                {submission.status.toLowerCase().replace(/_/g, ' ')}
              </span>
            </header>

            <dl className="booking-detail-list">
              <div>
                <dt>Document</dt>
                <dd>{submission.documentType}</dd>
              </div>
              <div>
                <dt>Number</dt>
                <dd>{submission.documentNumber}</dd>
              </div>
              <div>
                <dt>City</dt>
                <dd>{submission.city}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{submission.address}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{bookingDate(submission.submittedAt)}</dd>
              </div>
              <div>
                <dt>Document URL</dt>
                <dd>
                  <a href={submission.documentImageUrl} target="_blank" rel="noreferrer">
                    Open document
                  </a>
                </dd>
              </div>
            </dl>

            <div className="booking-card-actions">
              <button
                className="primary-action"
                disabled={busy || submission.status === 'APPROVED'}
                onClick={() =>
                  runAction(
                    () => reviewSubmission(submission.id, 'APPROVED'),
                    'KYC approved'
                  )
                }
              >
                Approve
              </button>
              <button
                className="secondary-button"
                disabled={busy || submission.status === 'CHANGES_REQUESTED'}
                onClick={() =>
                  runAction(
                    () => reviewSubmission(submission.id, 'CHANGES_REQUESTED'),
                    'KYC returned for changes'
                  )
                }
              >
                Request changes
              </button>
              <button
                className="secondary-button"
                disabled={busy || submission.status === 'REJECTED'}
                onClick={() =>
                  runAction(
                    () => reviewSubmission(submission.id, 'REJECTED'),
                    'KYC rejected'
                  )
                }
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NotificationsPanel({
  token,
  notifications,
  busy,
  runAction,
  refresh,
  pushStatus,
  pushEnabled,
  enablePushAlerts,
}: {
  token: string;
  notifications: Notification[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  pushStatus: PushStatus;
  pushEnabled: boolean;
  enablePushAlerts: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  async function markRead(notificationId: string) {
    await api(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
      token,
    });
    await refresh();
  }

  async function markAllRead() {
    await api('/notifications/read-all', {
      method: 'PATCH',
      token,
    });
    await refresh();
  }

  async function sendTestNotification() {
    await api('/notifications/test', {
      method: 'POST',
      token,
    });
    await refresh();
  }

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const visibleNotifications =
    filter === 'unread'
      ? notifications.filter((notification) => !notification.readAt)
      : notifications;

  return (
    <section className="notifications-page">
      <header className="notifications-hero">
        <div className="notifications-hero-copy">
          <p className="eyebrow">Notifications</p>
          <h2>Stay on top of bookings, messages, payments, and reviews</h2>
          <p>
            Everything important to your account lands here first, with browser alerts available when
            you want faster updates.
          </p>
        </div>
        <div className="notifications-summary-grid">
          <article className="notification-summary-card">
            <span>Total</span>
            <strong>{notifications.length}</strong>
            <small>Recent activity in your workspace</small>
          </article>
          <article className="notification-summary-card accent">
            <span>Unread</span>
            <strong>{unreadCount}</strong>
            <small>New items waiting for you</small>
          </article>
        </div>
      </header>

      <section className={`push-banner ${pushEnabled ? 'enabled' : ''}`}>
        <div className="push-banner-copy">
          <p className="eyebrow">Browser alerts</p>
          <h3>
            {pushEnabled
              ? 'Browser alerts are active'
              : pushStatus === 'missing-config'
                ? 'Push alerts need one more Firebase setting'
                : pushStatus === 'denied'
                  ? 'Browser notifications are blocked for this site'
                  : 'Turn on push alerts for real-time updates'}
          </h3>
          <p>
            {pushEnabled
              ? 'New booking, payment, and message activity can now reach this browser even when you are away from the page.'
              : pushStatus === 'missing-config'
                ? 'Add VITE_FIREBASE_VAPID_KEY in the client environment to finish web push setup.'
                : pushStatus === 'unsupported'
                  ? 'This browser does not support Firebase web push for the current environment.'
                  : pushStatus === 'denied'
                    ? 'Re-enable notifications in your browser site settings, then come back here.'
                    : 'Enable alerts to get a visible heads-up without needing to keep the notifications page open.'}
          </p>
        </div>
        <div className="push-banner-actions">
          <button
            className={pushEnabled ? 'secondary-button' : 'primary-button'}
            disabled={busy || pushEnabled || pushStatus === 'denied' || pushStatus === 'missing-config'}
            onClick={() => runAction(enablePushAlerts, '')}
          >
            {pushEnabled ? 'Alerts enabled' : 'Enable push alerts'}
          </button>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => runAction(sendTestNotification, 'Test notification sent')}
          >
            Send test notification
          </button>
        </div>
      </section>

      <section className="notifications-shell">
        <div className="notifications-toolbar">
          <div className="notification-filter-tabs" role="tablist" aria-label="Notification filters">
            <button
              className={filter === 'all' ? 'active' : ''}
              type="button"
              onClick={() => setFilter('all')}
            >
              All activity
            </button>
            <button
              className={filter === 'unread' ? 'active' : ''}
              type="button"
              onClick={() => setFilter('unread')}
            >
              Unread
            </button>
          </div>
          <button
            className="secondary-button"
            disabled={busy || unreadCount === 0}
            onClick={() => runAction(markAllRead, 'All notifications marked as read')}
          >
            Mark all as read
          </button>
        </div>

      {visibleNotifications.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          body={
            filter === 'unread'
              ? 'You are all caught up for now.'
              : 'Booking, payment, chat, review, and admin events will appear here.'
          }
        />
      ) : (
        <div className="notification-list">
          {visibleNotifications.map((notification) => (
            <article
              className={`notification-card ${notification.readAt ? 'read' : 'unread'}`}
              key={notification.id}
            >
              <div className={`notification-dot ${notification.readAt ? 'read' : 'unread'}`} aria-hidden="true" />
              <div className="notification-copy">
                <div className="notification-meta">
                  <span className="notification-type-pill">{notificationTypeLabel(notification.type)}</span>
                  <small>{relativeNotificationTime(notification.createdAt)}</small>
                </div>
                <h3>{notification.title}</h3>
                <p>{notification.body}</p>
                <small>{bookingDate(notification.createdAt)}</small>
              </div>
              <div className="notification-card-actions">
                {!notification.readAt ? (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => runAction(() => markRead(notification.id), 'Notification marked as read')}
                  >
                    Mark read
                  </button>
                ) : (
                  <span className="notification-read-label">Read</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      </section>
    </section>
  );
}

function adminMetricLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, (value) => value.toUpperCase());
}

function AdminConsole({
  section,
  setSection,
  stats,
  users,
  artisans,
  bookings,
  conversations,
  submissions,
  categories,
  token,
  adminLabel,
  busy,
  runAction,
  refresh,
  onSignOut,
}: {
  section: AdminSection;
  setSection: (section: AdminSection) => void;
  stats: Record<string, number> | null;
  users: AdminUserRecord[];
  artisans: AdminArtisanRecord[];
  bookings: Booking[];
  conversations: Conversation[];
  submissions: ArtisanKycSubmission[];
  categories: AdminCategoryRecord[];
  token: string;
  adminLabel: string;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  onSignOut: () => void;
}) {
  const sections: Array<{
    id: AdminSection;
    label: string;
    description: string;
    count?: number;
  }> = [
    { id: 'overview', label: 'Overview', description: 'Signals and open work' },
    { id: 'profiles', label: 'Profiles', description: 'Users and artisans', count: users.length + artisans.length },
    { id: 'jobs', label: 'Jobs', description: 'Bookings and payouts', count: bookings.length },
    { id: 'messages', label: 'Messages', description: 'Threads and notes', count: conversations.length },
    { id: 'verification', label: 'Verification', description: 'KYC and approvals', count: submissions.length },
    { id: 'catalog', label: 'Catalog', description: 'Service categories', count: categories.length },
  ];

  return (
    <section className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <p className="eyebrow">Admin console</p>
          <h1>Bundo operations</h1>
          <p>Manage trust, supply, support, and marketplace activity from one place.</p>
        </div>
        <div className="admin-operator-card">
          <span>Signed in as</span>
          <strong>{adminLabel}</strong>
          <button type="button" onClick={onSignOut}>Log out</button>
        </div>
        <nav className="admin-nav" aria-label="Admin sections">
          {sections.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? 'active' : ''}
              type="button"
              onClick={() => setSection(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
              {typeof item.count === 'number' ? <strong>{item.count}</strong> : null}
            </button>
          ))}
        </nav>
      </aside>

      <section className="admin-main">
        {section === 'overview' && (
          <AdminOverviewPanel
            stats={stats}
            users={users}
            artisans={artisans}
            bookings={bookings}
            conversations={conversations}
            submissions={submissions}
            setSection={setSection}
          />
        )}
        {section === 'profiles' && (
          <AdminProfilesPanel
            token={token}
            users={users}
            artisans={artisans}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
          />
        )}
        {section === 'jobs' && (
          <AdminBookingsPanel
            token={token}
            bookings={bookings}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
          />
        )}
        {section === 'messages' && (
          <AdminChatPanel
            token={token}
            conversations={conversations}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
          />
        )}
        {section === 'verification' && (
          <AdminKycPanel
            token={token}
            submissions={submissions}
            artisans={artisans}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
          />
        )}
        {section === 'catalog' && (
          <AdminCatalogPanel
            token={token}
            categories={categories}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
          />
        )}
      </section>
    </section>
  );
}

function AdminOverviewPanel({
  stats,
  users,
  artisans,
  bookings,
  conversations,
  submissions,
  setSection,
}: {
  stats: Record<string, number> | null;
  users: AdminUserRecord[];
  artisans: AdminArtisanRecord[];
  bookings: Booking[];
  conversations: Conversation[];
  submissions: ArtisanKycSubmission[];
  setSection: (section: AdminSection) => void;
}) {
  const priorityItems = [
    {
      title: 'Pending KYC reviews',
      value: submissions.filter((submission) => submission.status === 'PENDING').length,
      action: 'Open verification',
      section: 'verification' as AdminSection,
    },
    {
      title: 'Open booking issues',
      value: bookings.filter((booking) =>
        booking.disputes?.some((dispute) => dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW')
      ).length,
      action: 'Open jobs',
      section: 'jobs' as AdminSection,
    },
    {
      title: 'Needs artisan review',
      value: artisans.filter((artisan) => artisan.verifyStatus === 'PENDING').length,
      action: 'Open profiles',
      section: 'profiles' as AdminSection,
    },
  ];

  return (
    <section className="admin-panel">
      <header className="admin-panel-head">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Run the marketplace, not the customer UI</h2>
          <p>Everything here is tuned for decisions, follow-up, and intervention.</p>
        </div>
      </header>

      <div className="admin-stat-grid">
        {!stats && <EmptyState title="Admin stats unavailable" body="Sign in as an admin, then reopen this page." />}
        {stats &&
          Object.entries(stats).map(([key, value]) => (
            <article className="admin-stat-card" key={key}>
              <span>{adminMetricLabel(key)}</span>
              <strong>{value}</strong>
            </article>
          ))}
      </div>

      <div className="admin-overview-grid">
        <article className="admin-surface">
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Priority queue</p>
              <h3>What needs admin attention</h3>
            </div>
          </div>
          <div className="admin-priority-list">
            {priorityItems.map((item) => (
              <button
                key={item.title}
                className="admin-priority-item"
                type="button"
                onClick={() => setSection(item.section)}
              >
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.action}</small>
                </div>
                <span>{item.value}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="admin-surface">
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Coverage</p>
              <h3>What the panel currently controls</h3>
            </div>
          </div>
          <dl className="admin-summary-list">
            <div>
              <dt>User accounts</dt>
              <dd>{users.length}</dd>
            </div>
            <div>
              <dt>Artisan profiles</dt>
              <dd>{artisans.length}</dd>
            </div>
            <div>
              <dt>Bookings loaded</dt>
              <dd>{bookings.length}</dd>
            </div>
            <div>
              <dt>Support threads</dt>
              <dd>{conversations.length}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}

function AdminProfilesPanel({
  token,
  users,
  artisans,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  users: AdminUserRecord[];
  artisans: AdminArtisanRecord[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  async function updateStatus(firebaseUid: string, status: 'ACTIVE' | 'BANNED') {
    await api(`/admin/users/${firebaseUid}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  async function updateRole(firebaseUid: string, role: Role) {
    await api(`/admin/users/${firebaseUid}/role`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ role }),
    });
    await refresh();
  }

  async function updateVerification(artisanId: string, verifyStatus: Artisan['verifyStatus']) {
    await api(`/admin/artisans/${artisanId}/verify`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ verifyStatus }),
    });
    await refresh();
  }

  return (
    <section className="admin-panel">
      <header className="admin-panel-head">
        <div>
          <p className="eyebrow">Profiles</p>
          <h2>Users and service providers</h2>
          <p>Adjust account access, roles, and artisan verification without leaving the admin surface.</p>
        </div>
      </header>

      <div className="admin-stack">
        <article className="admin-surface">
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Accounts</p>
              <h3>All users</h3>
            </div>
          </div>
          <div className="admin-record-list">
            {users.map((user) => (
              <article className="admin-record-card" key={user.firebaseUid}>
                <div className="admin-record-head">
                  <div>
                    <h4>{user.email || user.phone || user.firebaseUid}</h4>
                    <p>{user.firebaseUid}</p>
                  </div>
                  <div className="admin-pill-row">
                    <span className={`booking-status ${user.status.toLowerCase() === 'active' ? 'accepted' : 'cancelled'}`}>
                      {user.status.toLowerCase()}
                    </span>
                    <span className="booking-status">{(user.role || 'UNASSIGNED').toLowerCase()}</span>
                  </div>
                </div>
                <dl className="admin-inline-list">
                  <div>
                    <dt>Phone</dt>
                    <dd>{user.phone || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Artisan profile</dt>
                    <dd>{user.artisanProfile?.displayName || 'None yet'}</dd>
                  </div>
                </dl>
                <div className="admin-action-row">
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        () => updateStatus(user.firebaseUid, user.status === 'ACTIVE' ? 'BANNED' : 'ACTIVE'),
                        user.status === 'ACTIVE' ? 'User banned' : 'User reactivated'
                      )
                    }
                  >
                    {user.status === 'ACTIVE' ? 'Ban user' : 'Restore user'}
                  </button>
                  {(['CUSTOMER', 'ARTISAN', 'ADMIN'] as Role[]).map((role) => (
                    <button
                      key={role}
                      className={user.role === role ? 'primary-button' : 'secondary-button'}
                      disabled={busy}
                      onClick={() => runAction(() => updateRole(user.firebaseUid, role), `Role changed to ${role.toLowerCase()}`)}
                    >
                      {role.toLowerCase()}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="admin-surface">
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Supply</p>
              <h3>Artisan profiles</h3>
            </div>
          </div>
          <div className="admin-record-list">
            {artisans.map((artisan) => (
              <article className="admin-record-card" key={artisan.id}>
                <div className="admin-record-head">
                  <div>
                    <h4>{artisan.displayName}</h4>
                    <p>{artisan.user?.email || artisan.city}</p>
                  </div>
                  <div className="admin-pill-row">
                    <span className={`booking-status ${artisan.verifyStatus.toLowerCase()}`}>
                      {artisan.verifyStatus.toLowerCase()}
                    </span>
                    <span className="booking-status">
                      {artisan.avgRating.toFixed(1)} ({artisan.ratingCount})
                    </span>
                  </div>
                </div>
                <dl className="admin-inline-list">
                  <div>
                    <dt>Location</dt>
                    <dd>{[artisan.area, artisan.city].filter(Boolean).join(', ')}</dd>
                  </div>
                  <div>
                    <dt>Activity</dt>
                    <dd>
                      {artisan._count?.offerings || 0} offers, {artisan._count?.bookingsReceived || 0} jobs
                    </dd>
                  </div>
                </dl>
                <div className="admin-action-row">
                  {(['PENDING', 'APPROVED', 'REJECTED'] as Artisan['verifyStatus'][]).map((status) => (
                    <button
                      key={status}
                      className={artisan.verifyStatus === status ? 'primary-button' : 'secondary-button'}
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () => updateVerification(artisan.id, status),
                          `Artisan marked ${status.toLowerCase()}`
                        )
                      }
                    >
                      {status.toLowerCase()}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function AdminCatalogPanel({
  token,
  categories,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  categories: AdminCategoryRecord[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  async function createNewCategory() {
    const name = window.prompt('Category name', '');
    if (!name) return;
    const slug = window.prompt('Category slug', name.toLowerCase().trim().replace(/\s+/g, '-'));
    if (!slug) return;
    const iconKey = window.prompt('Icon key', 'service');
    if (!iconKey) return;

    await api('/admin/categories', {
      method: 'POST',
      token,
      body: JSON.stringify({ name, slug, iconKey }),
    });
    await refresh();
  }

  async function editCategory(category: AdminCategoryRecord) {
    const name = window.prompt('Update category name', category.name);
    if (!name) return;
    const slug = window.prompt('Update category slug', category.slug);
    if (!slug) return;
    const iconKey = window.prompt('Update icon key', category.iconKey);
    if (!iconKey) return;

    await api(`/admin/categories/${category.id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ name, slug, iconKey }),
    });
    await refresh();
  }

  async function removeCategory(category: AdminCategoryRecord) {
    if (!window.confirm(`Delete ${category.name}?`)) return;
    await api(`/admin/categories/${category.id}`, {
      method: 'DELETE',
      token,
    });
    await refresh();
  }

  return (
    <section className="admin-panel">
      <header className="admin-panel-head">
        <div>
          <p className="eyebrow">Catalog</p>
          <h2>Manage the public service menu</h2>
          <p>Keep categories clean so search, onboarding, and discovery stay sharp.</p>
        </div>
        <button className="primary-button" disabled={busy} onClick={() => runAction(createNewCategory, 'Category created')}>
          New category
        </button>
      </header>

      <div className="admin-record-list">
        {categories.map((category) => (
          <article className="admin-record-card" key={category.id}>
            <div className="admin-record-head">
              <div>
                <h4>{category.name}</h4>
                <p>{category.slug}</p>
              </div>
              <span className="booking-status">{category._count?.offerings || 0} offerings</span>
            </div>
            <dl className="admin-inline-list">
              <div>
                <dt>Icon key</dt>
                <dd>{category.iconKey}</dd>
              </div>
              <div>
                <dt>Linked services</dt>
                <dd>{category._count?.offerings || 0}</dd>
              </div>
            </dl>
            <div className="admin-action-row">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => runAction(() => editCategory(category), 'Category updated')}
              >
                Edit
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => runAction(() => removeCategory(category), 'Category deleted')}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChatPanel({
  token,
  currentUserId,
  conversations,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  currentUserId: string;
  conversations: Conversation[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'incoming'>('all');

  const incomingConversations = useMemo(
    () => conversations.filter((conversation) => {
      const latest = conversation.messages?.[0];
      return Boolean(latest && latest.senderId !== currentUserId);
    }),
    [conversations, currentUserId]
  );
  const visibleConversations = filter === 'incoming' ? incomingConversations : conversations;

  async function openConversation(conversationId: string) {
    const response = await api<{
      conversation: Conversation;
      messages: Message[];
    }>(`/conversations/${conversationId}/messages`, { token });
    setActiveConversation(response.conversation);
    setMessages(response.messages);
  }

  async function reply(formElement: HTMLFormElement) {
    if (!activeConversation) return;
    const form = new FormData(formElement);
    const body = String(form.get('body') || '').trim();
    const imageFile = form.get('image');
    const imagePayload =
      imageFile instanceof File && imageFile.size > 0
        ? await uploadChatImage(token, imageFile)
        : {};

    if (!body && !('imageUrl' in imagePayload)) {
      throw new Error('Write a message or attach an image.');
    }

    await api(`/conversations/${activeConversation.id}/messages`, {
      method: 'POST',
      token,
      body: JSON.stringify({ body, ...imagePayload }),
    });
    formElement.reset();
    await openConversation(activeConversation.id);
    await refresh();
  }

  function conversationTitle(conversation: Conversation) {
    return conversation.artisan?.displayName || conversation.customer?.email || 'Conversation';
  }

  function conversationInitial(conversation: Conversation) {
    return conversationTitle(conversation).slice(0, 1).toUpperCase();
  }

  function latestMessage(conversation: Conversation) {
    const latest = conversation.messages?.[0];
    return latest?.body || (latest?.imageUrl ? 'Photo attachment' : 'Booking conversation ready');
  }

  return (
    <article className="panel-card messages-panel">
      <div className="messages-head">
        <div>
          <p className="eyebrow">Messages</p>
          <h2>Inbox</h2>
          <p>Chat with customers or artisans from one clean workspace.</p>
        </div>
        <div className="message-tabs" role="tablist" aria-label="Message filters">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All messages</button>
          <button className={filter === 'incoming' ? 'active' : ''} onClick={() => setFilter('incoming')}>Incoming</button>
        </div>
      </div>

      <div className="messenger-shell">
        <aside className="conversation-rail">
          {visibleConversations.length === 0 && (
            <div className="conversation-empty">
              <strong>No {filter === 'incoming' ? 'incoming ' : ''}messages yet</strong>
              <span>Booking conversations appear here automatically when a job is opened.</span>
            </div>
          )}
          {visibleConversations.map((conversation) => {
            const latest = conversation.messages?.[0];
            const isIncoming = Boolean(latest && latest.senderId !== currentUserId);

            return (
              <button
                className={`conversation-row ${activeConversation?.id === conversation.id ? 'active' : ''}`}
                key={conversation.id}
                onClick={() => openConversation(conversation.id)}
              >
                <span className="conversation-avatar">{conversationInitial(conversation)}</span>
                <span className="conversation-copy">
                  <strong>{conversationTitle(conversation)}</strong>
                  <small>{latestMessage(conversation)}</small>
                </span>
                {isIncoming && <em>New</em>}
              </button>
            );
          })}
        </aside>

        <section className="chatbox">
          {!activeConversation && (
            <div className="chat-empty">
              <span className="conversation-avatar large">B</span>
              <h3>Select a conversation</h3>
              <p>Choose a thread from the left to read messages and send replies.</p>
            </div>
          )}

          {activeConversation && (
            <>
              <header className="chatbox-head">
                <span className="conversation-avatar">{conversationInitial(activeConversation)}</span>
                <div>
                  <h3>{conversationTitle(activeConversation)}</h3>
                  <p>{activeConversation.artisan?.city || activeConversation.customer?.email || 'Bundo conversation'}</p>
                </div>
              </header>

              <div className="chat-message-list">
                <div className="chat-date-divider"><span>Today</span></div>
                {messages.map((message) => {
                  const mine = message.senderId === currentUserId;

                  return (
                    <div className={`chat-message-row ${mine ? 'mine' : 'theirs'}`} key={message.id}>
                      {!mine && <span className="conversation-avatar">{conversationInitial(activeConversation)}</span>}
                      <div className="chat-message">
                        {message.imageUrl && (
                          <img className="chat-image" src={message.imageUrl} alt="Chat attachment" />
                        )}
                        {message.body && <p>{message.body}</p>}
                        <small>{formatMessageTime(message.createdAt)}{mine ? ' Sent' : ''}</small>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                className="chat-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  runAction(() => reply(form), 'Reply sent');
                }}
              >
                <label className="chat-attach-button">
                  Photo
                  <input name="image" type="file" accept="image/*" disabled={busy} />
                </label>
                <input name="body" placeholder="Write a message" />
                <button disabled={busy}>Send</button>
              </form>
            </>
          )}
        </section>
      </div>
    </article>
  );
}

function AdminChatPanel({
  token,
  conversations,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  conversations: Conversation[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  async function openConversation(conversationId: string) {
    const response = await api<{ conversation: Conversation }>(`/admin/conversations/${conversationId}`, { token });
    setActiveConversation(response.conversation);
  }

  async function createNote(formElement: HTMLFormElement) {
    if (!activeConversation) return;
    const form = new FormData(formElement);
    const body = String(form.get('body') || '');

    await api(`/admin/conversations/${activeConversation.id}/notes`, {
      method: 'POST',
      token,
      body: JSON.stringify({ body }),
    });
    formElement.reset();
    await openConversation(activeConversation.id);
    await refresh();
  }

  async function sendAdminReply(formElement: HTMLFormElement) {
    if (!activeConversation) return;
    const form = new FormData(formElement);
    const body = String(form.get('body') || '').trim();
    const imageFile = form.get('image');
    const imagePayload =
      imageFile instanceof File && imageFile.size > 0
        ? await uploadChatImage(token, imageFile)
        : {};

    if (!body && !('imageUrl' in imagePayload)) {
      throw new Error('Write a message or attach an image.');
    }

    await api(`/admin/conversations/${activeConversation.id}/messages`, {
      method: 'POST',
      token,
      body: JSON.stringify({ body, ...imagePayload }),
    });
    formElement.reset();
    await openConversation(activeConversation.id);
    await refresh();
  }

  return (
    <section className="admin-chat">
      <section className="section-head compact">
        <p className="eyebrow">Support</p>
        <h2>Conversation access</h2>
        <p>Admins can inspect customer/artisan chats, reply as Bundo support, and leave private operational notes.</p>
      </section>
      <div className="dashboard-grid">
        <article className="panel-card">
          <h2>All conversations</h2>
          {conversations.length === 0 && <p>No conversations yet.</p>}
          {conversations.map((conversation) => (
            <button className="list-button" key={conversation.id} onClick={() => openConversation(conversation.id)}>
              <strong>{conversation.artisan?.displayName || 'Artisan'}</strong>
              <span>{conversation.customer?.email || conversation.customerId}</span>
            </button>
          ))}
        </article>

        <article className="panel-card wide-panel">
          <h2>Thread and notes</h2>
          {!activeConversation && <p>Select a conversation to review messages and notes.</p>}
          {activeConversation && (
            <>
              <div className="message-list">
                {activeConversation.messages?.map((message) => (
                  <div className="message-bubble" key={message.id}>
                    <strong>{message.sender?.email || message.sender?.role || 'User'}</strong>
                    {message.imageUrl && (
                      <img className="chat-image" src={message.imageUrl} alt="Chat attachment" />
                    )}
                    {message.body && <p>{message.body}</p>}
                  </div>
                ))}
              </div>

              <form
                className="reply-form admin-reply-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  runAction(() => sendAdminReply(form), 'Admin reply sent');
                }}
              >
                <label className="chat-attach-button">
                  Photo
                  <input name="image" type="file" accept="image/*" disabled={busy} />
                </label>
                <input name="body" placeholder="Reply in this customer-artisan chat as Bundo support" />
                <button disabled={busy}>Send reply</button>
              </form>

              <h3>Admin notes</h3>
              {(activeConversation.adminNotes || []).length === 0 && <p>No notes yet.</p>}
              {activeConversation.adminNotes?.map((note) => (
                <div className="note-row" key={note.id}>
                  <strong>{note.admin?.email || 'Admin'}</strong>
                  <p>{note.body}</p>
                </div>
              ))}

              <form
                className="reply-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  runAction(() => createNote(form), 'Admin note saved');
                }}
              >
                <input name="body" placeholder="Add an internal note" required />
                <button disabled={busy}>Save note</button>
              </form>
            </>
          )}
        </article>
      </div>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <article className="empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

export default App;
