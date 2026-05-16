import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import bundoLogo from '../../assets/BundoLogo.png';
import { customerProfileImageUrl } from '../../lib/profileImage';
import { userDisplayName, userFullDisplayName, userHandle } from '../../lib/userDisplayName';
import { buildCustomerWorkspacePath } from '../../routes/paths';
import type { ApiUser } from '../../types';
import { AppIcon } from '../ui/AppIcon';
import { ProfileAvatar } from '../ui/ProfileAvatar';
import {
  CustomerAccountPanel,
  type CustomerAccountSection,
} from './CustomerAccountPanel';
import { UserProfileSidebar, type UserProfileMenuItem } from './UserProfileSidebar';

type CustomerHeaderProps = {
  firebaseUser: User | null;
  me: ApiUser | null;
  activeNav?: 'dashboard' | 'categories' | 'bookings' | 'messages' | null;
  searchContent?: ReactNode;
  notificationsActive?: boolean;
  onOpenDashboard: () => void;
  onOpenMarketplace: () => void;
  onOpenNotifications?: () => void;
  onOpenWorkspace: (section: 'bookings' | 'messages') => void;
  onOpenBookingHistory?: () => void;
  onOpenSettings?: () => void;
  onUserUpdated?: (user: ApiUser) => void;
  onLogout: () => Promise<void> | void;
};

const baseNavButtonClass =
  'relative bg-transparent px-0 pt-2.5 pb-3.5 text-[15px] font-extrabold transition-colors';

export function CustomerHeader({
  firebaseUser,
  me,
  activeNav = null,
  searchContent,
  notificationsActive = false,
  onOpenDashboard,
  onOpenMarketplace,
  onOpenNotifications,
  onOpenWorkspace,
  onOpenBookingHistory,
  onOpenSettings,
  onUserUpdated,
  onLogout,
}: CustomerHeaderProps) {
  const navigate = useNavigate();
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountSection, setAccountSection] = useState<CustomerAccountSection>('profile');
  const displayName = userDisplayName(firebaseUser, me);
  const profileName = userFullDisplayName(firebaseUser, me);
  const handle = userHandle(firebaseUser, me);
  const avatarUrl = customerProfileImageUrl(firebaseUser);

  function closeMenu() {
    setMenuOpen(false);
  }

  function closeAccount() {
    setAccountOpen(false);
  }

  function openAccount(section: CustomerAccountSection = 'profile') {
    setAccountSection(section);
    setAccountOpen(true);
  }

  function openProfileScreen() {
    closeMenu();
    openAccount('profile');
  }

  function runNav(action: () => void) {
    closeMenu();
    action();
  }

  function openBookingHistory() {
    if (onOpenBookingHistory) {
      onOpenBookingHistory();
      return;
    }

    navigate(buildCustomerWorkspacePath('bookings'));
  }

  function openSettingsScreen() {
    closeMenu();
    openAccount('settings');
  }

  function openSettings() {
    if (onOpenSettings) {
      onOpenSettings();
      return;
    }

    openSettingsScreen();
  }

  function openNotifications() {
    if (onOpenNotifications) {
      onOpenNotifications();
      return;
    }

    navigate(buildCustomerWorkspacePath('notifications'));
  }

  const profileMenuItems: UserProfileMenuItem[] = [
    {
      id: 'profile',
      label: 'Your Profile',
      icon: 'mingcute:user-3-line',
      onClick: openProfileScreen,
    },
    {
      id: 'bookings',
      label: 'Booking history',
      icon: 'mdi:history',
      onClick: () => runNav(openBookingHistory),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'mdi:cog-outline',
      onClick: openSettingsScreen,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: 'tdesign:notification',
      onClick: () => runNav(openNotifications),
    },
  ];

  async function handleLogout() {
    closeMenu();
    closeAccount();
    await onLogout();
  }

  function navButtonClass(isActive: boolean) {
    return `${baseNavButtonClass} ${
      isActive
        ? "text-[var(--color-accent-bright)] after:absolute after:right-0 after:bottom-1 after:left-0 after:h-px after:bg-[var(--color-accent-bright)] after:content-['']"
        : 'text-[var(--color-ink)] hover:text-[var(--color-accent-bright)]'
    }`;
  }

  return (
    <>
      <header className="customer-app-header app-screen-gutter sticky top-0 z-30 flex flex-wrap items-center justify-between gap-5 bg-[var(--color-paper)] py-[18px]">
        <div className="flex flex-wrap items-center gap-6">
          <button
            className="inline-flex items-center gap-3 bg-transparent p-0 text-[34px] leading-none font-black text-[var(--color-ink)] max-[720px]:text-[28px]"
            type="button"
            onClick={onOpenDashboard}
          >
            <img className="h-[50px] w-[50px] rounded-lg object-cover" src={bundoLogo} alt="Bundo logo" />
            <span className="text-[24px] leading-none font-bold">Bundo</span>
          </button>

          <nav className="flex flex-wrap items-center justify-center gap-6" aria-label="Customer navigation">
            <button className={navButtonClass(activeNav === 'dashboard')} type="button" onClick={onOpenDashboard}>
              Dashboard
            </button>
            <button className={navButtonClass(activeNav === 'categories')} type="button" onClick={onOpenMarketplace}>
              Categories
            </button>
            <button className={navButtonClass(activeNav === 'bookings')} type="button" onClick={() => onOpenWorkspace('bookings')}>
              Bookings
            </button>
            <button className={navButtonClass(activeNav === 'messages')} type="button" onClick={() => onOpenWorkspace('messages')}>
              Messages
            </button>
          </nav>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-4">
          {searchContent}

          {onOpenNotifications ? (
            <button
              className={`grid h-8 w-8 place-items-center bg-transparent text-[22px] ${
                notificationsActive ? 'text-[var(--color-accent-bright)]' : 'text-[var(--color-ink)]'
              }`}
              type="button"
              onClick={onOpenNotifications}
              aria-label="Notifications"
            >
              <AppIcon icon="tdesign:notification" size={24} />
            </button>
          ) : null}

          <button
            ref={profileButtonRef}
            className="inline-flex items-center gap-2 bg-transparent p-0 font-semibold text-[var(--color-ink)]"
            type="button"
            aria-expanded={menuOpen || accountOpen}
            aria-haspopup="dialog"
            aria-label="Open account menu"
            onClick={() => {
              if (accountOpen) {
                closeAccount();
                return;
              }

              setMenuOpen((open) => !open);
            }}
          >
            <ProfileAvatar name={displayName} imageUrl={avatarUrl} className="h-[26px] w-[26px]" textClassName="text-xs" />
            <span>{displayName}</span>
            <AppIcon
              icon="mdi:chevron-down"
              size={18}
              className={`transition-transform ${menuOpen || accountOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </header>

      <UserProfileSidebar
        open={menuOpen}
        onClose={closeMenu}
        anchorRef={profileButtonRef}
        displayName={profileName}
        handle={handle}
        avatarUrl={avatarUrl}
        items={profileMenuItems}
        onLogout={handleLogout}
      />

      {firebaseUser ? (
        <CustomerAccountPanel
          open={accountOpen}
          section={accountSection}
          onSectionChange={setAccountSection}
          onClose={closeAccount}
          anchorRef={profileButtonRef}
          firebaseUser={firebaseUser}
          me={me}
          onUserUpdated={onUserUpdated}
          onOpenBookingHistory={() => {
            closeAccount();
            openBookingHistory();
          }}
          onOpenNotifications={() => {
            closeAccount();
            openNotifications();
          }}
          onLogout={handleLogout}
        />
      ) : null}
    </>
  );
}
