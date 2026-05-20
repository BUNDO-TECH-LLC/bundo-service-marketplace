import { api } from './api';
import type { Artisan, Offering, PortfolioImage, AvailabilitySlot } from '../types';
import { appRoutes } from '../routes/paths';

const CATEGORY_STORAGE_KEY = 'bundo.artisan.onboarding.categoryId';

export type OnboardingStepId = 'basic-info' | 'pricing' | 'portfolio' | 'availability';

export type OnboardingStatus = {
  hasProfile: boolean;
  hasOfferings: boolean;
  hasPortfolio: boolean;
  hasAvailability: boolean;
};

export function readOnboardingCategoryId(): string {
  try {
    return sessionStorage.getItem(CATEGORY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function writeOnboardingCategoryId(categoryId: string) {
  try {
    if (categoryId.trim()) {
      sessionStorage.setItem(CATEGORY_STORAGE_KEY, categoryId.trim());
      return;
    }

    sessionStorage.removeItem(CATEGORY_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export async function fetchOnboardingStatus(token: string): Promise<OnboardingStatus> {
  const [profileResponse, offeringsResponse, imagesResponse, slotsResponse] = await Promise.all([
    api<{ profile: Artisan | null }>('/artisans/me', { token }).catch(() => ({ profile: null })),
    api<{ offerings: Offering[] }>('/offerings/me', { token }).catch(() => ({ offerings: [] })),
    api<{ images: PortfolioImage[] }>('/artisans/portfolio-images/me', { token }).catch(() => ({
      images: [],
    })),
    api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', { token }).catch(() => ({
      slots: [],
    })),
  ]);

  return {
    hasProfile: Boolean(profileResponse.profile?.id),
    hasOfferings: offeringsResponse.offerings.length > 0,
    hasPortfolio: imagesResponse.images.length > 0,
    hasAvailability: slotsResponse.slots.length > 0,
  };
}

export function isOnboardingComplete(status: OnboardingStatus) {
  return (
    status.hasProfile &&
    status.hasOfferings &&
    status.hasPortfolio &&
    status.hasAvailability
  );
}

export function getFirstIncompleteStepPath(status: OnboardingStatus): string {
  if (!status.hasProfile) {
    return appRoutes.artisanOnboardingBasicInfo;
  }

  if (!status.hasOfferings) {
    return appRoutes.artisanOnboardingPricing;
  }

  if (!status.hasPortfolio) {
    return appRoutes.artisanOnboardingPortfolio;
  }

  if (!status.hasAvailability) {
    return appRoutes.artisanOnboardingAvailability;
  }

  return appRoutes.artisanDashboard;
}

export async function resolveArtisanPostAuthPath(token: string): Promise<string> {
  const status = await fetchOnboardingStatus(token);

  if (isOnboardingComplete(status)) {
    return appRoutes.artisanDashboard;
  }

  return getFirstIncompleteStepPath(status);
}
