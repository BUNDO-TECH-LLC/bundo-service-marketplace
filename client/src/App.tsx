import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import { AdminConsole } from './admin/AdminConsole';
import type {
  ActionRunner,
  AdminArtisanRecord,
  AdminCategoryRecord,
  AdminSection,
  AdminUserRecord,
  BookingSuccessState,
  MarketplaceSort,
  PushStatus,
  SignupRole,
  View,
  WorkspaceSection,
} from './appTypes';
import { AuthBox } from './auth/AuthBox';
import { EmptyState } from './components/EmptyState';
import { StatCard } from './components/StatCard';
import { HelpCenter } from './help/HelpCenter';
import { api, ApiError } from './lib/api';
import { needsEmailVerification } from './lib/authSignupStorage';
import { bookingDate, paymentLabel, statusLabel } from './lib/bookingDisplay';
import { categoryIcon } from './lib/categoryIcon';
import { auth, firebaseReady } from './lib/firebase';
import { dayLabels, formatMessageTime, money } from './lib/formatting';
import { nigeriaStates } from './lib/geo';
import { heroImage, phoneImage } from './lib/marketingAssets';
import {
  enableBrowserPush,
  ensureBrowserPushToken,
  hasPushConfig,
  subscribeToForegroundMessages,
} from './lib/messaging';
import { resolveApiSession } from './lib/resolveApiSession';
import { userDisplayName } from './lib/userDisplayName';
import { readStoredRoute, routeStorageKey } from './lib/workspaceRoute';
import { resetWorkspaceState } from './lib/workspaceState';
import { BookingsPage } from './panels/BookingsPanel';
import { ChatPanel } from './panels/ChatPanel';
import { NotificationsPanel } from './panels/NotificationsPanel';
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
import { ArtisanDashboard } from './views/ArtisanDashboard';
import { ArtisanProfilePage } from './views/ArtisanProfilePage';
import { LoggedInHome } from './views/LoggedInHome';
import bundoLogo from './assets/bundo-logo.png';

function clearUrlSearch() {
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState({}, '', url.toString());
}

function clearStoredRoute() {
  window.localStorage.removeItem(routeStorageKey);
}

function App() {
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

        if (!session.user.role) {
          setRouteHydrated(true);
          setView('home');
          setWorkspaceSection('overview');
          setNotice('Choose client or artisan to finish setting up your Bundo account before booking.');
          clearUrlSearch();
          return;
        }

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
                setAuthPromptSignal((value) => value + 1);
                setNotice('Create or sign in to an artisan account to start professional onboarding.');
                setView('home');
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

      {notice && <div className={`notice ${usesArtisanSetupHeader ? 'setup-notice' : ''}`}>{notice}</div>}
      {bookingSuccess && (
        <BookingSuccessDialog
          booking={bookingSuccess}
          onClose={() => setBookingSuccess(null)}
          onGoToMessages={() => {
            setBookingSuccess(null);
            setWorkspaceSection('messages');
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
                openBookings={() => setWorkspaceSection('bookings')}
              />
            )
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
  onGoToMessages,
}: {
  booking: BookingSuccessState;
  onClose: () => void;
  onGoToMessages: () => void;
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
          We created a booking for {booking.serviceTitle}. You can message the artisan now,
          or continue browsing while the request stays active.
        </p>
        {booking.bookingId && <small>Booking #{booking.bookingId.slice(0, 8)}</small>}
        <div className="booking-success-actions">
          <button type="button" onClick={onGoToMessages}>Go to messages</button>
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
  bookings: Booking[];
  mode: 'customer' | 'artisan';
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

    if (response.authorizationUrl) {
      window.location.href = response.authorizationUrl;
      return;
    }

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



export default App;
