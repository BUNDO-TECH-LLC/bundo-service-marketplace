import type { Role } from '../types';
import type { AdminSection, View, WorkspaceSection } from '../appTypes';
import { buildAppPath } from './appPaths';

export const routeStorageKey = 'bundo:last-route';

export const validStoredViews: View[] = ['home', 'marketplace', 'workspace', 'admin', 'help'];

export const validStoredWorkspaceSections: WorkspaceSection[] = [
  'overview',
  'bookings',
  'messages',
  'offers',
  'notifications',
  'reviews',
  'profile',
];

export function readStoredRoute(role: Role | null) {
  try {
    const rawRoute = window.localStorage.getItem(routeStorageKey);
    if (!rawRoute) return null;

    const parsed = JSON.parse(rawRoute) as {
      view?: View;
      workspaceSection?: WorkspaceSection;
      adminSection?: AdminSection;
    };

    if (!parsed.view || !validStoredViews.includes(parsed.view)) {
      return null;
    }

    if (parsed.view === 'admin' && role !== 'ADMIN') {
      return null;
    }

    if (role === 'ARTISAN' && parsed.view === 'home') {
      window.localStorage.removeItem(routeStorageKey);
      return {
        view: 'workspace' as View,
        workspaceSection: 'overview' as WorkspaceSection,
        adminSection: 'overview' as AdminSection,
      };
    }

    return {
      view: parsed.view,
      workspaceSection:
        parsed.workspaceSection && validStoredWorkspaceSections.includes(parsed.workspaceSection)
          ? parsed.workspaceSection
          : 'overview',
      adminSection: parsed.adminSection || 'overview',
    };
  } catch {
    return null;
  }
}

export function storedRouteToPath(stored: {
  view: View;
  workspaceSection: WorkspaceSection;
  adminSection: AdminSection;
}): string {
  return buildAppPath({
    view: stored.view,
    workspaceSection: stored.workspaceSection,
    adminSection: stored.adminSection,
  });
}
