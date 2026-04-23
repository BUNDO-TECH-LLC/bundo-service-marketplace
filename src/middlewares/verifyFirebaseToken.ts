import { Request, Response, NextFunction } from 'express';
import { UserStatus } from '@prisma/client';
import admin from '../config/firebase';
import { findOrCreateUser } from '../modules/users/users.service';
import logger from '../utils/logger';

export const verifyFirebaseToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;

  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch (error) {
    logger.warn({ error }, 'Firebase token verification failed');
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    const user = await findOrCreateUser(decoded);

    if (user.status === UserStatus.BANNED) {
      return res.status(403).json({ message: 'Account banned' });
    }

    (req as any).user = user;

    next();
  } catch (error) {
    logger.error({ error, firebaseUid: decoded.uid }, 'Failed to sync authenticated user');
    return res.status(500).json({ message: 'Could not finish account sync' });
  }
};
