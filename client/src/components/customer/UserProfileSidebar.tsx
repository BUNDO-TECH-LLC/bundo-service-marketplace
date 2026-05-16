import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import './UserProfileSidebar.css';
import { AppIcon } from '../ui/AppIcon';
import { ProfileAvatar } from '../ui/ProfileAvatar';

export type UserProfileMenuItem = {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
};

type UserProfileSidebarProps = {
  open: boolean;
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  items: UserProfileMenuItem[];
  onLogout: () => void | Promise<void>;
};

export function UserProfileSidebar({
  open,
  onClose,
  anchorRef,
  displayName,
  handle,
  avatarUrl,
  items,
  onLogout,
}: UserProfileSidebarProps) {
  const panelRef = useRef<HTMLElement>(null);

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

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <aside
      ref={panelRef}
      className="user-profile-sidebar"
      role="dialog"
      aria-label="Account menu"
    >
      <div className="user-profile-sidebar__profile">
        <ProfileAvatar
          name={displayName}
          imageUrl={avatarUrl}
          className="h-20 w-20"
          textClassName="text-2xl"
        />
        <h2 className="user-profile-sidebar__name">{displayName}</h2>
        <p className="user-profile-sidebar__handle">{handle}</p>
      </div>

      <nav className="user-profile-sidebar__nav" aria-label="Account links">
        {items.map((item) => (
          <button
            key={item.id}
            className="user-profile-sidebar__nav-item"
            type="button"
            onClick={item.onClick}
          >
            <AppIcon icon={item.icon} size={22} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <button
        className="user-profile-sidebar__logout"
        type="button"
        onClick={() => {
          void onLogout();
        }}
      >
        Log out
      </button>
    </aside>,
    document.body,
  );
}
