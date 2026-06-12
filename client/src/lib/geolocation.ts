export type BrowserLocationResult =
  | { ok: true; lat: number; lng: number }
  | {
      ok: false;
      reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown';
      permissionGranted?: boolean;
    };

export type UseMyLocationResult =
  | { ok: true; state: string; lat: number; lng: number }
  | {
      ok: false;
      reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown';
      permissionGranted?: boolean;
    };

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

type LocationFailureReason = Exclude<BrowserLocationResult, { ok: true }>['reason'];

export function locationErrorMessage(
  reason: LocationFailureReason,
  options?: { permissionGranted?: boolean }
) {
  switch (reason) {
    case 'denied':
      return 'Location access was blocked. Allow location for this site in your browser settings, or pick your state from the dropdown.';
    case 'unsupported':
      return 'Location is not available in this browser.';
    case 'timeout':
      return 'Location timed out. Try again or pick your state manually.';
    case 'unavailable':
      if (options?.permissionGranted) {
        return 'This site can use location, but your device did not return coordinates. On Mac, open System Settings → Privacy & Security → Location Services, turn on Location Services, and allow Google Chrome. Keep Wi‑Fi on, then try again—or pick your state manually.';
      }
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

function readBrowserLocationWatch(
  options: PositionOptions,
  watchTimeoutMs = 25_000
): Promise<BrowserLocationResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = 0;
    let watchId = 0;

    const finish = (result: BrowserLocationResult) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      navigator.geolocation.clearWatch(watchId);
      resolve(result);
    };

    timeoutId = window.setTimeout(() => {
      finish({ ok: false, reason: 'timeout' });
    }, watchTimeoutMs);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        finish({
          ok: true,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        finish(mapGeolocationError(error));
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

function withPermissionContext(
  result: BrowserLocationResult,
  permissionState: PermissionState | null
): BrowserLocationResult {
  if (result.ok || result.reason === 'denied') {
    return result;
  }

  if (permissionState === 'granted') {
    return { ...result, permissionGranted: true };
  }

  return result;
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

  // Network/Wi‑Fi positioning works better on laptops than GPS-first requests.
  const attempts: PositionOptions[] = [
    { enableHighAccuracy: false, timeout: 20_000, maximumAge: 900_000 },
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 300_000 },
    { enableHighAccuracy: false, timeout: 30_000, maximumAge: 0 },
  ];

  let lastResult: BrowserLocationResult = { ok: false, reason: 'unknown' };

  for (const options of attempts) {
    const result = await readBrowserLocationOnce(options);
    if (result.ok) {
      return result;
    }

    lastResult = result;
    if (result.reason === 'denied') {
      return withPermissionContext(result, permissionState);
    }
  }

  const watchResult = await readBrowserLocationWatch(
    { enableHighAccuracy: false, timeout: 30_000, maximumAge: 0 },
    25_000
  );
  if (watchResult.ok) {
    return watchResult;
  }

  return withPermissionContext(watchResult.ok ? watchResult : lastResult, permissionState);
}
