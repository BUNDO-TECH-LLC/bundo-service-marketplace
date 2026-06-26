export type LocationSource = 'auto' | 'manual' | 'none' | 'profile';

export type StoredLocationPreference = {
  source: LocationSource;
  state: string;
  area?: string;
  locationId?: string;
  locationLabel?: string;
  lat: number | null;
  lng: number | null;
  /** Whether the user has already been prompted for browser location. */
  promptStatus?: 'denied' | 'granted' | null;
};

const storageKey = 'bundo:location';

function normalizeSource(value: unknown): LocationSource | null {
  if (value === 'auto' || value === 'manual' || value === 'none' || value === 'profile') {
    return value;
  }

  return null;
}

export function readLocationPreference(): StoredLocationPreference | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredLocationPreference>;
    const source = normalizeSource(parsed.source);
    if (!source) {
      return null;
    }

    const state = typeof parsed.state === 'string' ? parsed.state : '';
    const area = typeof parsed.area === 'string' ? parsed.area : '';
    const locationId =
      typeof parsed.locationId === 'string'
        ? parsed.locationId
        : state
          ? `state-${state.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`
          : '';
    const locationLabel =
      typeof parsed.locationLabel === 'string'
        ? parsed.locationLabel
        : area && state
          ? `${area}, ${state}`
          : state;

    return {
      source,
      state,
      area,
      locationId,
      locationLabel,
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
