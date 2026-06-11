export type LocationSource = 'auto' | 'manual' | 'none';

export type StoredLocationPreference = {
  source: LocationSource;
  state: string;
  lat: number | null;
  lng: number | null;
  /** Whether the user has already been prompted for browser location. */
  promptStatus?: 'denied' | 'granted' | null;
};

const storageKey = 'bundo:location';

export function readLocationPreference(): StoredLocationPreference | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredLocationPreference>;
    if (parsed.source !== 'auto' && parsed.source !== 'manual' && parsed.source !== 'none') {
      return null;
    }

    return {
      source: parsed.source,
      state: typeof parsed.state === 'string' ? parsed.state : '',
      lat: typeof parsed.lat === 'number' && Number.isFinite(parsed.lat) ? parsed.lat : null,
      lng: typeof parsed.lng === 'number' && Number.isFinite(parsed.lng) ? parsed.lng : null,
      promptStatus:
        parsed.promptStatus === 'denied' || parsed.promptStatus === 'granted'
          ? parsed.promptStatus
          : null,
    };
  } catch {
    return null;
  }
}

export function saveLocationPreference(preference: StoredLocationPreference) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preference));
  } catch {
    // Keep the UI usable when storage is blocked.
  }
}

export function clearLocationPreference() {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures.
  }
}
