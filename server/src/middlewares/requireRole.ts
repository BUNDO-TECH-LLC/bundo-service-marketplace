import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';

export const requireRole = (role: Role) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (user.role !== role) {
      return res.status(403).json({ message: `${role} role required` });
    }

    next();
  };
};
