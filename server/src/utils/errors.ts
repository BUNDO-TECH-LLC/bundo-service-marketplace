// src/utils/errors.ts
// ─────────────────────────────────────────────
// Custom error classes for the Bundo API.
// Every thrown error in a controller should be
// one of these. The global error handler in
// server.ts catches them and formats the response.
// ─────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'AppError';
    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 — caller sent bad data
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

// 401 — no valid token / not logged in
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

// 403 — logged in but wrong role / banned
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

// 404 — resource doesn't exist
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

// 409 — conflict (e.g. duplicate review on same booking)
export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT') {
    super(message, 409, code);
  }
}

// 502 — upstream provider failure (e.g. Paystack)
export class BadGatewayError extends AppError {
  constructor(message: string, code = 'BAD_GATEWAY') {
    super(message, 502, code);
  }
}

// 503 — required integration not configured
export class ServiceUnavailableError extends AppError {
  constructor(message: string, code = 'SERVICE_UNAVAILABLE') {
    super(message, 503, code);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

const defaultCodes: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
};

/** Preserve legacy route messages while migrating to thrown errors. */
export function httpError(statusCode: number, message: string, code?: string) {
  return new AppError(message, statusCode, code ?? defaultCodes[statusCode] ?? 'HTTP_ERROR');
}