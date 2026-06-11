import { describe, expect, it, vi, afterEach } from 'vitest';
import { readBrowserLocation } from './geolocation';

describe('readBrowserLocation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps permission denied using numeric error codes', async () => {
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_success: unknown, error: (err: { code: number }) => void) => {
          error({ code: 1 });
        },
      },
      permissions: {
        query: vi.fn().mockResolvedValue({ state: 'prompt' }),
      },
    });

    const result = await readBrowserLocation();
    expect(result).toEqual({ ok: false, reason: 'denied' });
  });

  it('retries with a second attempt after position unavailable', async () => {
    vi.stubGlobal('window', { isSecureContext: true });
    let attempt = 0;
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: (position: { coords: { latitude: number; longitude: number } }) => void, error: (err: { code: number }) => void) => {
          attempt += 1;
          if (attempt === 1) {
            error({ code: 2 });
            return;
          }
          success({ coords: { latitude: 6.5244, longitude: 3.3792 } });
        },
      },
      permissions: {
        query: vi.fn().mockResolvedValue({ state: 'granted' }),
      },
    });

    const result = await readBrowserLocation();
    expect(result).toEqual({ ok: true, lat: 6.5244, lng: 3.3792 });
    expect(attempt).toBe(2);
  });
});
