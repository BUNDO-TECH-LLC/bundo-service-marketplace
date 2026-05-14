const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

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

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new ApiError(
      `Could not reach the API at ${API_BASE_URL}. Make sure the backend server is running.`,
      0,
      { cause: error instanceof Error ? error.message : 'Network error' }
    );
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

  return data as T;
}
