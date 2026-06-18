import type { ApiUser } from '../types';
import { ARTISAN_ONBOARDING_PATH, isArtisanApplicantSession } from './artisanApplication';

export const CUSTOMER_PROFILE_PATH = '/onboarding/profile';

const ONBOARDING_ALLOWED_PREFIXES = [
  CUSTOMER_PROFILE_PATH,
  '/verify-email',
  '/terms',
  '/privacy',
  ARTISAN_ONBOARDING_PATH,
];

export function isCustomerProfileComplete(user: ApiUser | null | undefined) {
  if (!user || user.role !== 'CUSTOMER') {
    return true;
  }

  return Boolean(user.profileComplete);
}

export function customerProfileRedirectPath(user: ApiUser | null | undefined) {
  return isCustomerProfileComplete(user) ? null : CUSTOMER_PROFILE_PATH;
}

export function onboardingRedirectPath(
  user: ApiUser | null | undefined,
  currentPathname: string
): string | null {
  if (!user?.role) {
    return null;
  }

  const path = currentPathname.replace(/\/+$/, '') || '/';
  if (ONBOARDING_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return null;
  }

  if (user.role === 'ARTISAN') {
    return ARTISAN_ONBOARDING_PATH;
  }

  if (user.role === 'CUSTOMER' && isArtisanApplicantSession(user.firebaseUid)) {
    return ARTISAN_ONBOARDING_PATH;
  }

  if (user.role === 'CUSTOMER' && !isCustomerProfileComplete(user)) {
    return CUSTOMER_PROFILE_PATH;
  }

  return null;
}
