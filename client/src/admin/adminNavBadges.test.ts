import { describe, expect, it } from 'vitest';
import { adminNavBadge } from './adminNavBadges';

describe('adminNavBadge', () => {
  it('shows urgent KYC count on verification', () => {
    expect(adminNavBadge('verification', { pendingKycSubmissions: 3 })).toEqual({
      count: 3,
      urgent: true,
    });
  });

  it('prefers open disputes on jobs', () => {
    expect(adminNavBadge('jobs', { openDisputes: 2, bookingRequests: 5 })).toEqual({
      count: 2,
      urgent: true,
    });
  });

  it('returns null when nothing needs attention', () => {
    expect(adminNavBadge('messages', { conversations: 40 })).toBeNull();
  });
});
