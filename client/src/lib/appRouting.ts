import { routeStorageKey } from './workspaceRoute';

const AUTH_PATHS = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/verify-email',
  '/loading',
  '/create-account',
]);

/** Dedicated auth screens (not wrapped in MainLayout). */
export function isAuthPathname(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  return AUTH_PATHS.has(p);
}

/** Routes that should survive auth bootstrap (guest or post-login redirect). */
export function isPublicBrowsePathname(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  return (
    p === '/help' ||
    p.startsWith('/help/') ||
    p === '/marketplace' ||
    p.startsWith('/artisans/') ||
    isAuthPathname(p)
  );
}

export function clearStoredRoute() {
  window.localStorage.removeItem(routeStorageKey);
}
