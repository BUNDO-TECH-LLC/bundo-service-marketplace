import type { ReactNode } from 'react';

const iconProps = {
  viewBox: '0 0 24 24',
  width: 22,
  height: 22,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const SERVICE_CATEGORY_ICONS: Record<string, ReactNode> = {
  ac: (
    <svg {...iconProps}>
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="m16.24 16.24 2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="m4.93 19.07 2.83-2.83" />
      <path d="m16.24 7.76 2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  carpentry: (
    <svg {...iconProps}>
      <path d="m3 21 9-9" />
      <path d="m12 3 9 9-2 2-9-9" />
      <path d="M9 12l-6 6" />
      <path d="M14 7l3 3" />
    </svg>
  ),
  plumbing: (
    <svg {...iconProps}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  cleaning: (
    <svg {...iconProps}>
      <path d="m16 22-1-4" />
      <path d="M19 13.99a1 1 0 0 0 .5-.866l-1-8a1 1 0 0 0-1.99.132L16 10" />
      <path d="m4.5 9.5-1 8a1 1 0 0 0 .5.866" />
      <path d="M8 18h8" />
      <path d="M12 18V2l4 4-4 4-4-4 4-4v16" />
    </svg>
  ),
  appliance: (
    <svg {...iconProps}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 11h5" />
      <path d="M12 17h.01" />
    </svg>
  ),
  beautician: (
    <svg {...iconProps}>
      <path d="M12 3c2 3 4 5 4 8a4 4 0 0 1-8 0c0-3 2-5 4-8Z" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  ),
  masonry: (
    <svg {...iconProps}>
      <rect x="3" y="11" width="7" height="7" />
      <rect x="14" y="11" width="7" height="7" />
      <rect x="8.5" y="4" width="7" height="7" />
    </svg>
  ),
  electrical: (
    <svg {...iconProps}>
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  ),
  generator: (
    <svg {...iconProps}>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M9 10h6" />
      <path d="M9 14h4" />
      <path d="M8 6V4h8v2" />
    </svg>
  ),
  haulage: (
    <svg {...iconProps}>
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h4l3 3v2h-7z" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  ),
  barbing: (
    <svg {...iconProps}>
      <path d="M6 3l12 18" />
      <path d="M18 3 6 21" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
};

export function ServiceCategoryIcon({ iconKey }: { iconKey?: string }) {
  return SERVICE_CATEGORY_ICONS[iconKey || ''] ?? (
    <svg {...iconProps}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}
