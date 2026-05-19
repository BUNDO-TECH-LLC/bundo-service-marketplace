import { buildAppPath } from '../lib/appPaths';
import {
  IconAdmin,
  IconBookings,
  IconCategories,
  IconDashboard,
  IconMessages,
  IconNotifications,
  IconOffers,
  IconProfile,
  IconReviews,
  IconSettings,
  TopbarNavButton,
} from '../components/TopbarNavIcons';
import type { View, WorkspaceSection } from '../appTypes';
import type { ApiUser, Notification } from '../types';

type SignedInTopbarNavProps = {
  role: ApiUser['role'];
  view: View;
  workspaceSection: WorkspaceSection;
  notifications: Notification[];
  onNavigate: (path: string) => void;
};

export function SignedInTopbarNav({
  role,
  view,
  workspaceSection,
  notifications,
  onNavigate,
}: SignedInTopbarNavProps) {
  const hasUnreadNotifications = notifications.some((notification) => !notification.readAt);
  const bookingsLabel = role === 'ARTISAN' ? 'Jobs' : 'Bookings';

  return (
    <nav className="topbar-nav topbar-nav--icons" aria-label="Main navigation">
      <TopbarNavButton
        label="Dashboard"
        active={view === 'home'}
        icon={<IconDashboard />}
        onClick={() => onNavigate('/')}
      />
      <TopbarNavButton
        label="Categories"
        active={view === 'marketplace'}
        icon={<IconCategories />}
        onClick={() => onNavigate('/marketplace')}
      />
      <TopbarNavButton
        label={bookingsLabel}
        active={view === 'workspace' && workspaceSection === 'bookings'}
        icon={<IconBookings />}
        onClick={() => onNavigate(buildAppPath({ view: 'workspace', workspaceSection: 'bookings' }))}
      />
      <TopbarNavButton
        label="Messages"
        active={view === 'workspace' && workspaceSection === 'messages'}
        icon={<IconMessages />}
        onClick={() => onNavigate(buildAppPath({ view: 'workspace', workspaceSection: 'messages' }))}
      />
      <TopbarNavButton
        label="Notifications"
        active={view === 'workspace' && workspaceSection === 'notifications'}
        icon={<IconNotifications />}
        showBadge={hasUnreadNotifications}
        onClick={() => onNavigate(buildAppPath({ view: 'workspace', workspaceSection: 'notifications' }))}
      />
      {role === 'ARTISAN' && (
        <>
          <TopbarNavButton
            label="Reviews"
            active={view === 'workspace' && workspaceSection === 'reviews'}
            icon={<IconReviews />}
            onClick={() => onNavigate(buildAppPath({ view: 'workspace', workspaceSection: 'reviews' }))}
          />
          <TopbarNavButton
            label="Offers"
            active={view === 'workspace' && workspaceSection === 'offers'}
            icon={<IconOffers />}
            onClick={() => onNavigate(buildAppPath({ view: 'workspace', workspaceSection: 'offers' }))}
          />
          <TopbarNavButton
            label="Profile"
            active={view === 'workspace' && workspaceSection === 'profile'}
            icon={<IconProfile />}
            onClick={() => onNavigate(buildAppPath({ view: 'workspace', workspaceSection: 'profile' }))}
          />
          <TopbarNavButton
            label="Settings"
            active={view === 'workspace' && workspaceSection === 'settings'}
            icon={<IconSettings />}
            onClick={() => onNavigate(buildAppPath({ view: 'workspace', workspaceSection: 'settings' }))}
          />
        </>
      )}
      {role === 'ADMIN' && (
        <TopbarNavButton
          label="Admin"
          active={view === 'admin'}
          icon={<IconAdmin />}
          onClick={() => onNavigate(buildAppPath({ view: 'admin', adminSection: 'overview' }))}
        />
      )}
    </nav>
  );
}
