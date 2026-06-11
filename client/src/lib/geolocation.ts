export type BrowserLocationResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown' };

export type UseMyLocationResult =
  | { ok: true; state: string; lat: number; lng: number }
  | { ok: false; reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown' };

export function locationErrorMessage(
  reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown'
) {
  switch (reason) {
    case 'denied':
      return 'Location access was blocked. Pick your state from the dropdown or allow location in browser settings.';
    case 'unsupported':
      return 'Location is not available in this browser.';
    case 'timeout':
      return 'Location timed out. Try again or pick your state manually.';
    case 'unavailable':
      return 'Could not read your location. Pick your state manually.';
    default:
      return 'Could not read your location. Pick your state manually.';
  }
}

export function readBrowserLocation(
  options: PositionOptions = { enableHighAccuracy: false, timeout: 12_000 }
): Promise<BrowserLocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ok: false, reason: 'unsupported' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ ok: false, reason: 'denied' });
          return;
        }
        if (error.code === error.TIMEOUT) {
          resolve({ ok: false, reason: 'timeout' });
          return;
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          resolve({ ok: false, reason: 'unavailable' });
          return;
        }
        resolve({ ok: false, reason: 'unknown' });
      },
      options
    );
  });
}
