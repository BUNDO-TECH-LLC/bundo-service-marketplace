import { Router } from 'express';
import { Role } from '@prisma/client';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { asyncHandler } from '../../middlewares/errorHandler';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { throwOnServiceStatus } from '../../utils/resultErrors';
import { updateUserFcmToken, updateUserRole } from './users.service';

const router = Router();

router.patch(
  '/role',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { role } = req.body;

    if (![Role.CUSTOMER, Role.ARTISAN].includes(role)) {
      throw new ValidationError('Role must be CUSTOMER or ARTISAN');
    }

    const result = await updateUserRole((req as any).user.firebaseUid, role);

    throwOnServiceStatus(result.status, {
      missing_user: new NotFoundError('User'),
      locked_role: new ConflictError(
        'This role change requires admin support. Artisan accounts remain under verification control.',
        'LOCKED_ROLE'
      ),
    });

    res.json({
      message: 'Role updated',
      user: result.user,
    });
  })
);

router.patch(
  '/fcm-token',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { fcmToken } = req.body;

    if (typeof fcmToken !== 'string' || !fcmToken.trim()) {
      throw new ValidationError('fcmToken is required');
    }

    const user = await updateUserFcmToken((req as any).user.firebaseUid, fcmToken.trim());

    res.json({
      message: 'FCM token updated',
      user,
    });
  })
);

router.delete(
  '/fcm-token',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const user = await updateUserFcmToken((req as any).user.firebaseUid, null);

    res.json({
      message: 'FCM token removed',
      user,
    });
  })
);

export default router;
