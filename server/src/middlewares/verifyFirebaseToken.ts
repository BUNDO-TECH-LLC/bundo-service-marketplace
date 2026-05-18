import { Request, Response, NextFunction } from 'express';
import { UserStatus } from '@prisma/client';
import admin from '../config/firebase';
import { findOrCreateUser } from '../modules/users/users.service';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import logger from '../utils/logger';

export const verifyFirebaseToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError());
  }

  const token = authHeader.slice('Bearer '.length);
  let decoded;

  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch (error: unknown) {
    logger.warn({ error }, 'Firebase token verification failed');
    return next(new UnauthorizedError('Invalid token'));
  }

  try {
    const user = await findOrCreateUser(decoded);

    if (user.status === UserStatus.BANNED) {
      return next(new ForbiddenError('Account banned'));
    }

    (req as any).user = user;

    next();
  } catch (error: unknown) {
    logger.error({ error, firebaseUid: decoded.uid }, 'Failed to sync authenticated user');
    next(error);
  }
};
