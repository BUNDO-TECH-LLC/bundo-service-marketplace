/** Frontend path routes (must stay aligned with client `buildAppPath`). */

export type WorkspaceLinkSection =
  | 'overview'
  | 'bookings'
  | 'messages'
  | 'offers'
  | 'notifications'
  | 'reviews'
  | 'profile';

export type AdminLinkSection =
  | 'overview'
  | 'profiles'
  | 'jobs'
  | 'messages'
  | 'verification'
  | 'catalog';

export function workspaceLink(section: WorkspaceLinkSection = 'overview') {
  return `/workspace/${section}`;
}

export function adminLink(section: AdminLinkSection = 'overview') {
  return `/admin/${section}`;
}

export function artisanProfileLink(artisanId: string) {
  return `/artisans/${artisanId}`;
}
