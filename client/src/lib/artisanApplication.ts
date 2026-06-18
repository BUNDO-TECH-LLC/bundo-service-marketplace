import { api } from './api';
import type { ApiUser } from '../types';

const ARTISAN_APPLICANT_SESSION_KEY = 'bundo:artisan-applicant';
const ARTISAN_APPLICANT_USER_PREFIX = 'bundo:artisan-applicant:';
const ARTISAN_GATE_CACHE_PREFIX = 'bundo:artisan-gate:';

export const ARTISAN_ONBOARDING_PATH = '/artisan/onboarding';
/** @deprecated Welcome step removed — applicants go straight to onboarding. */
export const ARTISAN_ONBOARDING_WELCOME_PATH = ARTISAN_ONBOARDING_PATH;

export function isArtisanApplicant(user?: ApiUser | null): boolean {
  if (!user || user.role !== 'CUSTOMER') {
    return false;
  }

  if (user.onboardingIntent === 'ARTISAN') {
    return true;
  }

  return isArtisanApplicantSession(user.firebaseUid);
}

function cacheArtisanApplicant(firebaseUid?: string | null) {
  window.sessionStorage.setItem(ARTISAN_APPLICANT_SESSION_KEY, '1');
  if (firebaseUid) {
    window.localStorage.setItem(`${ARTISAN_APPLICANT_USER_PREFIX}${firebaseUid}`, '1');
  }
}

export async function markArtisanApplicant(token: string, firebaseUid?: string | null) {
  cacheArtisanApplicant(firebaseUid);

  try {
    const response = await api<{ user: ApiUser }>('/users/onboarding-intent', {
      method: 'PATCH',
      token,
      body: JSON.stringify({ intent: 'ARTISAN' }),
    });
    return response.user;
  } catch {
    return null;
  }
}

export function clearArtisanApplicant(firebaseUid?: string | null) {
  window.sessionStorage.removeItem(ARTISAN_APPLICANT_SESSION_KEY);
  if (firebaseUid) {
    window.localStorage.removeItem(`${ARTISAN_APPLICANT_USER_PREFIX}${firebaseUid}`);
    window.sessionStorage.removeItem(`${ARTISAN_GATE_CACHE_PREFIX}${firebaseUid}`);
  }
}

export function markArtisanApproved(firebaseUid?: string | null) {
  if (firebaseUid) {
    window.sessionStorage.setItem(`${ARTISAN_GATE_CACHE_PREFIX}${firebaseUid}`, 'approved');
  }
  clearArtisanApplicant(firebaseUid);
}

export function isApprovedArtisanSession(firebaseUid?: string | null) {
  return Boolean(firebaseUid && window.sessionStorage.getItem(`${ARTISAN_GATE_CACHE_PREFIX}${firebaseUid}`) === 'approved');
}

export function isArtisanApplicantSession(firebaseUid?: string | null): boolean {
  if (window.sessionStorage.getItem(ARTISAN_APPLICANT_SESSION_KEY) === '1') {
    return true;
  }

  if (firebaseUid && window.localStorage.getItem(`${ARTISAN_APPLICANT_USER_PREFIX}${firebaseUid}`) === '1') {
    return true;
  }

  return false;
}

export function artisanOnboardingEntryPath(_firebaseUid?: string | null) {
  return ARTISAN_ONBOARDING_PATH;
}
