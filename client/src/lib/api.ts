const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';
const API_TIMEOUT_MS = 25_000;
export const AUTH_API_TIMEOUT_MS = 60_000;
/** Public marketplace bootstrap can hit a cold Render instance on first load. */
export const PUBLIC_API_TIMEOUT_MS = 60_000;

const GET_CACHE_TTL_MS: Record<string, number> = {
  '/categories': 5 * 60_000,
};

/**
 * Prefix-based cache TTLs for public listing endpoints that carry query strings
 * (so they can't be matched by the exact-path map above). Short TTL keeps the
 * marketplace responsive while bounding staleness; mutations call invalidateApiCache.
 */
const GET_CACHE_TTL_PREFIXES: Array<{ prefix: string; ttl: number }> = [
  { prefix: '/offerings', ttl: 60_000 },
  { prefix: '/artisans', ttl: 60_000 },
];

function resolveGetCacheTtl(path: string, token?: string): number | undefined {
  if (GET_CACHE_TTL_MS[path]) {
    return GET_CACHE_TTL_MS[path];
  }
  // Prefix caching only applies to anonymous requests, which are exactly the
  // public marketplace calls. Authed reads under these prefixes (e.g. /artisans/me,
  // /offerings/me) must never be cached so personal data stays fresh.
  if (token) {
    return undefined;
  }
  const match = GET_CACHE_TTL_PREFIXES.find(
    (entry) => path === entry.prefix || path.startsWith(`${entry.prefix}?`) || path.startsWith(`${entry.prefix}/`)
  );
  return match?.ttl;
}

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

const getCache = new Map<string, CacheEntry>();

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: unknown
  ) {
    super(message);
  }
}

function parseJsonResponse(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function getCacheKey(path: string, token?: string) {
  return token ? `${path}::${token.slice(-12)}` : path;
}

function readGetCache<T>(path: string, token?: string): T | null {
  const ttl = resolveGetCacheTtl(path, token);
  if (!ttl) {
    return null;
  }

  const entry = getCache.get(getCacheKey(path, token));
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) {
      getCache.delete(getCacheKey(path, token));
    }
    return null;
  }

  return entry.data as T;
}

function writeGetCache(path: string, token: string | undefined, data: unknown) {
  const ttl = resolveGetCacheTtl(path, token);
  if (!ttl) {
    return;
  }

  getCache.set(getCacheKey(path, token), {
    data,
    expiresAt: Date.now() + ttl,
  });
}

export function invalidateApiCache(prefix?: string) {
  if (!prefix) {
    getCache.clear();
    return;
  }

  for (const key of getCache.keys()) {
    if (key.startsWith(prefix)) {
      getCache.delete(key);
    }
  }
}

// Coalesces concurrent identical GETs (same path + token) so multiple components
// mounting at once don't each fire the same request.
const inFlightGets = new Map<string, Promise<unknown>>();

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string; timeoutMs?: number } = {}
): Promise<T> {
  const { token } = options;
  const method = (options.method ?? 'GET').toUpperCase();
  const cached = method === 'GET' ? readGetCache<T>(path, token) : null;

  if (cached !== null) {
    return cached;
  }

  // Dedupe only plain GETs without an external abort signal (sharing a promise
  // across consumers must not let one consumer's abort cancel another's request).
  if (method === 'GET' && !options.signal) {
    const key = getCacheKey(path, token);
    const existing = inFlightGets.get(key);
    if (existing) {
      return existing as Promise<T>;
    }
    const promise = executeRequest<T>(path, options).finally(() => {
      inFlightGets.delete(key);
    });
    inFlightGets.set(key, promise);
    return promise;
  }

  return executeRequest<T>(path, options);
}

async function executeRequest<T>(
  path: string,
  options: RequestInit & { token?: string; timeoutMs?: number } = {}
): Promise<T> {
  const { token, timeoutMs, ...fetchOptions } = options;
  const method = (options.method ?? 'GET').toUpperCase();

  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs ?? API_TIMEOUT_MS);

  const externalSignal = options.signal;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new ApiError(
        `The API took too long to respond. Check your connection and try again.`,
        0,
        { timeoutMs: timeoutMs ?? API_TIMEOUT_MS }
      );
    }

    throw new ApiError(
      `Could not reach the API at ${API_BASE_URL}. Make sure the backend server is running.`,
      0,
      { cause: error instanceof Error ? error.message : 'Network error' }
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  const text = await response.text();
  const data = parseJsonResponse(text);

  if (data === null && text.trim()) {
    throw new ApiError(
      `Invalid response from API (${response.status}). The server may be down or returning non-JSON.`,
      response.status,
      { rawPreview: text.slice(0, 500) }
    );
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data && typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : 'Request failed';
    throw new ApiError(message, response.status, data);
  }

  if (method === 'GET') {
    writeGetCache(path, token, data);
  }

  return data as T;
}
