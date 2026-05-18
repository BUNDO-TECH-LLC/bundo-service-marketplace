import { Router } from 'express';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { env } from '../../config/env';
import { workspaceLink } from '../../lib/appLinks';
import { asyncHandler } from '../../middlewares/errorHandler';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import { throwOnServiceStatus } from '../../utils/resultErrors';
import {
  createNotification,
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.service';

const router = Router();

router.get(
  '/',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const notifications = await getNotificationsForUser((req as any).user.firebaseUid);

    res.json({
      message: 'Notifications fetched',
      notifications,
    });
  })
);

router.patch(
  '/:id/read',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const result = await markNotificationRead({
      id: String(req.params.id),
      userId: (req as any).user.firebaseUid,
    });

    throwOnServiceStatus(result.status, {
      missing_notification: new NotFoundError('Notification'),
      forbidden: new ForbiddenError('You can only update your own notifications'),
    });

    res.json({
      message: 'Notification marked as read',
      notification: result.notification,
    });
  })
);

router.patch(
  '/read-all',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const notifications = await markAllNotificationsRead((req as any).user.firebaseUid);

    res.json({
      message: 'Notifications marked as read',
      notifications,
    });
  })
);

router.post(
  '/test',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    if (env.NODE_ENV === 'production') {
      throw new NotFoundError('Route');
    }

    const userId = (req as any).user.firebaseUid;

    const notification = await createNotification({
      userId,
      type: 'ADMIN',
      title: 'Test notification from Bundo',
      body: 'This is a live check for your in-app feed and browser push alerts.',
      link: workspaceLink('notifications'),
    });

    res.status(201).json({
      message: 'Test notification sent',
      notification,
    });
  })
);

export default router;
