import { describe, expect, it } from 'vitest';
import { artisanVerificationPhase } from './artisanVerification';
import type { Artisan } from '../types';

const baseProfile = {
  id: 'a1',
  displayName: 'Test',
  bio: null,
  city: 'Lagos',
  area: null,
  lat: 0,
  lng: 0,
  avgRating: 0,
  ratingCount: 0,
} satisfies Omit<Artisan, 'verifyStatus'>;

describe('artisanVerificationPhase', () => {
  it('shows awaiting approval after KYC submit', () => {
    expect(
      artisanVerificationPhase({
        profile: { ...baseProfile, verifyStatus: 'PENDING' },
        kycStatus: 'PENDING',
        hydrated: true,
      })
    ).toBe('awaiting_approval');
  });

  it('shows setup before submission', () => {
    expect(
      artisanVerificationPhase({
        profile: { ...baseProfile, verifyStatus: 'PENDING' },
        kycStatus: 'NOT_SUBMITTED',
        hydrated: true,
      })
    ).toBe('setup');
  });
});
