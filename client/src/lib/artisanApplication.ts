const ARTISAN_APPLICANT_SESSION_KEY = 'bundo:artisan-applicant';
const ARTISAN_APPLICANT_USER_PREFIX = 'bundo:artisan-applicant:';
const ARTISAN_WELCOME_SEEN_PREFIX = 'bundo:artisan-welcome-seen:';

export const ARTISAN_ONBOARDING_PATH = '/artisan/onboarding';
export const ARTISAN_ONBOARDING_WELCOME_PATH = '/artisan/onboarding/welcome';

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
    window.localStorage.removeItem(`${ARTISAN_WELCOME_SEEN_PREFIX}${firebaseUid}`);
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

export function markArtisanWelcomeSeen(firebaseUid: string) {
  window.localStorage.setItem(`${ARTISAN_WELCOME_SEEN_PREFIX}${firebaseUid}`, '1');
}

export function hasSeenArtisanWelcome(firebaseUid: string | null | undefined) {
  if (!firebaseUid) {
    return false;
  }

  return window.localStorage.getItem(`${ARTISAN_WELCOME_SEEN_PREFIX}${firebaseUid}`) === '1';
}

export function artisanOnboardingEntryPath(firebaseUid: string | null | undefined) {
  if (!firebaseUid || hasSeenArtisanWelcome(firebaseUid)) {
    return ARTISAN_ONBOARDING_PATH;
  }

  return ARTISAN_ONBOARDING_WELCOME_PATH;
}
