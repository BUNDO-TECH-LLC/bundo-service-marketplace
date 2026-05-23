import { buildAppPath, legacyQueryToAppPath } from './appPaths';
import type { Notification } from '../types';

/** Map stored notification links (including legacy query URLs) to app paths. */
export function normalizeNotificationLink(link: string | null | undefined): string | null {
  if (!link || typeof link !== 'string') {
    return null;
  }

  const trimmed = link.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  if (trimmed.startsWith('?')) {
    const legacy = legacyQueryToAppPath(trimmed);
    if (legacy) {
      return legacy;
    }
  }

  try {
    const url = trimmed.startsWith('http') ? new URL(trimmed) : new URL(trimmed, 'https://app.local');
    const legacy = legacyQueryToAppPath(url.search);
    if (legacy) {
      return legacy;
    }
    if (url.pathname && url.pathname !== '/') {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return null;
  }

  return null;
}

function defaultPathForNotificationType(type: Notification['type']): string | null {
  switch (type) {
    case 'BOOKING':
    case 'PAYMENT':
    case 'DISPUTE':
      return buildAppPath({ view: 'workspace', workspaceSection: 'bookings' });
    case 'MESSAGE':
      return buildAppPath({ view: 'workspace', workspaceSection: 'messages' });
    case 'REVIEW':
      return buildAppPath({ view: 'workspace', workspaceSection: 'reviews' });
    case 'ADMIN':
      return buildAppPath({ view: 'admin', adminSection: 'overview' });
    default:
      return null;
  }
}

/** Resolve where a notification should open, with type-based fallbacks for legacy rows. */
export function resolveNotificationTarget(notification: Notification): string | null {
  const fromLink = normalizeNotificationLink(notification.link);
  const fallback = defaultPathForNotificationType(notification.type);

  if (!fromLink) {
    return fallback;
  }

  if (fromLink === buildAppPath({ view: 'workspace', workspaceSection: 'overview' }) && fallback) {
    return fallback;
  }

  return fromLink;
}
