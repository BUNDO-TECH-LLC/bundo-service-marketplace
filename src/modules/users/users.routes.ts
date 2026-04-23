import { Router } from 'express';
import { Role } from '@prisma/client';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { updateUserFcmToken, updateUserRole } from './users.service';

const router = Router();

router.patch('/role', verifyFirebaseToken, async (req, res) => {
  const { role } = req.body;

  if (![Role.CUSTOMER, Role.ARTISAN].includes(role)) {
    return res.status(400).json({
      message: 'Role must be CUSTOMER or ARTISAN',
    });
  }

  const user = await updateUserRole((req as any).user.firebaseUid, role);

  return res.json({
    message: 'Role updated',
    user,
  });
});

router.patch('/fcm-token', verifyFirebaseToken, async (req, res) => {
  const { fcmToken } = req.body;

  if (typeof fcmToken !== 'string' || !fcmToken.trim()) {
    return res.status(400).json({
      message: 'fcmToken is required',
    });
  }

  const user = await updateUserFcmToken(
    (req as any).user.firebaseUid,
    fcmToken.trim()
  );

  return res.json({
    message: 'FCM token updated',
    user,
  });
});

router.delete('/fcm-token', verifyFirebaseToken, async (req, res) => {
  const user = await updateUserFcmToken((req as any).user.firebaseUid, null);

  return res.json({
    message: 'FCM token removed',
    user,
  });
});

export default router;
