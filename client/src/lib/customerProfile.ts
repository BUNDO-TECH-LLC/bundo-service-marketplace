import type { ApiUser } from '../types';
import {
  ARTISAN_ONBOARDING_PATH,
  artisanApplicantRedirectPath,
  isApprovedArtisanSession,
  isArtisanApplicant,
} from './artisanApplication';

export const CUSTOMER_PROFILE_PATH = '/onboarding/profile';

const CUSTOMER_ONBOARDING_ALLOWED_PREFIXES = [
  CUSTOMER_PROFILE_PATH,
  '/verify-email',
  '/terms',
  '/privacy',
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
  currentPathname: string,
  email?: string | null
): string | null {
  if (!user?.role) {
    return null;
  }

  const applicantTarget = artisanApplicantRedirectPath(user, currentPathname, { email });
  if (applicantTarget) {
    return applicantTarget;
  }

  const path = currentPathname.replace(/\/+$/, '') || '/';

  if (user.role === 'ARTISAN') {
    if (isApprovedArtisanSession(user.firebaseUid)) {
      return path.startsWith('/workspace') ? null : '/workspace/overview';
    }
    return path.startsWith(ARTISAN_ONBOARDING_PATH) ? null : ARTISAN_ONBOARDING_PATH;
  }

  if (user.role === 'CUSTOMER' && !isCustomerProfileComplete(user)) {
    if (CUSTOMER_ONBOARDING_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return null;
    }
    return CUSTOMER_PROFILE_PATH;
  }

  return null;
}
