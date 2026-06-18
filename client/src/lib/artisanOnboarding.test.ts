import { describe, expect, it } from 'vitest';
import { ARTISAN_SETUP_STEPS } from '../features/artisan/landing/artisanLandingTypes';
import {
  computeOnboardingProgress,
  computeResumeState,
  servicePlaceholderForCategory,
} from './artisanOnboarding';

describe('artisanOnboarding helpers', () => {
  it('computes progress for wizard and verification phases', () => {
    expect(computeOnboardingProgress(1, 'wizard')).toBeLessThan(computeOnboardingProgress(3, 'wizard'));
    expect(computeOnboardingProgress(3, 'verification')).toBe(90);
  });

  it('resumes at the first incomplete step', () => {
    expect(
      computeResumeState({
        profile: null,
        offerings: [],
        availabilitySlots: [],
        kycSubmission: null,
      })
    ).toEqual({ step: 1, subPhase: 'wizard', resumeLabel: null });

    expect(
      computeResumeState({
        profile: { id: 'p1' } as never,
        offerings: [{ id: 'o1' } as never],
        availabilitySlots: [],
        kycSubmission: null,
      }).step
    ).toBe(3);

    expect(
      computeResumeState({
        profile: { id: 'p1' } as never,
        offerings: [{ id: 'o1' } as never],
        availabilitySlots: [{ id: 's1' } as never],
        kycSubmission: null,
      })
    ).toMatchObject({ subPhase: 'verification', resumeLabel: 'Identity verification' });
  });

  it('suggests category-specific service placeholders', () => {
    expect(servicePlaceholderForCategory('Plumbing')).toContain('Pipe repair');
    expect(servicePlaceholderForCategory('Unknown')).toContain('₦5,000');
  });

  it('uses three setup steps', () => {
    expect(ARTISAN_SETUP_STEPS).toHaveLength(3);
  });
});
