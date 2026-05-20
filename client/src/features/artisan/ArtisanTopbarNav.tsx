import type { ArtisanHeaderActive } from '../../appTypes';
import {
  IconBookings,
  IconDashboard,
  IconMessages,
  IconNotifications,
  IconOffers,
  TopbarNavButton,
} from '../../components/TopbarNavIcons';

type ArtisanTopbarNavProps = {
  active: ArtisanHeaderActive;
  notificationUnreadCount?: number;
  onDashboard: () => void;
  onJobs: () => void;
  onMessages: () => void;
  onOffers: () => void;
  onNotifications: () => void;
  onNavigate: (action: () => void) => void;
};

export function ArtisanTopbarNav({
  active,
  notificationUnreadCount = 0,
  onDashboard,
  onJobs,
  onMessages,
  onOffers,
  onNotifications,
  onNavigate,
}: ArtisanTopbarNavProps) {
  const hasUnreadNotifications = notificationUnreadCount > 0;

  return (
    <nav className="topbar-nav topbar-nav--icons artisan-topbar-nav" aria-label="Artisan navigation">
      <TopbarNavButton
        label="Dashboard"
        active={active === 'Dashboard'}
        icon={<IconDashboard />}
        onClick={() => onNavigate(onDashboard)}
      />
      <TopbarNavButton
        label="Jobs"
        active={active === 'Jobs'}
        icon={<IconBookings />}
        onClick={() => onNavigate(onJobs)}
      />
      <TopbarNavButton
        label="Messages"
        active={active === 'Messages'}
        icon={<IconMessages />}
        onClick={() => onNavigate(onMessages)}
      />
      <TopbarNavButton
        label="Offers"
        active={active === 'Offers'}
        icon={<IconOffers />}
        onClick={() => onNavigate(onOffers)}
      />
      <TopbarNavButton
        label="Notifications"
        active={active === 'Notifications'}
        icon={<IconNotifications />}
        showBadge={hasUnreadNotifications}
        onClick={() => onNavigate(onNotifications)}
      />
    </nav>
  );
}
