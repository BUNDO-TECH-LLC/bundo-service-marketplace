import { Request, Response, NextFunction } from 'express';
import { UserStatus } from '@prisma/client';
import admin from '../config/firebase';
import { findOrCreateUser } from '../modules/users/users.service';

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

  try {
    const decoded = await admin.auth().verifyIdToken(token);

    // 🔥 Sync user with DB
    const user = await findOrCreateUser(decoded);

    if (user.status === UserStatus.BANNED) {
      return res.status(403).json({ message: 'Account banned' });
    }

    (req as any).user = user;

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
