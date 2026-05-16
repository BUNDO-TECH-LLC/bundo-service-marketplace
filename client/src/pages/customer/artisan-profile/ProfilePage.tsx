import { FormEvent, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useNavigate, useParams } from 'react-router-dom';
import bundoLogo from '../../../assets/BundoLogo.png';
import { CustomerHeader } from '../../../components/customer/CustomerHeader';
import { AppIcon } from '../../../components/ui/AppIcon';
import { browseLocationAreaOptions } from '../../../constants/data';
import { ArtisanProfilePage } from '../../../views/ArtisanProfilePage';
import { api } from '../../../lib/api';
import { auth } from '../../../lib/firebase';
import { resolveApiSession } from '../../../lib/authSession';
import type { BookingSuccessState } from '../../../appTypes';
import type { ApiUser, Artisan, Review } from '../../../types';
import {
  appRoutes,
  buildCategoriesPath,
  buildCustomerWorkspacePath,
} from '../../../routes/paths';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { artisanId = '' } = useParams();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [me, setMe] = useState<ApiUser | null>(null);
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [headerSearch, setHeaderSearch] = useState('');
  const [headerState, setHeaderState] = useState('');

  useEffect(() => {
    if (!auth) {
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setToken('');
        setMe(null);
        return;
      }

      try {
        const session = await resolveApiSession(user);
        setToken(session.token);
        setMe(session.user);
      } catch {
        setToken('');
        setMe(null);
      }
    });
  }, []);

  useEffect(() => {
    if (!artisanId) {
      navigate(appRoutes.categories, { replace: true });
      return;
    }

    setBusy(true);
    setNotice('');

    Promise.all([
      api<{ artisan: Artisan }>(`/artisans/${artisanId}`),
      api<{ reviews: Review[] }>(`/artisans/${artisanId}/reviews`),
    ])
      .then(([artisanResponse, reviewResponse]) => {
        setArtisan(artisanResponse.artisan);
        setReviews(reviewResponse.reviews);
      })
      .catch(() => {
        setNotice('Could not load this artisan profile right now.');
      })
      .finally(() => {
        setBusy(false);
      });
  }, [artisanId, navigate]);

  async function reloadPrivate() {
    return Promise.resolve();
  }

  async function runAction(action: () => Promise<void>, done = 'Done') {
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
  }

  function handleBookingSuccess(_booking: BookingSuccessState) {
    // Booking confirmed overlay is shown globally via BookingConfirmedProvider.
  }

  function submitHeaderSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(
      buildCategoriesPath({
        q: headerSearch.trim() || undefined,
        state: headerState || undefined,
      })
    );
  }

  function openWorkspace(section: 'bookings' | 'messages') {
    navigate(buildCustomerWorkspacePath(section));
  }

  async function logout() {
    if (auth) {
      await signOut(auth);
    }
    navigate(appRoutes.home, { replace: true });
  }

  const showCustomerChrome = me?.role === 'CUSTOMER' && Boolean(firebaseUser);
  const greetingName = firebaseUser?.email?.split('@')[0] || me?.email?.split('@')[0];

  if (!artisan) {
    return (
      <div className="min-h-full bg-[var(--color-paper)]">
        {showCustomerChrome ? (
          <CustomerHeader
            firebaseUser={firebaseUser}
            me={me}
            activeNav="categories"
            searchContent={
              <form
                className="grid w-[min(100%,402px)] justify-self-end grid-cols-[minmax(170px,1fr)_minmax(150px,0.92fr)] items-center rounded-lg border border-[var(--color-input-border)] bg-[var(--color-paper)] max-[1180px]:w-full max-[1180px]:justify-self-stretch max-[720px]:grid-cols-1"
                onSubmit={submitHeaderSearch}
              >
                <label className="flex min-w-0 items-center gap-2.5 px-3 py-2.5 first:border-r first:border-[var(--color-line)] max-[720px]:first:border-r-0 max-[720px]:first:border-b">
                  <AppIcon icon="mingcute:search-line" className="text-2xl leading-none text-[var(--color-ink)]" size={24} />
                  <input
                    className="min-w-0 border-0 bg-transparent p-0 font-medium text-[var(--color-ink)] outline-none"
                    value={headerSearch}
                    onChange={(e) => setHeaderSearch(e.target.value)}
                    placeholder="Search for artisan"
                    type="search"
                    aria-label="Search for artisan"
                  />
                </label>
                <div className="flex min-w-0 items-center px-3 py-2.5">
                  <select
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-[var(--color-ink)] outline-none"
                    value={headerState}
                    onChange={(e) => setHeaderState(e.target.value)}
                    aria-label="Location"
                  >
                    {browseLocationAreaOptions.map((opt) => (
                      <option key={opt.value || 'all'} value={opt.value}>
                        {opt.label === 'All areas' ? 'Lagos, Nigeria' : opt.label}
                      </option>
                    ))}
                  </select>
                  <AppIcon icon="mdi:chevron-down" size={18} />
                </div>
              </form>
            }
            onOpenDashboard={() => navigate(appRoutes.customerDashboard)}
            onOpenMarketplace={() => navigate(buildCategoriesPath({}))}
            onOpenNotifications={() => navigate(buildCustomerWorkspacePath('notifications'))}
            onOpenWorkspace={openWorkspace}
            onUserUpdated={setMe}
            onLogout={logout}
          />
        ) : (
          <header className="app-screen-gutter border-b border-[var(--color-line)] bg-[var(--color-paper)] py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                className="inline-flex items-center gap-3 bg-transparent text-[var(--color-ink)]"
                type="button"
                onClick={() => navigate(appRoutes.home)}
              >
                <img className="h-12 w-12 rounded-xl object-cover" src={bundoLogo} alt="Bundo logo" />
                <span className="text-3xl font-black">Bundo</span>
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <button className="secondary-button" type="button" onClick={() => navigate(appRoutes.categories)}>
                  Categories
                </button>
                <button className="secondary-button" type="button" onClick={() => navigate(appRoutes.help)}>
                  Help
                </button>
                <button className="primary-button" type="button" onClick={() => navigate(appRoutes.login)}>
                  {greetingName ? `Open ${greetingName}` : 'Log in'}
                </button>
              </div>
            </div>
          </header>
        )}
        <main className="app-screen-gutter py-10">
          {notice ? <div className="notice mb-4">{notice}</div> : null}
          <button className="secondary-button" type="button" onClick={() => navigate(appRoutes.categories)}>
            Back to categories
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="artisan-profile-route min-h-full bg-[var(--color-paper)]">
      {showCustomerChrome ? (
        <CustomerHeader
          firebaseUser={firebaseUser}
          me={me}
          activeNav="dashboard"
          searchContent={
            <form
              className="grid w-[min(100%,402px)] justify-self-end grid-cols-[minmax(170px,1fr)_minmax(150px,0.92fr)] items-center rounded-lg border border-[var(--color-input-border)] bg-[var(--color-paper)] max-[1180px]:w-full max-[1180px]:justify-self-stretch max-[720px]:grid-cols-1"
              onSubmit={submitHeaderSearch}
            >
              <label className="flex min-w-0 items-center gap-2.5 px-3 py-2.5 first:border-r first:border-[var(--color-line)] max-[720px]:first:border-r-0 max-[720px]:first:border-b">
                <AppIcon icon="mingcute:search-line" className="text-2xl leading-none text-[var(--color-ink)]" size={24} />
                <input
                  className="min-w-0 border-0 bg-transparent p-0 font-medium text-[var(--color-ink)] outline-none"
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                  placeholder="Search for artisan"
                  type="search"
                  aria-label="Search for artisan"
                />
              </label>
              <div className="flex min-w-0 items-center px-3 py-2.5">
                <select
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-[var(--color-ink)] outline-none"
                  value={headerState}
                  onChange={(e) => setHeaderState(e.target.value)}
                  aria-label="Location"
                >
                  {browseLocationAreaOptions.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>
                      {opt.label === 'All areas' ? 'Lagos, Nigeria' : opt.label}
                    </option>
                  ))}
                </select>
                <AppIcon icon="mdi:chevron-down" size={18} />
              </div>
            </form>
          }
          onOpenDashboard={() => navigate(appRoutes.customerDashboard)}
          onOpenMarketplace={() => navigate(buildCategoriesPath({}))}
          onOpenNotifications={() => navigate(buildCustomerWorkspacePath('notifications'))}
          onOpenWorkspace={openWorkspace}
          onUserUpdated={setMe}
          onLogout={logout}
        />
      ) : (
        <header className="app-screen-gutter border-b border-[var(--color-line)] bg-[var(--color-paper)] py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              className="inline-flex items-center gap-3 bg-transparent text-[var(--color-ink)]"
              type="button"
              onClick={() => navigate(appRoutes.home)}
            >
              <img className="h-12 w-12 rounded-xl object-cover" src={bundoLogo} alt="Bundo logo" />
              <span className="text-3xl font-black">Bundo</span>
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <button className="secondary-button" type="button" onClick={() => navigate(appRoutes.categories)}>
                Categories
              </button>
              <button className="secondary-button" type="button" onClick={() => navigate(appRoutes.help)}>
                Help
              </button>
              <button className="primary-button" type="button" onClick={() => navigate(appRoutes.login)}>
                Log in
              </button>
            </div>
          </div>
        </header>
      )}

      {notice ? <div className="notice app-screen-notice mx-auto my-4 max-w-[var(--app-screen-max)] px-[var(--app-screen-gutter)]">{notice}</div> : null}

      <ArtisanProfilePage
        artisan={artisan}
        reviews={reviews}
        isAuthed={Boolean(firebaseUser && token)}
        role={me?.role || null}
        token={token}
        busy={busy}
        runAction={runAction}
        onBack={() => navigate(appRoutes.categories)}
        reloadPrivate={reloadPrivate}
        onBookingSuccess={handleBookingSuccess}
      />
    </div>
  );
}
