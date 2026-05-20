import { useEffect, useRef, useState } from 'react';
import type { ArtisanHeaderActive } from '../../appTypes';
import bundoLogo from '../../assets/bundo-logo.png';
import { IconHelp, IconProfile, IconReviews, IconSettings } from '../../components/TopbarNavIcons';
import { ArtisanTopbarNav } from './ArtisanTopbarNav';

const ACCOUNT_MENU_SECTIONS: ArtisanHeaderActive[] = ['Profile', 'Reviews', 'Settings'];

export function ArtisanAppHeader({
  displayName,
  email,
  active,
  notificationUnreadCount = 0,
  onDashboard,
  onJobs,
  onMessages,
  onReviews,
  onOffers,
  onNotifications,
  onProfile,
  onSettings,
  onHelp,
  onSignOut,
}: {
  displayName: string;
  email?: string | null;
  active: ArtisanHeaderActive;
  notificationUnreadCount?: number;
  onDashboard: () => void;
  onJobs: () => void;
  onMessages: () => void;
  onReviews: () => void;
  onOffers: () => void;
  onNotifications: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onSignOut?: () => void;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const initial = displayName.slice(0, 1).toUpperCase();
  const accountSectionActive = ACCOUNT_MENU_SECTIONS.includes(active);

  const closeMenus = () => {
    setMobileNavOpen(false);
    setAccountMenuOpen(false);
  };

  const runNav = (action: () => void) => {
    closeMenus();
    action();
  };

  useEffect(() => {
    if (!mobileNavOpen && !accountMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen, accountMenuOpen]);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [accountMenuOpen]);

  return (
    <header
      className={`artisan-app-header signed-in-topbar ${mobileNavOpen ? 'artisan-app-header--nav-open' : ''}`}
    >
      <button type="button" className="brand" onClick={() => runNav(onDashboard)}>
        <img className="brand-logo" src={bundoLogo} alt="Bundo logo" />
        <span>Bundo</span>
      </button>

      <div className="artisan-header-collapse" id="artisan-header-mobile-panel">
        <ArtisanTopbarNav
          active={active}
          notificationUnreadCount={notificationUnreadCount}
          onDashboard={onDashboard}
          onJobs={onJobs}
          onMessages={onMessages}
          onOffers={onOffers}
          onNotifications={onNotifications}
          onNavigate={runNav}
        />
      </div>

      <div className="artisan-header-end">
        <button
          type="button"
          className="artisan-header-menu-toggle"
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileNavOpen}
          aria-controls="artisan-header-mobile-panel"
          onClick={() => {
            setAccountMenuOpen(false);
            setMobileNavOpen((open) => !open);
          }}
        >
          <span className="artisan-header-menu-toggle-bars" aria-hidden="true" />
        </button>

        <div className="artisan-account-summary auth-summary" ref={accountRef}>
          <button
            type="button"
            className={`account-chip${accountSectionActive ? ' active' : ''}`}
            aria-label="Open account menu"
            aria-expanded={accountMenuOpen}
            onClick={() => {
              setMobileNavOpen(false);
              setAccountMenuOpen((open) => !open);
            }}
          >
            <span className="account-avatar">{initial}</span>
          </button>

          {accountMenuOpen && (
            <div className="account-menu artisan-account-menu" role="menu">
              <div className="account-menu-head">
                <span className="account-avatar large">{initial}</span>
                <div>
                  <strong>{displayName}</strong>
                  <small>{email || 'Artisan account'}</small>
                </div>
              </div>

              <button
                type="button"
                role="menuitem"
                className={`account-menu-item-with-icon${active === 'Profile' ? ' active' : ''}`}
                onClick={() => runNav(onProfile)}
              >
                <IconProfile />
                <span>Profile</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={`account-menu-item-with-icon${active === 'Reviews' ? ' active' : ''}`}
                onClick={() => runNav(onReviews)}
              >
                <IconReviews />
                <span>Reviews</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={`account-menu-item-with-icon${active === 'Settings' ? ' active' : ''}`}
                onClick={() => runNav(onSettings)}
              >
                <IconSettings />
                <span>Settings</span>
              </button>
              <button type="button" role="menuitem" className="account-menu-item-with-icon" onClick={() => runNav(onHelp)}>
                <IconHelp />
                <span>Help</span>
              </button>
              {onSignOut && (
                <button
                  type="button"
                  role="menuitem"
                  className="danger-menu-item"
                  onClick={() => {
                    closeMenus();
                    onSignOut();
                  }}
                >
                  Log out
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {mobileNavOpen && (
        <button
          type="button"
          className="artisan-header-mobile-backdrop"
          aria-label="Close menu"
          onClick={closeMenus}
        />
      )}
    </header>
  );
}
