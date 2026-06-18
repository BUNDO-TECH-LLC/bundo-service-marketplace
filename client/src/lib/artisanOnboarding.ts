import type {
  Artisan,
  ArtisanKycSubmission,
  AvailabilitySlot,
  Offering,
  PortfolioImage,
} from '../types';
import { ARTISAN_SETUP_STEPS } from '../features/artisan/landing/artisanLandingTypes';

export type ArtisanSetupSubPhase = 'wizard' | 'verification';

export function servicePlaceholderForCategory(categoryName?: string) {
  const normalized = categoryName?.trim().toLowerCase() || '';
  if (normalized.includes('plumb')) return 'e.g. Pipe repair from ₦5,000';
  if (normalized.includes('electric')) return 'e.g. Socket wiring from ₦8,000';
  if (normalized.includes('clean')) return 'e.g. Deep clean from ₦12,000';
  if (normalized.includes('make')) return 'e.g. Bridal glam from ₦25,000';
  if (normalized.includes('carpent')) return 'e.g. Door repair from ₦6,000';
  return 'e.g. Basic service from ₦5,000';
}

export function computeOnboardingProgress(step: number, subPhase: ArtisanSetupSubPhase) {
  if (subPhase === 'verification') {
    return 90;
  }

  return Math.min(85, Math.round((step / ARTISAN_SETUP_STEPS.length) * 85));
}

export function computeResumeState(input: {
  profile: Artisan | null;
  offerings: Offering[];
  availabilitySlots: AvailabilitySlot[];
  kycSubmission: ArtisanKycSubmission | null;
}) {
  if (!input.profile) {
    return { step: 1, subPhase: 'wizard' as const, resumeLabel: null };
  }

  if (!input.offerings.length) {
    return { step: 2, subPhase: 'wizard' as const, resumeLabel: ARTISAN_SETUP_STEPS[1].label };
  }

  if (!input.availabilitySlots.length) {
    return { step: 3, subPhase: 'wizard' as const, resumeLabel: ARTISAN_SETUP_STEPS[2].label };
  }

  const kycStatus = input.kycSubmission?.status ?? 'NOT_SUBMITTED';
  if (kycStatus === 'NOT_SUBMITTED' || !input.kycSubmission) {
    return { step: 3, subPhase: 'verification' as const, resumeLabel: 'Identity verification' };
  }

  return { step: 3, subPhase: 'wizard' as const, resumeLabel: null };
}
