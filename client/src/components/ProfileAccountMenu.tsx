import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export type ProfileAccountMenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  active?: boolean;
  /** Log out and other destructive actions */
  danger?: boolean;
};

export type ProfileAccountMenuGroup = {
  title?: string;
  items: ProfileAccountMenuItem[];
};

type ProfileAccountMenuProps = {
  displayName: string;
  email?: string | null;
  /** Shown under the email (e.g. role caption for non-artisan) */
  roleHint?: string | null;
  unreadCount?: number;
  /** Popover mode only */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  groups: ProfileAccountMenuGroup[];
  chipActive?: boolean;
  className?: string;
  layout?: 'popover' | 'inline';
  /** After any menu item runs (e.g. close mobile nav sheet) */
  onItemActivated?: () => void;
};

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`profile-account-menu-chevron${open ? ' profile-account-menu-chevron--open' : ''}`}
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ProfileAccountMenuBody({
  displayName,
  email,
  roleHint,
  groups,
  onItemActivated,
}: Pick<ProfileAccountMenuProps, 'displayName' | 'email' | 'roleHint' | 'groups'> & {
  onItemActivated?: () => void;
}) {
  const initial = displayName.slice(0, 1).toUpperCase();

  const handleSelect = (item: ProfileAccountMenuItem) => {
    item.onSelect();
    onItemActivated?.();
  };

  const body = (
    <>
      <div className="account-menu-head profile-account-dropdown-head profile-account-dropdown-head--inline">
        <span className="account-avatar large">{initial}</span>
        <div>
          <strong>{displayName}</strong>
          <small>{email || '—'}</small>
          {roleHint ? <em>{roleHint}</em> : null}
        </div>
      </div>

      <div className="profile-account-dropdown-body">
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="profile-account-menu-group">
            {group.title ? <p className="profile-account-menu-section-title">{group.title}</p> : null}
            <div className="profile-account-menu-group-items">
              {group.items.map((item) => {
                const classNames = [
                  item.icon ? 'account-menu-item-with-icon' : 'profile-account-menu-text-item',
                  item.active && !item.danger ? 'active' : '',
                  item.danger ? 'danger-menu-item' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={classNames}
                    onClick={() => handleSelect(item)}
                  >
                    {item.icon ? item.icon : null}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="profile-account-menu-inline">
      <div className="account-menu profile-account-dropdown profile-account-dropdown--inline" role="menu">
        {body}
      </div>
    </div>
  );
}

export function ProfileAccountMenu({
  displayName,
  email,
  roleHint,
  unreadCount = 0,
  open = false,
  onOpenChange,
  groups,
  chipActive = false,
  className = '',
  layout = 'popover',
  onItemActivated,
}: ProfileAccountMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const initial = displayName.slice(0, 1).toUpperCase();

  useEffect(() => {
    if (layout !== 'popover' || !open || !onOpenChange) return;

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [layout, open, onOpenChange]);

  useEffect(() => {
    if (layout !== 'popover' || !open || !onOpenChange) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [layout, open, onOpenChange]);

  if (layout === 'inline') {
    return (
      <ProfileAccountMenuBody
        displayName={displayName}
        email={email}
        roleHint={roleHint}
        groups={groups}
        onItemActivated={onItemActivated}
      />
    );
  }

  const activateItem = (item: ProfileAccountMenuItem) => {
    item.onSelect();
    onOpenChange?.(false);
    onItemActivated?.();
  };

  return (
    <div className={`profile-account-menu-root auth-summary ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={`account-chip profile-account-menu-trigger${chipActive ? ' active' : ''}${open ? ' is-open' : ''}`}
        aria-label={`Account menu for ${displayName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => onOpenChange?.(!open)}
      >
        <span className="account-avatar">{initial}</span>
        {unreadCount > 0 ? <span className="account-badge">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
        <ChevronDown open={open} />
      </button>

      {open && (
        <div className="account-menu profile-account-dropdown" role="menu">
          <div className="account-menu-head profile-account-dropdown-head">
            <span className="account-avatar large">{initial}</span>
            <div>
              <strong>{displayName}</strong>
              <small>{email || '—'}</small>
              {roleHint ? <em>{roleHint}</em> : null}
            </div>
          </div>

          <div className="profile-account-dropdown-body">
            {groups.map((group, groupIndex) => (
              <div key={groupIndex} className="profile-account-menu-group">
                {group.title ? <p className="profile-account-menu-section-title">{group.title}</p> : null}
                <div className="profile-account-menu-group-items">
                  {group.items.map((item) => {
                    const classNames = [
                      item.icon ? 'account-menu-item-with-icon' : 'profile-account-menu-text-item',
                      item.active && !item.danger ? 'active' : '',
                      item.danger ? 'danger-menu-item' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        className={classNames}
                        onClick={() => activateItem(item)}
                      >
                        {item.icon ? item.icon : null}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
