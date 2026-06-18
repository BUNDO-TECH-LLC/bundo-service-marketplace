import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiUser } from '../types';
import {
  CUSTOMER_PROFILE_PATH,
  isCustomerProfileComplete,
  onboardingRedirectPath,
} from './customerProfile';
import { ARTISAN_ONBOARDING_PATH } from './artisanApplication';

vi.mock('./artisanApplication', async () => {
  const actual = await vi.importActual<typeof import('./artisanApplication')>('./artisanApplication');
  return {
    ...actual,
    isArtisanApplicant: vi.fn(() => false),
    isApprovedArtisanSession: vi.fn(() => false),
  };
});

const { isArtisanApplicant, isApprovedArtisanSession } = await import('./artisanApplication');

const customer = (overrides: Partial<ApiUser> = {}): ApiUser => ({
  firebaseUid: 'uid-1',
  email: 'client@example.com',
  role: 'CUSTOMER',
  profileComplete: false,
  ...overrides,
});

describe('customer onboarding redirects', () => {
  beforeEach(() => {
    vi.mocked(isArtisanApplicant).mockReturnValue(false);
    vi.mocked(isApprovedArtisanSession).mockReturnValue(false);
  });

  it('treats incomplete customer profiles as incomplete', () => {
    expect(isCustomerProfileComplete(customer())).toBe(false);
    expect(isCustomerProfileComplete(customer({ profileComplete: true }))).toBe(true);
  });

  it('sends incomplete customers to the profile page', () => {
    expect(onboardingRedirectPath(customer(), '/marketplace')).toBe(CUSTOMER_PROFILE_PATH);
    expect(onboardingRedirectPath(customer(), CUSTOMER_PROFILE_PATH)).toBeNull();
  });

  it('sends artisan applicants to artisan onboarding', () => {
    vi.mocked(isArtisanApplicant).mockReturnValue(true);

    expect(onboardingRedirectPath(customer({ onboardingIntent: 'ARTISAN' }), '/workspace/overview')).toBe(
      ARTISAN_ONBOARDING_PATH
    );
    expect(onboardingRedirectPath(customer({ onboardingIntent: 'ARTISAN' }), ARTISAN_ONBOARDING_PATH)).toBeNull();
  });

  it('sends approved artisans to workspace', () => {
    vi.mocked(isApprovedArtisanSession).mockReturnValue(true);

    expect(
      onboardingRedirectPath(customer({ role: 'ARTISAN', profileComplete: true }), '/')
    ).toBe('/workspace/overview');
  });

  it('sends unapproved artisans to onboarding', () => {
    expect(
      onboardingRedirectPath(customer({ role: 'ARTISAN', profileComplete: true }), '/')
    ).toBe(ARTISAN_ONBOARDING_PATH);
  });
});
