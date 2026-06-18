import { api } from './api';
import { readSessionSignupIntent, resolveSignupIntent } from './authSignupStorage';
import type { ApiUser } from '../types';

const ARTISAN_APPLICANT_SESSION_KEY = 'bundo:artisan-applicant';
const ARTISAN_APPLICANT_USER_PREFIX = 'bundo:artisan-applicant:';
const ARTISAN_GATE_CACHE_PREFIX = 'bundo:artisan-gate:';

export const ARTISAN_ONBOARDING_PATH = '/artisan/onboarding';
/** @deprecated Welcome step removed — applicants go straight to onboarding. */
export const ARTISAN_ONBOARDING_WELCOME_PATH = ARTISAN_ONBOARDING_PATH;

const ARTISAN_APPLICANT_ALLOWED_PREFIXES = [
  ARTISAN_ONBOARDING_PATH,
  '/verify-email',
  '/terms',
  '/privacy',
  '/help',
];

type ArtisanApplicantOptions = {
  email?: string | null;
};

function hasPendingArtisanSignupIntent(email?: string | null) {
  if (readSessionSignupIntent() === 'ARTISAN') {
    return true;
  }

  if (email && resolveSignupIntent(email) === 'ARTISAN') {
    return true;
  }

  return false;
}

/** Call as soon as the user picks Artisan at signup — before Firebase auth finishes. */
export function stageArtisanApplicantIntent() {
  window.sessionStorage.setItem(ARTISAN_APPLICANT_SESSION_KEY, '1');
}

export function isArtisanApplicant(
  user?: ApiUser | null,
  options: ArtisanApplicantOptions = {}
): boolean {
  if (user?.role === 'ARTISAN' || user?.role === 'ADMIN') {
    return false;
  }

  if (user?.role === 'CUSTOMER') {
    if (user.onboardingIntent === 'ARTISAN') {
      return true;
    }

    if (isArtisanApplicantSession(user.firebaseUid)) {
      return true;
    }
  }

  if (isArtisanApplicantSession()) {
    return true;
  }

  return hasPendingArtisanSignupIntent(options.email ?? user?.email);
}

export function artisanApplicantAllowedPath(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return ARTISAN_APPLICANT_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function artisanApplicantRedirectPath(
  user: ApiUser | null | undefined,
  pathname: string,
  options: ArtisanApplicantOptions = {}
) {
  if (!isArtisanApplicant(user, options)) {
    return null;
  }

  if (artisanApplicantAllowedPath(pathname)) {
    return null;
  }

  return ARTISAN_ONBOARDING_PATH;
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
  return Boolean(
    firebaseUid && window.sessionStorage.getItem(`${ARTISAN_GATE_CACHE_PREFIX}${firebaseUid}`) === 'approved'
  );
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
