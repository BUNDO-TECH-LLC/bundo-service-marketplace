import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import bundoLogo from '../../assets/BundoLogo.png';
import { customerProfileImageUrl } from '../../lib/profileImage';
import { userDisplayName } from '../../lib/userDisplayName';
import type { ApiUser } from '../../types';
import { AppIcon } from '../ui/AppIcon';
import { ProfileAvatar } from '../ui/ProfileAvatar';

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
  onLogout,
}: CustomerHeaderProps) {
  const displayName = userDisplayName(firebaseUser, me);
  const avatarUrl = customerProfileImageUrl(firebaseUser);

  function navButtonClass(isActive: boolean) {
    return `${baseNavButtonClass} ${
      isActive
        ? "text-[var(--color-accent-bright)] after:absolute after:right-0 after:bottom-1 after:left-0 after:h-px after:bg-[var(--color-accent-bright)] after:content-['']"
        : 'text-[var(--color-ink)] hover:text-[var(--color-accent-bright)]'
    }`;
  }

  return (
    <header className="app-screen-gutter sticky top-0 z-20 flex flex-wrap items-center justify-between gap-5 bg-[var(--color-paper)] py-[18px]">
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
          className="inline-flex items-center gap-2 bg-transparent p-0 font-semibold text-[var(--color-ink)]"
          type="button"
          onClick={() => {
            void onLogout();
          }}
        >
          <ProfileAvatar name={displayName} imageUrl={avatarUrl} className="h-[26px] w-[26px]" textClassName="text-xs" />
          <span>{displayName}</span>
          <AppIcon icon="mdi:chevron-down" size={18} />
        </button>
      </div>
    </header>
  );
}
