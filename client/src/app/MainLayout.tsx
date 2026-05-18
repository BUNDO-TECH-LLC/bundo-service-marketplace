import { signOut } from 'firebase/auth';
import { Outlet } from 'react-router-dom';
import { AuthBox } from '../auth/AuthBox';
import { EmptyState } from '../components/EmptyState';
import { buildAppPath } from '../lib/appPaths';
import { nextHelpOpenState } from '../lib/helpNavigation';
import { nigeriaStates } from '../lib/geo';
import { userDisplayName } from '../lib/userDisplayName';
import bundoLogo from '../assets/bundo-logo.png';
import { auth } from '../lib/firebase';
import {
  ArtisanAppHeader,
  BookingSuccessDialog,
} from './appShellComponents';
import { useAppRoot } from './appRootContext';

export function MainLayout() {
  const ctx = useAppRoot();

  return (
    <>
      {!ctx.hideGlobalHeader && (
        <header className={`topbar ${ctx.isAuthed ? 'signed-in-topbar' : ''}`}>
          <button type="button" className="brand" onClick={() => ctx.navigate('/')}>
            <img className="brand-logo" src={bundoLogo} alt="" />
            <span>Bundo</span>
          </button>
          <nav aria-label="Main navigation">
            {ctx.isAuthed && (
              <>
                <button type="button" className={ctx.view === 'home' ? 'active' : ''} onClick={() => ctx.navigate('/')}>
                  Dashboard
                </button>
                <button
                  type="button"
                  className={ctx.view === 'marketplace' ? 'active' : ''}
                  onClick={() => ctx.navigate('/marketplace')}
                >
                  Categories
                </button>
                <button
                  type="button"
                  className={ctx.view === 'workspace' && ctx.workspaceSection === 'bookings' ? 'active' : ''}
                  onClick={() => {
                    ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'bookings' }));
                  }}
                >
                  {ctx.me?.role === 'ARTISAN' ? 'Jobs' : 'Bookings'}
                </button>
                <button
                  type="button"
                  className={ctx.view === 'workspace' && ctx.workspaceSection === 'messages' ? 'active' : ''}
                  onClick={() => {
                    ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'messages' }));
                  }}
                >
                  Messages
                </button>
                <button
                  type="button"
                  className={ctx.view === 'workspace' && ctx.workspaceSection === 'notifications' ? 'active' : ''}
                  onClick={() => {
                    ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'notifications' }));
                  }}
                >
                  Notifications
                  {ctx.notifications.some((n) => !n.readAt) ? (
                    <span className="nav-unread-dot" aria-hidden />
                  ) : null}
                </button>
                {ctx.me?.role === 'ARTISAN' && (
                  <button
                    type="button"
                    className={ctx.view === 'workspace' && ctx.workspaceSection === 'reviews' ? 'active' : ''}
                    onClick={() => {
                      ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'reviews' }));
                    }}
                  >
                    Reviews
                  </button>
                )}
              </>
            )}
            {ctx.me?.role === 'ADMIN' && (
              <button
                type="button"
                className={ctx.view === 'admin' ? 'active' : ''}
                onClick={() => ctx.navigate(buildAppPath({ view: 'admin', adminSection: 'overview' }))}
              >
                Admin
              </button>
            )}
            <button
              type="button"
              className={ctx.view === 'help' ? 'active' : ''}
              onClick={() => {
                ctx.navigate('/help', { state: nextHelpOpenState(ctx.location) });
              }}
            >
              Help
            </button>
          </nav>
          {ctx.isAuthed && (
            <form
              className="topbar-search"
              onSubmit={(event) => {
                event.preventDefault();
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
              <label>
                <span aria-hidden="true">⌖</span>
                <select
                  value={ctx.selectedState}
                  onChange={(event) => {
                    ctx.setSelectedState(event.target.value);
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
            firebaseUser={ctx.firebaseUser}
            me={ctx.me}
            unreadCount={ctx.notifications.filter((notification) => !notification.readAt).length}
            onReady={(nextToken, nextUser) => {
              ctx.setToken(nextToken);
              ctx.setMe(nextUser);
              ctx.loadPrivateData(nextToken, nextUser).catch(() => undefined);
              if (nextUser.role === 'ADMIN') {
                ctx.navigate('/admin/overview');
              } else if (nextUser.role === 'CUSTOMER') {
                ctx.navigate('/');
              }
              ctx.setRouteHydrated(true);
            }}
            onNavigate={(nextView) => {
              if (nextView === 'help') {
                ctx.navigate('/help', { state: nextHelpOpenState(ctx.location) });
                return;
              }
              ctx.navigate(buildAppPath({ view: nextView }));
            }}
            onWorkspaceSection={(section) => {
              ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: section }));
            }}
            onNotice={ctx.setNotice}
          />
        </header>
      )}

      {ctx.notice && (
        <div className={`notice ${ctx.usesArtisanSetupHeader ? 'setup-notice' : ''}`}>{ctx.notice}</div>
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

      {ctx.isRestoringAuthedRoute ? (
        <main className="page route-loading">
          <EmptyState title="Loading your workspace" body="Restoring the right page for your account." />
        </main>
      ) : (
        <>
          {ctx.usesArtisanWorkspaceHeader && (
            <ArtisanAppHeader
              displayName={userDisplayName(ctx.firebaseUser, ctx.me)}
              active={ctx.artisanHeaderActive}
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
              onProfile={() => {
                ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'profile' }));
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
      )}
    </>
  );
}
