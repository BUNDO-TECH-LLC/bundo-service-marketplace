import { describe, expect, it } from 'vitest';
import type { ApiUser } from '../types';
import { ARTISAN_ONBOARDING_PATH, artisanApplicantRedirectPath, isArtisanApplicant } from './artisanApplication';

const customer = (overrides: Partial<ApiUser> = {}): ApiUser => ({
  firebaseUid: 'uid-1',
  email: 'artisan@example.com',
  role: 'CUSTOMER',
  profileComplete: false,
  ...overrides,
});

describe('artisan applicant routing', () => {
  it('detects server-side onboarding intent', () => {
    expect(isArtisanApplicant(customer({ onboardingIntent: 'ARTISAN' }))).toBe(true);
  });

  it('redirects applicants away from the client workspace', () => {
    expect(
      artisanApplicantRedirectPath(customer({ onboardingIntent: 'ARTISAN' }), '/workspace/overview')
    ).toBe(ARTISAN_ONBOARDING_PATH);
    expect(
      artisanApplicantRedirectPath(customer({ onboardingIntent: 'ARTISAN' }), ARTISAN_ONBOARDING_PATH)
    ).toBeNull();
  });

  it('does not treat approved artisans as applicants', () => {
    expect(isArtisanApplicant(customer({ role: 'ARTISAN' }))).toBe(false);
  });
});
