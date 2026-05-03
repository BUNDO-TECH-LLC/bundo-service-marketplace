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
      },
    });
  }

  return user;
};

export const updateUserRole = async (firebaseUid: string, role: Role) => {
  return db.user.update({
    where: { firebaseUid },
    data: { role },
  });
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
