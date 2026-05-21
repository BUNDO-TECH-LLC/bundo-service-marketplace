import { Role } from '@prisma/client';
import { getArtisanProfileByUserId } from '../modules/artisans/artisans.service';
import { ForbiddenError } from '../utils/errors';

/** Lets approved artisans and customers in the artisan onboarding pipeline use self-service artisan routes. */
export const requireArtisanOrApplicant = async (
  req: { user?: { firebaseUid: string; role: Role | null }; method: string; path: string },
  _res: unknown,
  next: (error?: unknown) => void
) => {
  const user = req.user;

  if (!user) {
    return next(new ForbiddenError('Authentication required'));
  }

  if (user.role === Role.ARTISAN || user.role === Role.ADMIN) {
    return next();
  }

  if (user.role !== Role.CUSTOMER) {
    return next(
      new ForbiddenError('Complete artisan verification before accessing provider tools.')
    );
  }

  const profile = await getArtisanProfileByUserId(user.firebaseUid);
  const isProfileCreate = req.method === 'POST' && req.path === '/profile';

  if (profile || isProfileCreate) {
    return next();
  }

  return next(
    new ForbiddenError('Start your artisan application from account settings before using provider tools.')
  );
};
