import { Router } from 'express';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { env } from '../../config/env';
import {
  createNotification,
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.service';

const router = Router();

router.get('/', verifyFirebaseToken, async (req, res) => {
  const notifications = await getNotificationsForUser(
    (req as any).user.firebaseUid
  );

  return res.json({
    message: 'Notifications fetched',
    notifications,
  });
});

router.patch('/:id/read', verifyFirebaseToken, async (req, res) => {
  const result = await markNotificationRead({
    id: String(req.params.id),
    userId: (req as any).user.firebaseUid,
  });

  if (result.status === 'missing_notification') {
    return res.status(404).json({ message: 'Notification not found' });
  }

  if (result.status === 'forbidden') {
    return res
      .status(403)
      .json({ message: 'You can only update your own notifications' });
  }

  return res.json({
    message: 'Notification marked as read',
    notification: result.notification,
  });
});

router.patch('/read-all', verifyFirebaseToken, async (req, res) => {
  const notifications = await markAllNotificationsRead(
    (req as any).user.firebaseUid
  );

  return res.json({
    message: 'Notifications marked as read',
    notifications,
  });
});

router.post('/test', verifyFirebaseToken, async (req, res) => {
  if (env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }

  const userId = (req as any).user.firebaseUid;

  const notification = await createNotification({
    userId,
    type: 'ADMIN',
    title: 'Test notification from Bundo',
    body: 'This is a live check for your in-app feed and browser push alerts.',
    link: '/?view=workspace&section=notifications',
  });

  return res.status(201).json({
    message: 'Test notification sent',
    notification,
  });
});

export default router;
