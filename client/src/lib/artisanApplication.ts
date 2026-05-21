const ARTISAN_APPLICANT_STORAGE_KEY = 'bundo:artisan-applicant';

export function markArtisanApplicant() {
  window.sessionStorage.setItem(ARTISAN_APPLICANT_STORAGE_KEY, '1');
}

export function clearArtisanApplicant() {
  window.sessionStorage.removeItem(ARTISAN_APPLICANT_STORAGE_KEY);
}

export function isArtisanApplicantSession(): boolean {
  return window.sessionStorage.getItem(ARTISAN_APPLICANT_STORAGE_KEY) === '1';
}
