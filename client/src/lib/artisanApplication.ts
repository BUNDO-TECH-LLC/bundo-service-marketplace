const ARTISAN_APPLICANT_SESSION_KEY = 'bundo:artisan-applicant';
const ARTISAN_APPLICANT_USER_PREFIX = 'bundo:artisan-applicant:';
export const ARTISAN_ONBOARDING_PATH = '/artisan/onboarding';
/** @deprecated Welcome step removed — applicants go straight to onboarding. */
export const ARTISAN_ONBOARDING_WELCOME_PATH = ARTISAN_ONBOARDING_PATH;

export function markArtisanApplicant(firebaseUid?: string | null) {
  window.sessionStorage.setItem(ARTISAN_APPLICANT_SESSION_KEY, '1');
  if (firebaseUid) {
    window.localStorage.setItem(`${ARTISAN_APPLICANT_USER_PREFIX}${firebaseUid}`, '1');
  }
}

export function clearArtisanApplicant(firebaseUid?: string | null) {
  window.sessionStorage.removeItem(ARTISAN_APPLICANT_SESSION_KEY);
  if (firebaseUid) {
    window.localStorage.removeItem(`${ARTISAN_APPLICANT_USER_PREFIX}${firebaseUid}`);
  }
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
