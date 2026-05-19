import { useEffect, useState } from 'react';
import type { ArtisanHeaderActive } from '../../appTypes';
import bundoLogo from '../../assets/bundo-logo.png';

export function ArtisanAppHeader({
  displayName,
  active,
  notificationUnreadCount = 0,
  onDashboard,
  onJobs,
  onMessages,
  onReviews,
  onOffers,
  onNotifications,
  onProfile,
  onSignOut,
}: {
  displayName: string;
  active: ArtisanHeaderActive;
  notificationUnreadCount?: number;
  onDashboard: () => void;
  onJobs: () => void;
  onMessages: () => void;
  onReviews: () => void;
  onOffers: () => void;
  onNotifications: () => void;
  onProfile: () => void;
  onSignOut?: () => void;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const firstName = displayName.split(' ')[0];
  const initial = displayName.slice(0, 1).toUpperCase();

  const navItems: { label: ArtisanHeaderActive; action: () => void; badge?: number }[] = [
    { label: 'Dashboard', action: onDashboard },
    { label: 'Jobs', action: onJobs },
    { label: 'Messages', action: onMessages },
    { label: 'Reviews', action: onReviews },
    { label: 'Offers', action: onOffers },
    { label: 'Notifications', action: onNotifications, badge: notificationUnreadCount },
    { label: 'Profile', action: onProfile },
  ];

  const closeMobileNav = () => setMobileNavOpen(false);

  const runNav = (action: () => void) => {
    closeMobileNav();
    action();
  };

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

  return (
    <header
      className={`artisan-app-header ${mobileNavOpen ? 'artisan-app-header--nav-open' : ''}`}
    >
      <button type="button" className="brand" onClick={() => runNav(onDashboard)}>
        <img className="brand-logo" src={bundoLogo} alt="Bundo logo" />
        <span>Bundo</span>
      </button>

      <div className="artisan-header-collapse" id="artisan-header-mobile-panel">
        <nav aria-label="Artisan navigation">
          {navItems.map(({ label, action, badge }) => (
            <button
              key={label}
              type="button"
              className={active === label ? 'active' : ''}
              onClick={() => runNav(action)}
            >
              <span>{label}</span>
              {badge != null && badge > 0 && (
                <span className="artisan-nav-badge" aria-label={`${badge} unread`}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        {onSignOut && (
          <div className="artisan-header-mobile-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                closeMobileNav();
                onSignOut();
              }}
            >
              Log out
            </button>
          </div>
        )}
      </div>

      <div className="artisan-header-end">
        <button
          type="button"
          className="artisan-header-menu-toggle"
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileNavOpen}
          aria-controls="artisan-header-mobile-panel"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span className="artisan-header-menu-toggle-bars" aria-hidden="true" />
        </button>
        {onSignOut && (
          <button type="button" className="text-button artisan-header-signout" onClick={onSignOut}>
            Log out
          </button>
        )}
        <button
          type="button"
          className="artisan-user-chip"
          onClick={() => runNav(onProfile)}
          aria-label={`${displayName} profile`}
        >
          <span className="artisan-user-chip-avatar" aria-hidden="true">
            {initial}
          </span>
          <span className="artisan-user-chip-name">{firstName}</span>
        </button>
      </div>

      {mobileNavOpen && (
        <button
          type="button"
          className="artisan-header-mobile-backdrop"
          aria-label="Close menu"
          onClick={closeMobileNav}
        />
      )}
    </header>
  );
}

