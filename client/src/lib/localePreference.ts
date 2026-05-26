export type BundoLocale = 'en' | 'ha' | 'yo' | 'ig';

const storageKey = 'bundo:locale';

export const LOCALE_OPTIONS: { value: BundoLocale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ha', label: 'Hausa' },
  { value: 'yo', label: 'Yoruba' },
  { value: 'ig', label: 'Igbo' },
];

export function readLocalePreference(): BundoLocale {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'ha' || stored === 'yo' || stored === 'ig' || stored === 'en') {
      return stored;
    }
  } catch {
    // Some private browsing/storage-restricted contexts can block localStorage.
  }

  return 'en';
}

export function saveLocalePreference(locale: BundoLocale) {
  try {
    window.localStorage.setItem(storageKey, locale);
  } catch {
    // Keep the UI usable even when browser storage is unavailable.
  }
  document.documentElement.lang = locale === 'en' ? 'en' : locale;
}
