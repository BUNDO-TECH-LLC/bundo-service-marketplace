const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';
const API_TIMEOUT_MS = 25_000;

const GET_CACHE_TTL_MS: Record<string, number> = {
  '/categories': 5 * 60_000,
};

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
  const ttl = GET_CACHE_TTL_MS[path];
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
  const ttl = GET_CACHE_TTL_MS[path];
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

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const cached = method === 'GET' ? readGetCache<T>(path, options.token) : null;

  if (cached !== null) {
    return cached;
  }

  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  let response: Response;
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_TIMEOUT_MS);

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
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new ApiError(
        `The API took too long to respond. Check your connection and try again.`,
        0,
        { timeoutMs: API_TIMEOUT_MS }
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
    writeGetCache(path, options.token, data);
  }

  return data as T;
}
