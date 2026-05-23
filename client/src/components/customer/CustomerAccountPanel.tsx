import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { User } from 'firebase/auth';
import { AppIcon } from '../ui/AppIcon';
import { CustomerProfileScreen } from './CustomerProfileScreen';
import { CustomerSettingsScreen } from './CustomerSettingsScreen';
import type { ApiUser } from '../../types';

export type CustomerAccountSection = 'profile' | 'bookings' | 'settings' | 'notifications';

type NavItem = {
  id: CustomerAccountSection;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { id: 'profile', label: 'Personal information', icon: 'mingcute:user-3-line' },
  { id: 'bookings', label: 'Booking history', icon: 'mdi:history' },
  { id: 'settings', label: 'Settings', icon: 'mdi:cog-outline' },
  { id: 'notifications', label: 'Notifications', icon: 'tdesign:notification' },
];

type CustomerAccountPanelProps = {
  open: boolean;
  section: CustomerAccountSection;
  onSectionChange: (section: CustomerAccountSection) => void;
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
  firebaseUser: User;
  me: ApiUser | null;
  onUserUpdated?: (user: ApiUser) => void;
  onOpenBookingHistory: () => void;
  onOpenNotifications: () => void;
  onLogout: () => void | Promise<void>;
};

export function CustomerAccountPanel({
  open,
  section,
  onSectionChange,
  onClose,
  anchorRef,
  firebaseUser,
  me,
  onUserUpdated,
  onOpenBookingHistory,
  onOpenNotifications,
  onLogout,
}: CustomerAccountPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target;

      if (
        !(target instanceof Node) ||
        panelRef.current?.contains(target) ||
        anchorRef?.current?.contains(target)
      ) {
        return;
      }

      onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [anchorRef, onClose, open]);

  function handleNavClick(item: NavItem) {
    if (item.id === 'profile' || item.id === 'settings') {
      onSectionChange(item.id);
      return;
    }

    if (item.id === 'bookings') {
      onOpenBookingHistory();
      return;
    }

    onOpenNotifications();
  }

  if (!open || !firebaseUser) {
    return null;
  }

  const usesStackedLayout = section === 'settings';

  return createPortal(
    <div
      ref={panelRef}
      className="customer-account-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Account"
    >
      <div className="customer-account-panel__layout app-screen-gutter">
        <nav className="customer-account-panel__sidebar" aria-label="Account sections">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`customer-account-panel__nav-item${section === item.id ? ' is-active' : ''}`}
              type="button"
              onClick={() => handleNavClick(item)}
            >
              <AppIcon icon={item.icon} size={22} />
              <span>{item.label}</span>
            </button>
          ))}

          <button
            className="customer-account-panel__logout"
            type="button"
            onClick={() => {
              void onLogout();
            }}
          >
            Log out
          </button>
        </nav>

        <div className="customer-account-panel__main">
          {usesStackedLayout ? (
            <CustomerSettingsScreen
              firebaseUser={firebaseUser}
              me={me}
              onEditProfile={() => onSectionChange('profile')}
              onViewAllBookings={onOpenBookingHistory}
            />
          ) : (
            <div className="customer-account-panel__card">
              {section === 'profile' ? (
                <CustomerProfileScreen firebaseUser={firebaseUser} me={me} onSaved={onUserUpdated} />
              ) : (
                <section className="customer-account-panel__placeholder">
                  <h1>{navItems.find((item) => item.id === section)?.label}</h1>
                  <p>This section opens from the account menu. Choose an item to continue.</p>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
