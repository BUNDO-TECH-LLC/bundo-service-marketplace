import { routeStorageKey } from './workspaceRoute';

/** Routes that should survive auth bootstrap (guest or post-login redirect). */
export function isPublicBrowsePathname(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  return (
    p === '/help' ||
    p.startsWith('/help/') ||
    p === '/marketplace' ||
    p.startsWith('/artisans/')
  );
}

export function clearStoredRoute() {
  window.localStorage.removeItem(routeStorageKey);
}
