import { Request, Response, NextFunction } from 'express';
import admin from '../config/firebase';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/** Blocks sensitive actions until Firebase marks the email verified. */
export const requireVerifiedEmail = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError());
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const decoded = await admin.auth().verifyIdToken(token, true);

    if (!decoded.email_verified) {
      return next(
        new ForbiddenError(
          'Verify your email before booking or paying. Check your inbox for the verification link.'
        )
      );
    }

    next();
  } catch {
    return next(new UnauthorizedError('Invalid token'));
  }
};
