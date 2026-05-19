import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function NavSvg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconDashboard(props: IconProps) {
  return (
    <NavSvg {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </NavSvg>
  );
}

export function IconCategories(props: IconProps) {
  return (
    <NavSvg {...props}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </NavSvg>
  );
}

export function IconBookings(props: IconProps) {
  return (
    <NavSvg {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </NavSvg>
  );
}

export function IconMessages(props: IconProps) {
  return (
    <NavSvg {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </NavSvg>
  );
}

export function IconNotifications(props: IconProps) {
  return (
    <NavSvg {...props}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </NavSvg>
  );
}

export function IconReviews(props: IconProps) {
  return (
    <NavSvg {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </NavSvg>
  );
}

export function IconOffers(props: IconProps) {
  return (
    <NavSvg {...props}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <path d="M7 7h.01" />
    </NavSvg>
  );
}

export function IconProfile(props: IconProps) {
  return (
    <NavSvg {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </NavSvg>
  );
}

export function IconAdmin(props: IconProps) {
  return (
    <NavSvg {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </NavSvg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <NavSvg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </NavSvg>
  );
}

export function IconHelp(props: IconProps) {
  return (
    <NavSvg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </NavSvg>
  );
}

export function TopbarNavButton({
  label,
  active = false,
  onClick,
  icon,
  showBadge = false,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  icon: ReactNode;
  showBadge?: boolean;
}) {
  return (
    <button
      type="button"
      className={`topbar-nav-icon-btn${active ? ' active' : ''}`}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <span className="topbar-nav-icon-btn-graphic">{icon}</span>
      <span className="topbar-nav-mobile-label">{label}</span>
      <span className="topbar-nav-icon-tooltip" role="tooltip">
        {label}
      </span>
      {showBadge ? <span className="nav-unread-dot" aria-hidden /> : null}
    </button>
  );
}
