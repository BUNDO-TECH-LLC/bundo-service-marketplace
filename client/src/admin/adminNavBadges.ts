import type { AdminSection } from '../appTypes';

export type AdminNavBadge = {
  count: number;
  urgent?: boolean;
};

/** Derive sidebar badges from platform stats (not loaded list slices). */
export function adminNavBadge(
  section: AdminSection,
  stats: Record<string, number> | null
): AdminNavBadge | null {
  if (!stats) {
    return null;
  }

  switch (section) {
    case 'verification': {
      const count = stats.pendingKycSubmissions ?? 0;
      return count > 0 ? { count, urgent: true } : null;
    }
    case 'jobs': {
      const disputes = stats.openDisputes ?? 0;
      if (disputes > 0) {
        return { count: disputes, urgent: true };
      }
      const requests = stats.bookingRequests ?? 0;
      return requests > 0 ? { count: requests } : null;
    }
    case 'profiles': {
      const pending = stats.pendingArtisans ?? 0;
      return pending > 0 ? { count: pending, urgent: true } : null;
    }
    default:
      return null;
  }
}
