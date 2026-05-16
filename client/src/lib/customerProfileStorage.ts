const LOCATION_KEY = 'bundo.customer.profile.location';
const EMAIL_NOTIFICATIONS_KEY = 'bundo.customer.preferences.emailNotifications';
const LOCATION_ACCESS_KEY = 'bundo.customer.preferences.locationAccess';

export function readCustomerProfileLocation() {
  try {
    return localStorage.getItem(LOCATION_KEY) || '';
  } catch {
    return '';
  }
}

export function writeCustomerProfileLocation(value: string) {
  try {
    if (value.trim()) {
      localStorage.setItem(LOCATION_KEY, value.trim());
      return;
    }

    localStorage.removeItem(LOCATION_KEY);
  } catch {
    // Ignore storage failures in private browsing.
  }
}

function readBooleanPreference(key: string, defaultValue: boolean) {
  try {
    const value = localStorage.getItem(key);

    if (value === null) {
      return defaultValue;
    }

    return value === 'true';
  } catch {
    return defaultValue;
  }
}

function writeBooleanPreference(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures in private browsing.
  }
}

export function readEmailNotificationsPreference() {
  return readBooleanPreference(EMAIL_NOTIFICATIONS_KEY, true);
}

export function writeEmailNotificationsPreference(value: boolean) {
  writeBooleanPreference(EMAIL_NOTIFICATIONS_KEY, value);
}

export function readLocationAccessPreference() {
  return readBooleanPreference(LOCATION_ACCESS_KEY, true);
}

export function writeLocationAccessPreference(value: boolean) {
  writeBooleanPreference(LOCATION_ACCESS_KEY, value);
}
