import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingVerificationRole,
  readPendingVerificationRole,
  resolveSignupIntent,
  savePendingVerificationRole,
  saveSessionSignupIntent,
} from './authSignupStorage';

describe('authSignupStorage', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        clear: () => {
          storage.clear();
        },
      },
      sessionStorage: {
        getItem: (key: string) => storage.get(`session:${key}`) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(`session:${key}`, value);
        },
        removeItem: (key: string) => {
          storage.delete(`session:${key}`);
        },
        clear: () => {
          for (const key of [...storage.keys()]) {
            if (key.startsWith('session:')) {
              storage.delete(key);
            }
          }
        },
      },
    });
  });

  it('prefers pending verification role over stale artisan session intent', () => {
    saveSessionSignupIntent('ARTISAN');
    savePendingVerificationRole('client@example.com', 'CUSTOMER');

    expect(resolveSignupIntent('client@example.com')).toBe('CUSTOMER');
  });

  it('clears pending verification role after email verification', () => {
    savePendingVerificationRole('client@example.com', 'CUSTOMER');
    clearPendingVerificationRole('client@example.com');

    expect(readPendingVerificationRole('client@example.com')).toBeNull();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
