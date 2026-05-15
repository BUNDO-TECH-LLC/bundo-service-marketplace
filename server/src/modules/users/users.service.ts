import db from '../../db/client';
import { Role } from '@prisma/client';

export const findOrCreateUser = async (firebaseUser: any) => {
  const { uid, email, phone_number } = firebaseUser;

  let user = await db.user.findUnique({
    where: { firebaseUid: uid },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        firebaseUid: uid,
        email: email || null,
        phone: phone_number || null,
        role: Role.CUSTOMER,
      },
    });
  }

  return user;
};

export const updateUserRole = async (firebaseUid: string, role: Role) => {
  const user = await db.user.findUnique({
    where: { firebaseUid },
  });

  if (!user) {
    return { status: 'missing_user' as const };
  }

  if (user.role === role) {
    return { status: 'updated' as const, user };
  }

  if (user.role === Role.ARTISAN && role === Role.CUSTOMER) {
    return { status: 'locked_role' as const };
  }

  if (user.role === Role.ADMIN) {
    return { status: 'locked_role' as const };
  }

  const updated = await db.user.update({
    where: { firebaseUid },
    data: { role },
  });

  return { status: 'updated' as const, user: updated };
};

export const updateUserFcmToken = async (
  firebaseUid: string,
  fcmToken: string | null
) => {
  return db.user.update({
    where: { firebaseUid },
    data: { fcmToken },
  });
};
