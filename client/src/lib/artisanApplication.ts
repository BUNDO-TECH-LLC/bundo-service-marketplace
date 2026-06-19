import { api } from './api';
import {
  readPendingVerificationRole,
  readSessionSignupIntent,
  resolveSignupIntent,
} from './authSignupStorage';
import type { ApiUser } from '../types';

const ARTISAN_APPLICANT_SESSION_KEY = 'bundo:artisan-applicant';
const ARTISAN_APPLICANT_USER_PREFIX = 'bundo:artisan-applicant:';
const ARTISAN_APPLICANT_SUBMITTED_PREFIX = 'bundo:artisan-applicant-submitted:';
const ARTISAN_GATE_CACHE_PREFIX = 'bundo:artisan-gate:';

export const ARTISAN_ONBOARDING_PATH = '/artisan/onboarding';
export const ARTISAN_APPLICANT_WORKSPACE_PATH = '/workspace/overview';
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

function hasExplicitCustomerSignupIntent(email?: string | null) {
  if (readSessionSignupIntent() === 'CUSTOMER') {
    return true;
  }

  return Boolean(email && readPendingVerificationRole(email) === 'CUSTOMER');
}

function hasPendingArtisanSignupIntent(email?: string | null) {
  if (hasExplicitCustomerSignupIntent(email)) {
    return false;
  }

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

  const email = options.email ?? user?.email;

  if (user?.role === 'CUSTOMER') {
    if (user.onboardingIntent === 'ARTISAN') {
      return true;
    }

    if (hasExplicitCustomerSignupIntent(email)) {
      return false;
    }

    if (isArtisanApplicantSession(user.firebaseUid)) {
      return true;
    }
  }

  if (hasExplicitCustomerSignupIntent(email)) {
    return false;
  }

  if (isArtisanApplicantSession()) {
    return true;
  }

  return hasPendingArtisanSignupIntent(email);
}

export function hasArtisanApplicantSubmittedVerification(firebaseUid?: string | null) {
  if (typeof window === 'undefined' || !firebaseUid) {
    return false;
  }

  return (
    window.localStorage.getItem(`${ARTISAN_APPLICANT_SUBMITTED_PREFIX}${firebaseUid}`) === '1'
  );
}

export function markArtisanApplicantSubmitted(firebaseUid?: string | null) {
  if (typeof window === 'undefined' || !firebaseUid) {
    return;
  }

  window.localStorage.setItem(`${ARTISAN_APPLICANT_SUBMITTED_PREFIX}${firebaseUid}`, '1');
}

export function isArtisanApplicantInWorkspace(
  user?: ApiUser | null,
  options: ArtisanApplicantOptions = {}
): boolean {
  const firebaseUid = user?.firebaseUid;
  return isArtisanApplicant(user, options) && hasArtisanApplicantSubmittedVerification(firebaseUid);
}

export function artisanApplicantHomePath(
  user?: ApiUser | null,
  options: ArtisanApplicantOptions = {}
) {
  return isArtisanApplicantInWorkspace(user, options)
    ? ARTISAN_APPLICANT_WORKSPACE_PATH
    : ARTISAN_ONBOARDING_PATH;
}

export function artisanApplicantAllowedPath(pathname: string, workspaceAllowed = false) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const prefixes = workspaceAllowed
    ? [...ARTISAN_APPLICANT_ALLOWED_PREFIXES, '/workspace']
    : ARTISAN_APPLICANT_ALLOWED_PREFIXES;
  return prefixes.some((prefix) => path.startsWith(prefix));
}

export function artisanApplicantRedirectPath(
  user: ApiUser | null | undefined,
  pathname: string,
  options: ArtisanApplicantOptions = {}
) {
  if (!isArtisanApplicant(user, options)) {
    return null;
  }

  const workspaceAllowed = hasArtisanApplicantSubmittedVerification(user?.firebaseUid);
  if (artisanApplicantAllowedPath(pathname, workspaceAllowed)) {
    return null;
  }

  return workspaceAllowed ? ARTISAN_APPLICANT_WORKSPACE_PATH : ARTISAN_ONBOARDING_PATH;
}

function cacheArtisanApplicant(firebaseUid?: string | null) {
  window.sessionStorage.setItem(ARTISAN_APPLICANT_SESSION_KEY, '1');
  if (firebaseUid) {
    window.localStorage.setItem(`${ARTISAN_APPLICANT_USER_PREFIX}${firebaseUid}`, '1');
  }
}

export async function ensureArtisanApplicantOnServer(token: string, firebaseUid?: string | null) {
  cacheArtisanApplicant(firebaseUid);

  const response = await api<{ user: ApiUser }>('/users/onboarding-intent', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ intent: 'ARTISAN' }),
  });
  return response.user;
}

export async function markArtisanApplicant(token: string, firebaseUid?: string | null) {
  try {
    return await ensureArtisanApplicantOnServer(token, firebaseUid);
  } catch {
    return null;
  }
}

export async function clearArtisanApplicantOnServer(token: string, firebaseUid?: string | null) {
  clearArtisanApplicant(firebaseUid);

  try {
    const response = await api<{ user: ApiUser }>('/users/onboarding-intent', {
      method: 'PATCH',
      token,
      body: JSON.stringify({ intent: null }),
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
    window.localStorage.removeItem(`${ARTISAN_APPLICANT_SUBMITTED_PREFIX}${firebaseUid}`);
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
