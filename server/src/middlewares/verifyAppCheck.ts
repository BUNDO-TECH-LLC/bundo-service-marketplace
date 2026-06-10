import { NextFunction, Request, Response } from 'express';
import { getAppCheck } from 'firebase-admin/app-check';
import { env } from '../config/env';
import { ForbiddenError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * When FIREBASE_APP_CHECK_ENFORCE=true, requires a valid Firebase App Check token
 * on authenticated API routes. Skip health/readiness and Paystack webhooks.
 */
export async function verifyAppCheck(req: Request, _res: Response, next: NextFunction) {
  if (!env.FIREBASE_APP_CHECK_ENFORCE) {
    return next();
  }

  const requestPath = req.path || req.url.split('?')[0] || '';
  if (
    ['/health', '/ready'].includes(requestPath) ||
    requestPath.includes('/webhooks/paystack')
  ) {
    return next();
  }

  const token = req.header('X-Firebase-AppCheck');
  if (!token?.trim()) {
    return next(new ForbiddenError('App Check token required'));
  }

  try {
    await getAppCheck().verifyToken(token.trim());
    return next();
  } catch (error) {
    logger.warn({ error, path: requestPath }, 'Firebase App Check verification failed');
    return next(new ForbiddenError('Invalid App Check token'));
  }
}
