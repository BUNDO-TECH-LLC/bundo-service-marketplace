export type BrowserLocationResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown' };

export type UseMyLocationResult =
  | { ok: true; state: string; lat: number; lng: number }
  | { ok: false; reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown' };

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

export function locationErrorMessage(
  reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown'
) {
  switch (reason) {
    case 'denied':
      return 'Location access was blocked. Allow location for this site in your browser settings, or pick your state from the dropdown.';
    case 'unsupported':
      return 'Location is not available in this browser.';
    case 'timeout':
      return 'Location timed out. Try again or pick your state manually.';
    case 'unavailable':
      return 'Could not read your location. Check that location services are on, then try again or pick your state manually.';
    default:
      return 'Could not read your location. Try again or pick your state manually.';
  }
}

function mapGeolocationError(error: GeolocationPositionError): BrowserLocationResult {
  switch (error.code) {
    case PERMISSION_DENIED:
      return { ok: false, reason: 'denied' };
    case POSITION_UNAVAILABLE:
      return { ok: false, reason: 'unavailable' };
    case TIMEOUT:
      return { ok: false, reason: 'timeout' };
    default:
      return { ok: false, reason: 'unknown' };
  }
}

function readBrowserLocationOnce(options: PositionOptions): Promise<BrowserLocationResult> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        resolve(mapGeolocationError(error));
      },
      options
    );
  });
}

async function readPermissionState(): Promise<PermissionState | null> {
  if (!navigator.permissions?.query) {
    return null;
  }

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return null;
  }
}

export async function readBrowserLocation(): Promise<BrowserLocationResult> {
  if (!navigator.geolocation) {
    return { ok: false, reason: 'unsupported' };
  }

  if (!window.isSecureContext) {
    return { ok: false, reason: 'unsupported' };
  }

  const permissionState = await readPermissionState();
  if (permissionState === 'denied') {
    return { ok: false, reason: 'denied' };
  }

  const attempts: PositionOptions[] = [
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 300_000 },
    { enableHighAccuracy: false, timeout: 25_000, maximumAge: 900_000 },
  ];

  let lastResult: BrowserLocationResult = { ok: false, reason: 'unknown' };

  for (const options of attempts) {
    const result = await readBrowserLocationOnce(options);
    if (result.ok) {
      return result;
    }

    lastResult = result;
    if (result.reason === 'denied') {
      return result;
    }
  }

  return lastResult;
}
