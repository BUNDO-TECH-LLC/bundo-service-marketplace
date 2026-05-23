import { NotificationType } from '@prisma/client';
import admin from '../../config/firebase';
import db from '../../db/client';
import { getUserNotificationPreferences } from '../users/users.service';

async function filterByNotificationPreferences(
  inputs: Array<{
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    link?: string;
  }>
) {
  if (!inputs.length) {
    return [];
  }

  const userIds = [...new Set(inputs.map((input) => input.userId))];
  let prefMap = new Map<string, ReturnType<typeof getUserNotificationPreferences>>();

  try {
    const users = await db.user.findMany({
      where: { firebaseUid: { in: userIds } },
      select: { firebaseUid: true, notificationPreferences: true },
    });
    prefMap = new Map(
      users.map((user) => [user.firebaseUid, getUserNotificationPreferences(user)])
    );
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: string }).code)
        : '';
    // Pre-migration databases without notification_preferences still deliver notifications.
    if (code !== 'P2022') {
      throw error;
    }
  }

  return inputs.filter((input) => {
    const prefs = prefMap.get(input.userId);
    if (!prefs) {
      return true;
    }

    switch (input.type) {
      case NotificationType.BOOKING:
      case NotificationType.PAYMENT:
      case NotificationType.DISPUTE:
        return prefs.bookings;
      case NotificationType.MESSAGE:
        return prefs.messages;
      case NotificationType.REVIEW:
        return prefs.bookings;
      case NotificationType.ADMIN:
        return true;
      default:
        return prefs.marketing;
    }
  });
}

const deliverPushNotifications = async (
  inputs: Array<{
    userId: string;
    title: string;
    body: string;
    link?: string;
  }>
) => {
  if (!inputs.length) {
    return;
  }

  const userIds = [...new Set(inputs.map((input) => input.userId))];
  const users = await db.user.findMany({
    where: {
      firebaseUid: { in: userIds },
      fcmToken: { not: null },
    },
    select: {
      firebaseUid: true,
      fcmToken: true,
    },
  });

  const tokenMap = new Map(
    users
      .filter((user) => Boolean(user.fcmToken))
      .map((user) => [user.firebaseUid, user.fcmToken as string])
  );

  const deliveries = inputs
    .map((input) => {
      const token = tokenMap.get(input.userId);

      if (!token) {
        return null;
      }

      return admin
        .messaging()
        .send({
          token,
          notification: {
            title: input.title,
            body: input.body,
          },
          data: {
            link: input.link || '',
          },
        })
        .catch(async (error: any) => {
          const code = error?.errorInfo?.code || error?.code;

          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            await db.user.update({
              where: { firebaseUid: input.userId },
              data: { fcmToken: null },
            });
          }
        });
    })
    .filter(Boolean);

  await Promise.allSettled(deliveries);
};

export const createNotification = async (input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}) => {
  const [allowed] = await filterByNotificationPreferences([input]);

  if (!allowed) {
    return null;
  }

  const notification = await db.notification.create({
    data: allowed,
  });

  await deliverPushNotifications([allowed]);

  return notification;
};

export const createNotifications = async (
  inputs: Array<{
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    link?: string;
  }>
) => {
  if (!inputs.length) {
    return;
  }

  const allowed = await filterByNotificationPreferences(inputs);

  if (!allowed.length) {
    return;
  }

  await db.notification.createMany({
    data: allowed,
  });

  await deliverPushNotifications(allowed);
};

export const getNotificationsForUser = async (userId: string) => {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
};

export const markNotificationRead = async (input: {
  id: string;
  userId: string;
}) => {
  const notification = await db.notification.findUnique({
    where: { id: input.id },
  });

  if (!notification) {
    return { status: 'missing_notification' as const };
  }

  if (notification.userId !== input.userId) {
    return { status: 'forbidden' as const };
  }

  const updated = await db.notification.update({
    where: { id: input.id },
    data: {
      readAt: notification.readAt || new Date(),
    },
  });

  return { status: 'updated' as const, notification: updated };
};

export const markAllNotificationsRead = async (userId: string) => {
  await db.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return getNotificationsForUser(userId);
};
