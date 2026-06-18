import { describe, expect, it, vi } from 'vitest';
import type { ApiUser } from '../types';
import {
  ARTISAN_APPLICANT_WORKSPACE_PATH,
  ARTISAN_ONBOARDING_PATH,
  artisanApplicantHomePath,
  artisanApplicantRedirectPath,
  isArtisanApplicant,
  markArtisanApplicantSubmitted,
} from './artisanApplication';

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

  it('redirects setup applicants away from the client workspace', () => {
    expect(
      artisanApplicantRedirectPath(customer({ onboardingIntent: 'ARTISAN' }), '/workspace/overview')
    ).toBe(ARTISAN_ONBOARDING_PATH);
    expect(
      artisanApplicantRedirectPath(customer({ onboardingIntent: 'ARTISAN' }), ARTISAN_ONBOARDING_PATH)
    ).toBeNull();
  });

  it('sends submitted applicants to the artisan dashboard', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
      sessionStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    });

    markArtisanApplicantSubmitted('uid-1');
    expect(
      artisanApplicantRedirectPath(customer({ onboardingIntent: 'ARTISAN' }), '/')
    ).toBe(ARTISAN_APPLICANT_WORKSPACE_PATH);
    expect(
      artisanApplicantRedirectPath(customer({ onboardingIntent: 'ARTISAN' }), '/workspace/overview')
    ).toBeNull();
    expect(artisanApplicantHomePath(customer({ onboardingIntent: 'ARTISAN' }))).toBe(
      ARTISAN_APPLICANT_WORKSPACE_PATH
    );

    vi.unstubAllGlobals();
  });

  it('does not treat approved artisans as applicants', () => {
    expect(isArtisanApplicant(customer({ role: 'ARTISAN' }))).toBe(false);
  });
});
