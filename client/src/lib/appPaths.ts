import type { AdminSection, View, WorkspaceSection } from '../appTypes';

export const VALID_WORKSPACE_SECTIONS: WorkspaceSection[] = [
  'overview',
  'bookings',
  'messages',
  'offers',
  'notifications',
  'reviews',
  'profile',
  'settings',
];

export const VALID_ADMIN_SECTIONS: AdminSection[] = [
  'overview',
  'profiles',
  'jobs',
  'messages',
  'verification',
  'catalog',
  'reviews',
  'finance',
];

export type ParsedAppRoute = {
  view: View;
  workspaceSection: WorkspaceSection;
  adminSection: AdminSection;
  helpTopicId: string | null;
  artisanId: string | null;
};

export function buildAppPath(input: {
  view: View;
  workspaceSection?: WorkspaceSection;
  adminSection?: AdminSection;
  helpTopicId?: string | null;
  artisanId?: string | null;
}): string {
  const workspaceSection = input.workspaceSection ?? 'overview';
  const adminSection = input.adminSection ?? 'overview';

  switch (input.view) {
    case 'home':
      return '/';
    case 'marketplace':
      return '/marketplace';
    case 'workspace':
      return `/workspace/${workspaceSection}`;
    case 'admin':
      return `/admin/${adminSection}`;
    case 'help':
      if (input.helpTopicId) {
        return `/help/${encodeURIComponent(input.helpTopicId)}`;
      }
      return '/help';
    case 'artisan-profile':
      if (input.artisanId) {
        return `/artisans/${input.artisanId}`;
      }
      return '/marketplace';
    default:
      return '/';
  }
}

function isWorkspaceSection(value: string): value is WorkspaceSection {
  return VALID_WORKSPACE_SECTIONS.includes(value as WorkspaceSection);
}

function isAdminSection(value: string): value is AdminSection {
  return VALID_ADMIN_SECTIONS.includes(value as AdminSection);
}

export function parseAppPath(pathname: string): ParsedAppRoute | null {
  const raw = pathname.replace(/\/+$/, '') || '/';

  if (raw === '/' || raw === '') {
    return {
      view: 'home',
      workspaceSection: 'overview',
      adminSection: 'overview',
      helpTopicId: null,
      artisanId: null,
    };
  }

  if (raw === '/marketplace') {
    return {
      view: 'marketplace',
      workspaceSection: 'overview',
      adminSection: 'overview',
      helpTopicId: null,
      artisanId: null,
    };
  }

  if (raw === '/workspace') {
    return {
      view: 'workspace',
      workspaceSection: 'overview',
      adminSection: 'overview',
      helpTopicId: null,
      artisanId: null,
    };
  }

  const workspaceMatch = raw.match(/^\/workspace\/([^/]+)$/);
  if (workspaceMatch) {
    const section = workspaceMatch[1];
    if (!isWorkspaceSection(section)) return null;
    return {
      view: 'workspace',
      workspaceSection: section,
      adminSection: 'overview',
      helpTopicId: null,
      artisanId: null,
    };
  }

  if (raw === '/admin') {
    return {
      view: 'admin',
      workspaceSection: 'overview',
      adminSection: 'overview',
      helpTopicId: null,
      artisanId: null,
    };
  }

  const adminMatch = raw.match(/^\/admin\/([^/]+)$/);
  if (adminMatch) {
    const section = adminMatch[1];
    if (!isAdminSection(section)) return null;
    return {
      view: 'admin',
      workspaceSection: 'overview',
      adminSection: section,
      helpTopicId: null,
      artisanId: null,
    };
  }

  if (raw === '/help') {
    return {
      view: 'help',
      workspaceSection: 'overview',
      adminSection: 'overview',
      helpTopicId: null,
      artisanId: null,
    };
  }

  const helpMatch = raw.match(/^\/help\/(.+)$/);
  if (helpMatch) {
    let topicId: string;
    try {
      topicId = decodeURIComponent(helpMatch[1]);
    } catch {
      return null;
    }
    return {
      view: 'help',
      workspaceSection: 'overview',
      adminSection: 'overview',
      helpTopicId: topicId,
      artisanId: null,
    };
  }

  const artisanMatch = raw.match(/^\/artisans\/([^/]+)$/);
  if (artisanMatch) {
    return {
      view: 'artisan-profile',
      workspaceSection: 'overview',
      adminSection: 'overview',
      helpTopicId: null,
      artisanId: artisanMatch[1],
    };
  }

  return null;
}

export function legacyQueryToAppPath(search: string): string | null {
  const params = new URLSearchParams(search);
  if (params.get('reference') || params.get('trxref')) {
    return null;
  }

  const requestedView = params.get('view');
  if (!requestedView) return null;

  const validViews: View[] = ['home', 'marketplace', 'workspace', 'admin', 'help'];
  if (!validViews.includes(requestedView as View)) return null;

  const requestedSection = params.get('section');

  if (requestedView === 'workspace') {
    const section =
      requestedSection && isWorkspaceSection(requestedSection) ? requestedSection : 'overview';
    return buildAppPath({ view: 'workspace', workspaceSection: section });
  }

  if (requestedView === 'admin') {
    const section =
      requestedSection && isAdminSection(requestedSection) ? requestedSection : 'overview';
    return buildAppPath({ view: 'admin', adminSection: section });
  }

  return buildAppPath({ view: requestedView as View });
}
