export type BundoLocale = 'en' | 'ha' | 'yo' | 'ig';

const storageKey = 'bundo:locale';

export const LOCALE_OPTIONS: { value: BundoLocale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ha', label: 'Hausa' },
  { value: 'yo', label: 'Yoruba' },
  { value: 'ig', label: 'Igbo' },
];

export function readLocalePreference(): BundoLocale {
  const stored = window.localStorage.getItem(storageKey);
  if (stored === 'ha' || stored === 'yo' || stored === 'ig' || stored === 'en') {
    return stored;
  }
  return 'en';
}

export function saveLocalePreference(locale: BundoLocale) {
  window.localStorage.setItem(storageKey, locale);
  document.documentElement.lang = locale === 'en' ? 'en' : locale;
}
