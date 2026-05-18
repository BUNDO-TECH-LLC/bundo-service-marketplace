import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export const requireRole = (role: Role) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return next(new UnauthorizedError());
    }

    if (user.role !== role) {
      return next(new ForbiddenError(`${role} role required`));
    }

    next();
  };
};
