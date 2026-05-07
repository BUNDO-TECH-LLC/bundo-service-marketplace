import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { api, ApiError } from '../lib/api';
import { resolveApiSession } from '../lib/authSession';
import { auth, firebaseReady } from '../lib/firebase';
import {
  enableBrowserPush,
  ensureBrowserPushToken,
  hasPushConfig,
  subscribeToForegroundMessages,
} from '../lib/messaging';
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
} from '../types';
import bundoLogo from '../assets/BundoLogo.png';

type View = 'home' | 'marketplace' | 'workspace' | 'admin' | 'help' | 'artisan-profile';
type WorkspaceSection = 'overview' | 'bookings' | 'messages' | 'offers' | 'notifications';
type ActionRunner = (action: () => Promise<void>, done?: string) => Promise<void>;
type PushStatus = 'idle' | 'unsupported' | 'missing-config' | 'unavailable' | 'enabled' | 'denied';
type MarketplaceSort = 'newest' | 'rating' | 'price_low' | 'price_high';

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

function resetWorkspaceState() {
  return {
    view: 'home' as View,
    workspaceSection: 'overview' as WorkspaceSection,
  };
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

function LandingPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('home');
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>('overview');
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
  const [selectedState, setSelectedState] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [marketplaceSort, setMarketplaceSort] = useState<MarketplaceSort>('rating');
  const [authPromptSignal, setAuthPromptSignal] = useState(0);
  const [notice, setNotice] = useState('');
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
        api<{ bookings: Booking[] }>('/bookings/artisan?page=1&limit=10', { token: authToken }),
        api<{ offerings: Offering[] }>('/offerings/me', { token: authToken }),
        api<{ conversations: Conversation[] }>('/conversations', { token: authToken }),
        api<{ notifications: Notification[] }>('/notifications', { token: authToken }),
      ]);
      setBookings(bookingRes.bookings);
      setMyOfferings(offeringRes.offerings);
      setConversations(conversationRes.conversations);
      setNotifications(notificationRes.notifications);
    }

    if (user.role === 'ADMIN') {
      const [stats, conversationRes, bookingRes, notificationRes, kycRes] = await Promise.all([
        api<{ stats: Record<string, number> }>('/admin/stats', { token: authToken }),
        api<{ conversations: Conversation[] }>('/admin/conversations?page=1&limit=20', { token: authToken }),
        api<{ bookings: Booking[] }>('/admin/bookings?page=1&limit=12', { token: authToken }),
        api<{ notifications: Notification[] }>('/notifications', { token: authToken }),
        api<{ submissions: ArtisanKycSubmission[] }>('/admin/kyc-submissions?page=1&limit=12', { token: authToken }),
      ]);
      setAdminStats(stats.stats);
      setAdminConversations(conversationRes.conversations);
      setAdminBookings(bookingRes.bookings);
      setNotifications(notificationRes.notifications);
      setAdminKycSubmissions(kycRes.submissions);
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
        setNotifications([]);
        setMyOfferings([]);
        setAdminStats(null);
        setPushToken('');
        setPushStatus(hasPushConfig() ? 'idle' : 'missing-config');
        setWorkspaceSection(resetState.workspaceSection);
        setView(resetState.view);
        setActiveHelpTopicId(null);
        setSelectedArtisan(null);
        setSelectedArtisanReviews([]);
        clearUrlSearch();
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

        if (
          requestedView &&
          ['home', 'marketplace', 'workspace', 'admin', 'help'].includes(
            requestedView
          )
        ) {
          setView(requestedView as View);
          if (
            requestedSection &&
            ['overview', 'bookings', 'messages', 'offers', 'notifications'].includes(
              requestedSection
            )
          ) {
            setWorkspaceSection(requestedSection as WorkspaceSection);
          }
          clearUrlSearch();
        }
      } catch {
        const resetState = resetWorkspaceState();
        setToken('');
        setMe(null);
        setBookings([]);
        setConversations([]);
        setAdminConversations([]);
        setAdminBookings([]);
        setAdminKycSubmissions([]);
        setNotifications([]);
        setMyOfferings([]);
        setAdminStats(null);
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('home')}>
          <img className="brand-logo" src={bundoLogo} alt="Bundo logo" />
          <span>Bundo</span>
        </button>
        <nav aria-label="Main navigation">
          {isAuthed && (
            <>
              <button className={view === 'marketplace' ? 'active' : ''} onClick={() => setView('marketplace')}>Services</button>
              <button
                className={view === 'workspace' ? 'active' : ''}
                onClick={() => {
                  setWorkspaceSection('overview');
                  setView('workspace');
                }}
              >
                Dashboard
              </button>
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
          <button
            className="professional-link"
            onClick={() => {
              if (!me) {
                navigate('/create-account?role=artisan');
                return;
              }

              if (me.role === 'ADMIN') {
                setNotice('Admin accounts already have marketplace control access.');
                setView('admin');
                return;
              }

              if (me.role === 'ARTISAN') {
                setWorkspaceSection('offers');
                setView('workspace');
                setNotice('Welcome back to your artisan workspace.');
                return;
              }

              withNotice(async () => {
                await api('/users/role', {
                  method: 'PATCH',
                  token,
                  body: JSON.stringify({ role: 'ARTISAN' }),
                });
                const nextUser = await refreshMe();
                await loadPrivateData(token, nextUser || me);
                setWorkspaceSection('overview');
                setView('workspace');
              }, 'Your account is now set up for artisan onboarding');
            }}
          >
            Register as a professional
          </button>
        </nav>
        <AuthBox
          firebaseUser={firebaseUser}
          me={me}
          authPromptSignal={authPromptSignal}
          unreadCount={notifications.filter((notification) => !notification.readAt).length}
          onReady={(nextToken, nextUser) => {
            setToken(nextToken);
            setMe(nextUser);
            loadPrivateData(nextToken, nextUser).catch(() => undefined);
            if (nextUser.role === 'CUSTOMER') {
              setView('home');
            }
          }}
          onNavigate={setView}
          onWorkspaceSection={setWorkspaceSection}
          onNotice={setNotice}
        />
      </header>

      {notice && <div className="notice">{notice}</div>}

      {view === 'home' && (
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

      {view === 'workspace' && (
        <main className={`page workspace-page ${workspaceSection === 'messages' ? 'messages-workspace' : ''}`}>
          {workspaceSection !== 'messages' && (
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
                      : 'Sign in to test roles, artisan setup, bookings, and chat from the web client.'}
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
              <ArtisanPanel
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
            <EmptyState title="Artisan tools" body="Choose the artisan role first to manage offers." />
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

          {me && workspaceSection === 'overview' && (
            <div className="dashboard-grid">
              <RolePanel
                token={token}
                me={me}
                busy={busy}
                runAction={withNotice}
                refresh={async () => {
                  const user = await refreshMe();
                  await loadPrivateData(token, user || me);
                }}
              />
              {me.role === 'ARTISAN' && (
                <ArtisanPanel
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
              )}
              <BookingsSummary bookings={bookings} title={me.role === 'ARTISAN' ? 'Booking requests' : 'My bookings'} />
            </div>
          )}
        </main>
      )}

      {view === 'admin' && (
        <main className="page">
          <section className="section-head">
            <p className="eyebrow">Admin</p>
            <h1>Marketplace control center</h1>
            <p>Track growth, moderation, trust signals, and operations health.</p>
          </section>
          <div className="grid stats">
            {!adminStats && <EmptyState title="Admin stats unavailable" body="Sign in as an admin, then open this page again." />}
            {adminStats &&
              Object.entries(adminStats).map(([key, value]) => (
                <article className="stat-card" key={key}>
                  <strong>{value}</strong>
                  <span>{key}</span>
                </article>
              ))}
          </div>
          <AdminChatPanel
            token={token}
            conversations={adminConversations}
            busy={busy}
            runAction={withNotice}
            refresh={() => loadPrivateData()}
          />
          <AdminBookingsPanel
            token={token}
            bookings={adminBookings}
            busy={busy}
            runAction={withNotice}
            refresh={() => loadPrivateData()}
          />
          <AdminKycPanel
            token={token}
            submissions={adminKycSubmissions}
            busy={busy}
            runAction={withNotice}
            refresh={() => loadPrivateData()}
          />
        </main>
      )}
    </div>
  );
}

function AuthBox({
  firebaseUser,
  me,
  authPromptSignal,
  unreadCount,
  onReady,
  onNavigate,
  onWorkspaceSection,
  onNotice,
}: {
  firebaseUser: User | null;
  me: ApiUser | null;
  authPromptSignal: number;
  unreadCount: number;
  onReady: (token: string, user: ApiUser) => void;
  onNavigate: (view: View) => void;
  onWorkspaceSection: (section: WorkspaceSection) => void;
  onNotice: (message: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preferredRole, setPreferredRole] = useState<Role | null>(null);

  useEffect(() => {
    if (!authPromptSignal) return;
    setPreferredRole('ARTISAN');
    setMode('signup');
    setDrawerOpen(true);
  }, [authPromptSignal]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;
    setSubmitting(true);
    onNotice('');
    try {
      const credential =
        mode === 'login'
          ? await signInWithEmailAndPassword(auth, email, password)
          : await createUserWithEmailAndPassword(auth, email, password);
      let session = await resolveApiSession(credential.user);

      if (
        preferredRole === 'ARTISAN' &&
        session.user.role !== 'ARTISAN' &&
        session.user.role !== 'ADMIN'
      ) {
        await api('/users/role', {
          method: 'PATCH',
          token: session.token,
          body: JSON.stringify({ role: 'ARTISAN' }),
        });
        const refreshed = await api<{ user: ApiUser }>('/me', { token: session.token });
        session = {
          token: session.token,
          user: refreshed.user,
        };
      }

      onReady(session.token, session.user);
      if (preferredRole === 'ARTISAN') {
        onWorkspaceSection('overview');
        onNavigate('workspace');
        onNotice(
          session.user.role === 'ARTISAN'
            ? 'Your artisan onboarding is ready. Complete your profile, KYC, and offerings for admin review.'
            : mode === 'login'
              ? 'Signed in'
              : 'Account created'
        );
      } else {
        onNotice(mode === 'login' ? 'Signed in' : 'Account created');
      }
      setDrawerOpen(false);
      setPassword('');
      setPreferredRole(null);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setSubmitting(false);
    }
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
                <button onClick={() => goToWorkspace('offers')}>Manage offers</button>
                <button onClick={() => goToWorkspace('bookings')}>Booking requests</button>
                <button onClick={() => goToWorkspace('messages')}>Messages</button>
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
      <Link to="/login">
        Login
      </Link>
      <Link className="signup-link" to="/create-account">
        Sign up
      </Link>

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
            <p className="eyebrow">{preferredRole === 'ARTISAN' ? 'Join as a professional' : 'Welcome to Bundo'}</p>
            <h2>
              {preferredRole === 'ARTISAN'
                ? mode === 'login'
                  ? 'Login as a professional'
                  : 'Create your artisan account'
                : mode === 'login'
                  ? 'Login to your account'
                  : 'Create your account'}
            </h2>
            <p className="drawer-copy">
              {preferredRole === 'ARTISAN'
                ? 'Sign up or log in, then we will place you on the artisan path so you can complete profile setup, KYC, offerings, and admin verification.'
                : 'Continue as a customer, artisan, or admin and pick up your marketplace workflow.'}
            </p>

            <form className="auth-form" onSubmit={submit}>
              <label>
                Email
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" required />
              </label>
              <label>
                Password
                <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" type="password" required />
              </label>
              <button disabled={!firebaseReady || submitting}>
                {preferredRole === 'ARTISAN'
                  ? mode === 'login'
                    ? 'Continue as professional'
                    : 'Create artisan account'
                  : mode === 'login'
                    ? 'Login'
                    : 'Create account'}
              </button>
            </form>

            <button type="button" className="mode-switch" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? 'New here? Sign up' : 'Already have an account? Login'}
            </button>
          </aside>
        </div>
      )}
    </div>
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
}: {
  offerings: Offering[];
  isAuthed: boolean;
  role: Role | null;
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  reloadPrivate: () => Promise<void>;
  onViewProfile: (artisanId: string) => Promise<void>;
}) {
  return (
    <div className="grid two">
      {offerings.length === 0 && <EmptyState title="No services yet" body="Approved artisan offerings will appear here." />}
      {offerings.map((offering) => (
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
              disabled={!offering.artisan?.id || busy}
              onClick={() => offering.artisan?.id && onViewProfile(offering.artisan.id)}
            >
              View profile
            </button>
            <button
              disabled={!isAuthed || role !== 'CUSTOMER' || busy}
              onClick={() =>
                runAction(async () => {
                  await api('/bookings', {
                    method: 'POST',
                    token,
                    body: JSON.stringify({
                      offeringId: offering.id,
                      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
                      note: 'Booked from web client',
                    }),
                  });
                  await reloadPrivate();
                }, 'Booking requested')
              }
            >
              Book
            </button>
            <button
              className="secondary-button"
              disabled={!isAuthed || busy || !offering.artisan?.id}
              onClick={() =>
                runAction(async () => {
                  await api('/messages', {
                    method: 'POST',
                    token,
                    body: JSON.stringify({
                      artisanId: offering.artisan!.id,
                      body: 'Hello, I am interested in this service.',
                    }),
                  });
                  await reloadPrivate();
                }, 'Message sent')
              }
            >
              Message
            </button>
          </div>
        </article>
      ))}
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

    await api('/bookings', {
      method: 'POST',
      token,
      body: JSON.stringify({
        offeringId: selectedOffering.id,
        scheduledAt: new Date(`${date}T${timeSlot}:00`).toISOString(),
        note: `Booked from ${artisan.displayName} profile`,
      }),
    });
    await reloadPrivate();
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
          ['How do I create an account?', 'Use Login or Sign up in the top navigation. After signing in, choose whether you want to continue as a customer or artisan from your dashboard.'],
          ['Can one account become an artisan?', 'Yes. Choose the artisan role, create a public artisan profile, then add offerings customers can book.'],
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
          ['How do I become an artisan?', 'Sign in, choose the artisan role, then create your artisan profile with display name, bio, state or city, area, latitude, and longitude.'],
          ['When will customers see my profile?', 'Your profile becomes publicly discoverable after admin approval. This helps keep the marketplace trustworthy.'],
        ],
      },
      {
        heading: 'Offerings',
        questions: [
          ['How do I list a service?', 'From the artisan dashboard, choose a category, add the service title, description, and price range, then create the offering.'],
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

function RolePanel({
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
  return (
    <article className="panel-card">
      <p className="eyebrow">Identity</p>
      <h2>Role</h2>
      <p>Current role: <strong>{me.role || 'Not selected'}</strong></p>
      <div className="actions">
        {(['CUSTOMER', 'ARTISAN'] as Role[]).map((role) => (
          <button
            key={role}
            disabled={busy}
            onClick={() =>
              runAction(async () => {
                await api('/users/role', {
                  method: 'PATCH',
                  token,
                  body: JSON.stringify({ role }),
                });
                await refresh();
              }, `Role changed to ${role.toLowerCase()}`)
            }
          >
            Use as {role.toLowerCase()}
          </button>
        ))}
      </div>
    </article>
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

  return (
    <section className="bookings-page">
      <div className="bookings-toolbar">
        <div>
          <p className="eyebrow">Booking details</p>
          <h2>{mode === 'artisan' ? 'Booking requests' : 'My bookings'}</h2>
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
          body={mode === 'artisan' ? 'Customer booking requests will appear here.' : 'Your service bookings will appear here after you request a service.'}
        />
      )}

      <div className="booking-list">
        {visibleBookings.map((booking) => {
          const contactName =
            mode === 'artisan'
              ? booking.customerUser?.email?.split('@')[0] || 'Customer'
              : booking.artisan?.displayName || booking.offering?.artisan?.displayName || 'Bundo professional';
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
                {mode === 'customer' && paymentStatus === 'PAID_HELD' && (
                  <button className="secondary-button" disabled>
                    Payment secured
                  </button>
                )}
                {mode === 'customer' && paymentStatus === 'RELEASED' && (
                  <button className="secondary-button" disabled>
                    Payment released
                  </button>
                )}
                {mode === 'customer' && ['REQUESTED', 'ACCEPTED'].includes(booking.status) && (
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
                {mode === 'customer' && booking.status === 'COMPLETED' && (
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
                {mode === 'artisan' && booking.status === 'REQUESTED' && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => runAction(() => updateBookingStatus(booking.id, 'ACCEPTED'), 'Booking accepted')}
                    >
                      Accept
                    </button>
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => runAction(() => updateBookingStatus(booking.id, 'DECLINED'), 'Booking declined')}
                    >
                      Decline
                    </button>
                  </>
                )}
                {mode === 'artisan' && booking.status === 'ACCEPTED' && (
                  <button
                    disabled={busy}
                    onClick={() => runAction(() => updateBookingStatus(booking.id, 'COMPLETED'), 'Booking completed')}
                  >
                    Mark completed
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
  busy,
  runAction,
  refresh,
}: {
  token: string;
  submissions: ArtisanKycSubmission[];
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
    () => conversations.filter((conversation) => conversation.messages?.[0]?.senderId !== currentUserId),
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
    const body = String(form.get('body') || '');

    await api(`/conversations/${activeConversation.id}/messages`, {
      method: 'POST',
      token,
      body: JSON.stringify({ body }),
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
    return conversation.messages?.[0]?.body || 'Open chat';
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
              <span>Conversations will appear here when a message is started.</span>
            </div>
          )}
          {visibleConversations.map((conversation) => {
            const latest = conversation.messages?.[0];
            const isIncoming = latest?.senderId !== currentUserId;

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
                        <p>{message.body}</p>
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
                <input name="body" placeholder="Write a message" required />
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

  return (
    <section className="admin-chat">
      <section className="section-head compact">
        <p className="eyebrow">Support</p>
        <h2>Conversation access</h2>
        <p>Admins can inspect customer/artisan chats and leave private operational notes.</p>
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
                    <p>{message.body}</p>
                  </div>
                ))}
              </div>

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

export default LandingPage;
