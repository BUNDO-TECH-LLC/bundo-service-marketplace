import { Prisma, Role } from '@prisma/client';
import db from '../../db/client';
import { ConflictError } from '../../utils/errors';

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
        role: Role.CUSTOMER,
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

export const updateUserProfile = async (
  firebaseUid: string,
  input: { phone?: string | null }
) => {
  const data: { phone?: string | null } = {};

  if (input.phone !== undefined) {
    data.phone = input.phone;
  }

  if (!Object.keys(data).length) {
    return { status: 'no_fields' as const };
  }

  const user = await db.user.update({
    where: { firebaseUid },
    data,
  });

  return { status: 'updated' as const, user };
};
