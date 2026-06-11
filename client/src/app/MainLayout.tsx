import { useEffect, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { Outlet } from 'react-router-dom';
import type { AuthDrawerPrompt } from '../lib/authDrawerPrompt';
import { parseAuthDrawerPrompt, stripAuthDrawerParams } from '../lib/authDrawerPrompt';
import { AuthBox } from '../auth/AuthBox';
import { BundoLoadingScreen } from '../components/BundoLoadingScreen';
import { buildAppPath } from '../lib/appPaths';
import { needsPublicMarketplaceData } from '../lib/appRouting';
import { locationErrorMessage } from '../lib/geolocation';
import { nextHelpOpenState } from '../lib/helpNavigation';
import { nigeriaStates } from '../lib/geo';
import { userDisplayName } from '../lib/userDisplayName';
import bundoLogo from '../assets/BundoLogo.png';
import { auth } from '../lib/firebase';
import { PaymentSuccessDialog } from '../components/PaymentSuccessDialog';
import { ArtisanAppHeader } from '../features/artisan/ArtisanAppHeader';
import { BookingSuccessDialog } from '../features/booking/BookingSuccessDialog';
import { SignedInTopbarNav } from './SignedInTopbarNav';
import { ARTISAN_ONBOARDING_PATH, isArtisanApplicantSession } from '../lib/artisanApplication';
import { useAppRoot } from './appRootContext';

export function MainLayout() {
  const ctx = useAppRoot();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authDrawerPrompt, setAuthDrawerPrompt] = useState<AuthDrawerPrompt | null>(null);
  const consumedAuthPromptRef = useRef('');

  const closeMobileNav = () => setMobileNavOpen(false);

  useEffect(() => {
    closeMobileNav();
  }, [ctx.location.pathname, ctx.location.search]);

  useEffect(() => {
    if (!ctx.notice) return;

    const isLongerMessage = ctx.notice.length > 90;
    const timeoutId = window.setTimeout(() => {
      ctx.setNotice('');
    }, isLongerMessage ? 8000 : 5000);

    return () => window.clearTimeout(timeoutId);
  }, [ctx.notice, ctx.setNotice]);

  useEffect(() => {
    const parsed = parseAuthDrawerPrompt(ctx.location.search);
    if (!parsed) {
      consumedAuthPromptRef.current = '';
      return;
    }

    const promptKey = JSON.stringify(parsed);
    if (consumedAuthPromptRef.current === promptKey) {
      return;
    }

    consumedAuthPromptRef.current = promptKey;
    setAuthDrawerPrompt(parsed);

    const cleanedSearch = stripAuthDrawerParams(ctx.location.search);
    if (cleanedSearch !== ctx.location.search) {
      ctx.navigate({ pathname: ctx.location.pathname, search: cleanedSearch }, { replace: true });
    }
  }, [ctx.location.pathname, ctx.location.search, ctx.navigate]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileNav();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  const goTo = (navigate: () => void) => {
    closeMobileNav();
    navigate();
  };

  function handleUseMyLocation() {
    void ctx.useMyLocation().then((result) => {
      if (result.ok) {
        ctx.setSearchCoordinates(result.lat, result.lng);
        ctx.setMarketplaceSort('distance');
        ctx.setNotice(`Showing services near ${result.state}.`);
        if (needsPublicMarketplaceData(ctx.location.pathname)) {
          void ctx.loadPublicData(result.state, ctx.searchTerm, {
            sort: 'distance',
            lat: result.lat,
            lng: result.lng,
          });
        }
        return;
      }
      ctx.setNotice(locationErrorMessage(result.reason));
    });
  }

  if (ctx.isAppBootstrapping) {
    return <BundoLoadingScreen />;
  }

  return (
    <>
      {!ctx.hideGlobalHeader && (
        <header
          className={`topbar ${ctx.isAuthed ? 'signed-in-topbar' : ''} ${mobileNavOpen ? 'topbar--nav-open' : ''}`}
        >
          <button
            type="button"
            className="brand"
            onClick={() => goTo(() => ctx.navigate('/'))}
          >
            <img className="brand-logo" src={bundoLogo} alt="" />
            <span>Bundo</span>
          </button>

          <div className="topbar-collapse" id="topbar-mobile-panel">
            {ctx.isAuthed && ctx.me?.role ? (
              <SignedInTopbarNav
                role={ctx.me.role}
                view={ctx.view}
                workspaceSection={ctx.workspaceSection}
                notifications={ctx.notifications}
                onNavigate={(path) => goTo(() => ctx.navigate(path))}
              />
            ) : (
              <nav aria-label="Main navigation">
                <button
                  type="button"
                  className={ctx.view === 'help' ? 'active' : ''}
                  onClick={() => {
                    goTo(() => {
                      ctx.navigate('/help', { state: nextHelpOpenState(ctx.location) });
                    });
                  }}
                >
                  Help
                </button>
              </nav>
            )}
            {ctx.isAuthed && (
              <form
                className="topbar-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  closeMobileNav();
                  void ctx.withNotice(async () => {
                    await ctx.loadPublicData(ctx.selectedState, ctx.searchTerm);
                    ctx.navigate('/marketplace');
                  }, ctx.searchTerm.trim() ? `Searching for ${ctx.searchTerm.trim()}` : 'Showing available services');
                }}
              >
                <label>
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    value={ctx.searchTerm}
                    onChange={(event) => ctx.setSearchTerm(event.target.value)}
                    placeholder="Search for artisan"
                  />
                </label>
                <label className="topbar-location-field">
                  <button
                    type="button"
                    className={`topbar-location-trigger${
                      ctx.isDetectingLocation
                        ? ' topbar-location-trigger--active'
                        : ctx.locationSource === 'auto'
                          ? ' topbar-location-trigger--active'
                          : ''
                    }`}
                    disabled={ctx.isDetectingLocation}
                    aria-label="Use my current location"
                    title="Use my current location"
                    onClick={handleUseMyLocation}
                  >
                    <span aria-hidden="true">⌖</span>
                  </button>
                  <select
                    value={ctx.selectedState}
                    disabled={ctx.isDetectingLocation}
                    aria-label="Location"
                    onChange={(event) => {
                      ctx.setSelectedState(event.target.value);
                    }}
                  >
                    <option value="">
                      {ctx.isDetectingLocation ? 'Detecting…' : 'Nigeria'}
                    </option>
                    {nigeriaStates.map((state) => (
                      <option key={state} value={state}>
                        {state}, Nigeria
                      </option>
                    ))}
                  </select>
                </label>
              </form>
            )}
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="topbar-menu-toggle"
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileNavOpen}
              aria-controls="topbar-mobile-panel"
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              <span className="topbar-menu-toggle-bars" aria-hidden="true" />
            </button>
            <AuthBox
              firebaseUser={ctx.firebaseUser}
              me={ctx.me}
              authDrawerPrompt={authDrawerPrompt}
              onAuthDrawerPromptHandled={() => setAuthDrawerPrompt(null)}
              unreadCount={ctx.notifications.filter((notification) => !notification.readAt).length}
              onOpenAuth={closeMobileNav}
              onReady={(nextToken, nextUser) => {
                ctx.acknowledgeSession(nextToken, nextUser);
                ctx.loadPrivateData(nextToken, nextUser).catch(() => undefined);
                if (nextUser.role === 'ADMIN') {
                  const onAdminRoute = ctx.location.pathname.startsWith('/admin');
                  if (!onAdminRoute) {
                    ctx.navigate('/admin/overview');
                  }
                } else if (nextUser.role === 'ARTISAN') {
                  ctx.navigate('/artisan/onboarding');
                } else if (
                  nextUser.role === 'CUSTOMER' &&
                  isArtisanApplicantSession(nextUser.firebaseUid)
                ) {
                  ctx.navigate(ARTISAN_ONBOARDING_PATH);
                } else if (nextUser.role === 'CUSTOMER') {
                  ctx.navigate('/');
                }
                ctx.setRouteHydrated(true);
              }}
              onNavigate={(nextView) => {
                closeMobileNav();
                if (nextView === 'help') {
                  ctx.navigate('/help', { state: nextHelpOpenState(ctx.location) });
                  return;
                }
                ctx.navigate(buildAppPath({ view: nextView }));
              }}
              onNavigatePath={(path) => {
                closeMobileNav();
                ctx.navigate(path);
              }}
              onWorkspaceSection={(section) => {
                closeMobileNav();
                ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: section }));
              }}
              onNotice={ctx.setNotice}
            />
          </div>

          {mobileNavOpen && (
            <button
              type="button"
              className="topbar-mobile-backdrop"
              aria-label="Close menu"
              onClick={closeMobileNav}
            />
          )}
        </header>
      )}

      {ctx.notice && (
        <div
          className={`notice ${ctx.usesArtisanSetupHeader ? 'setup-notice' : ''}`}
          role="status"
          aria-live="polite"
        >
          <span>{ctx.notice}</span>
          <button
            type="button"
            className="notice-dismiss"
            aria-label="Dismiss notification"
            onClick={() => ctx.setNotice('')}
          >
            x
          </button>
        </div>
      )}
      {ctx.bookingSuccess && (
        <BookingSuccessDialog
          booking={ctx.bookingSuccess}
          onClose={() => ctx.setBookingSuccess(null)}
          onGoToMessages={() => {
            ctx.setBookingSuccess(null);
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'messages' }));
          }}
        />
      )}
      {ctx.paymentSuccess && (
        <PaymentSuccessDialog
          payment={ctx.paymentSuccess}
          onClose={() => ctx.setPaymentSuccess(null)}
          onViewBookings={() => {
            ctx.setPaymentSuccess(null);
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'bookings' }));
          }}
        />
      )}

      {ctx.usesArtisanWorkspaceHeader && (
        <ArtisanAppHeader
          displayName={userDisplayName(ctx.firebaseUser, ctx.me)}
          email={ctx.firebaseUser?.email || ctx.me?.email}
          active={ctx.artisanHeaderActive}
          notificationUnreadCount={ctx.notifications.filter((notification) => !notification.readAt).length}
          onDashboard={() => {
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'overview' }));
          }}
          onJobs={() => {
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'bookings' }));
          }}
          onMessages={() => {
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'messages' }));
          }}
          onReviews={() => {
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'reviews' }));
          }}
          onOffers={() => {
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'offers' }));
          }}
          onNotifications={() => {
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'notifications' }));
          }}
          onProfile={() => {
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'profile' }));
          }}
          onSettings={() => {
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'settings' }));
          }}
          onHelp={() => {
            ctx.navigate('/help', { state: nextHelpOpenState(ctx.location) });
          }}
          onSignOut={() => {
            ctx.setNotice('Signed out');
            if (auth) {
              void signOut(auth);
            }
          }}
        />
      )}
      <Outlet />
    </>
  );
}
