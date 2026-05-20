import { useEffect, useState } from 'react';
import type { ArtisanHeaderActive } from '../../appTypes';
import bundoLogo from '../../assets/bundo-logo.png';
import { IconHelp, IconProfile, IconReviews, IconSettings } from '../../components/TopbarNavIcons';
import { ProfileAccountMenu } from '../../components/ProfileAccountMenu';
import { useMediaQuery } from '../../hooks/useMediaQuery';
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
  const narrowViewport = useMediaQuery('(max-width: 768px)');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
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
    if (!mobileNavOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  const profileGroups = [
    {
      title: 'Your business',
      items: [
        {
          id: 'profile',
          label: 'Profile',
          icon: <IconProfile />,
          onSelect: () => runNav(onProfile),
          active: active === 'Profile',
        },
        {
          id: 'reviews',
          label: 'Reviews',
          icon: <IconReviews />,
          onSelect: () => runNav(onReviews),
          active: active === 'Reviews',
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: <IconSettings />,
          onSelect: () => runNav(onSettings),
          active: active === 'Settings',
        },
      ],
    },
    {
      title: 'Support',
      items: [{ id: 'help', label: 'Help', icon: <IconHelp />, onSelect: () => runNav(onHelp) }],
    },
    ...(onSignOut
      ? [
          {
            items: [
              {
                id: 'logout',
                label: 'Log out',
                danger: true,
                onSelect: () => {
                  closeMenus();
                  onSignOut();
                },
              },
            ],
          },
        ]
      : []),
  ];

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
        {narrowViewport && (
          <ProfileAccountMenu
            layout="inline"
            displayName={displayName}
            email={email}
            roleHint={null}
            groups={profileGroups}
            onItemActivated={() => setMobileNavOpen(false)}
          />
        )}
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

        {!narrowViewport && (
          <ProfileAccountMenu
            className="artisan-account-profile-menu"
            displayName={displayName}
            email={email}
            roleHint={null}
            unreadCount={notificationUnreadCount}
            open={accountMenuOpen}
            onOpenChange={(next) => {
              if (next) setMobileNavOpen(false);
              setAccountMenuOpen(next);
            }}
            chipActive={accountSectionActive}
            groups={profileGroups}
          />
        )}
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
