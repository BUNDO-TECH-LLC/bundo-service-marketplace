import { Prisma, Role, UserStatus } from '@prisma/client';
import db from '../../db/client';
import {
  defaultNotificationPreferences,
  parseNotificationPreferences,
  type NotificationPreferences,
} from '../../lib/notificationPreferences';
import { ConflictError, ValidationError } from '../../utils/errors';

function normalizeEmail(email?: string | null) {
  const trimmed = email?.trim();
  return trimmed ? trimmed : null;
}

function normalizePhone(phone?: string | null) {
  const trimmed = phone?.trim();
  return trimmed ? trimmed : null;
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  );
}

export const findOrCreateUser = async (firebaseUser: {
  uid: string;
  email?: string | null;
  phone_number?: string | null;
}) => {
  const { uid } = firebaseUser;
  const normalizedEmail = normalizeEmail(firebaseUser.email);
  const normalizedPhone = normalizePhone(firebaseUser.phone_number);

  const existing = await db.user.findUnique({
    where: { firebaseUid: uid },
  });

  if (existing) {
    const updates: { email?: string | null; phone?: string | null } = {};

    if (normalizedEmail && existing.email !== normalizedEmail) {
      updates.email = normalizedEmail;
    }

    if (normalizedPhone && existing.phone !== normalizedPhone) {
      updates.phone = normalizedPhone;
    }

    if (!Object.keys(updates).length) {
      return existing;
    }

    try {
      return await db.user.update({
        where: { firebaseUid: uid },
        data: updates,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(
          'This email or phone is already linked to another Bundo account. Try logging in instead.',
          'ACCOUNT_EXISTS'
        );
      }

      throw error;
    }
  }

  if (normalizedEmail) {
    const byEmail = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (byEmail) {
      try {
        return await db.user.update({
          where: { email: normalizedEmail },
          data: {
            firebaseUid: uid,
            ...(normalizedPhone ? { phone: normalizedPhone } : {}),
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ConflictError(
            'This email is already linked to another Bundo account. Try logging in instead.',
            'ACCOUNT_EXISTS'
          );
        }

        throw error;
      }
    }
  }

  try {
    return await db.user.create({
      data: {
        firebaseUid: uid,
        email: normalizedEmail,
        phone: normalizedPhone,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      if (normalizedEmail) {
        const byEmail = await db.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (byEmail) {
          return db.user.update({
            where: { email: normalizedEmail },
            data: {
              firebaseUid: uid,
              ...(normalizedPhone ? { phone: normalizedPhone } : {}),
            },
          });
        }
      }

      throw new ConflictError(
        'An account with this email or phone already exists. Try logging in instead.',
        'ACCOUNT_EXISTS'
      );
    }

    throw error;
  }
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

function normalizePhoneInput(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) {
    throw new ValidationError('Phone number is required');
  }

  const digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new ValidationError('Enter a valid phone number (10–15 digits).');
  }

  return digits.startsWith('+') ? digits : `+${digits.replace(/^\+/, '')}`;
}

export const updateUserPhone = async (firebaseUid: string, phone: string) => {
  const normalizedPhone = normalizePhoneInput(phone);

  try {
    return await db.user.update({
      where: { firebaseUid },
      data: { phone: normalizedPhone },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError(
        'This phone number is already linked to another Bundo account.',
        'PHONE_IN_USE'
      );
    }

    throw error;
  }
};

export const getUserNotificationPreferences = (user: {
  notificationPreferences?: unknown | null;
}): NotificationPreferences =>
  parseNotificationPreferences(user.notificationPreferences);

export const updateUserNotificationPreferences = async (
  firebaseUid: string,
  prefs: Partial<NotificationPreferences>
) => {
  const user = await db.user.findUnique({ where: { firebaseUid } });

  if (!user) {
    return { status: 'missing_user' as const };
  }

  const current = getUserNotificationPreferences(user);
  const next = {
    ...current,
    ...prefs,
  };

  const updated = await db.user.update({
    where: { firebaseUid },
    data: { notificationPreferences: next },
  });

  return {
    status: 'updated' as const,
    user: updated,
    preferences: getUserNotificationPreferences(updated),
  };
};

export const deleteUserAccount = async (firebaseUid: string) => {
  const user = await db.user.findUnique({ where: { firebaseUid } });

  if (!user) {
    return { status: 'missing_user' as const };
  }

  if (user.role === Role.ADMIN) {
    return { status: 'locked_role' as const };
  }

  const anonymizedEmail = `deleted+${firebaseUid}@bundo.invalid`;

  await db.user.update({
    where: { firebaseUid },
    data: {
      status: UserStatus.BANNED,
      email: anonymizedEmail,
      phone: null,
      fcmToken: null,
      notificationPreferences: Prisma.JsonNull,
    },
  });

  return { status: 'deleted' as const };
};

export function serializeUser(user: {
  firebaseUid: string;
  email: string | null;
  phone: string | null;
  role: Role | null;
  status: string;
  notificationPreferences?: unknown | null;
}) {
  return {
    firebaseUid: user.firebaseUid,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    notificationPreferences: getUserNotificationPreferences(user),
  };
}
