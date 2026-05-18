import { legacyQueryToAppPath } from './appPaths';

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

  try {
    const url = trimmed.startsWith('http') ? new URL(trimmed) : new URL(trimmed, 'https://app.local');
    const legacy = legacyQueryToAppPath(url.search);
    if (legacy) {
      return legacy;
    }
    if (url.pathname && url.pathname !== '/') {
      return url.pathname;
    }
  } catch {
    return null;
  }

  return null;
}
