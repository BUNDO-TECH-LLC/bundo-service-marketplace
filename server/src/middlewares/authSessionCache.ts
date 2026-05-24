import crypto from 'node:crypto';
import type { User } from '@prisma/client';

type CacheEntry = {
  user: User;
  expiresAt: number;
};

const TTL_MS = 60_000;
const MAX_ENTRIES = 500;
const cache = new Map<string, CacheEntry>();

function tokenKey(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getCachedAuthUser(token: string): User | null {
  const entry = cache.get(tokenKey(token));

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(tokenKey(token));
    return null;
  }

  return entry.user;
}

export function setCachedAuthUser(token: string, user: User) {
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(tokenKey(token), {
    user,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function invalidateCachedAuthUser(firebaseUid: string) {
  for (const [key, entry] of cache.entries()) {
    if (entry.user.firebaseUid === firebaseUid) {
      cache.delete(key);
    }
  }
}
