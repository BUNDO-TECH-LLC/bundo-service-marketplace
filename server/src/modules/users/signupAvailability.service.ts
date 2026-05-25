import admin from '../../config/firebase';
import db from '../../db/client';
import { ConflictError } from '../../utils/errors';
import { normalizePhoneInput } from './users.service';

export const SIGNUP_EMAIL_IN_USE_MESSAGE =
  'An account already exists with this email. Sign in instead, or use Forgot password if you do not remember it.';

export const SIGNUP_PHONE_IN_USE_MESSAGE =
  'This phone number is already linked to another Bundo account. Sign in with that account or use a different number.';

function isFirebaseUserNotFound(error: unknown) {
  return (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'auth/user-not-found'
  );
}

export async function assertEmailAvailableForSignup(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new ConflictError(SIGNUP_EMAIL_IN_USE_MESSAGE, 'EMAIL_IN_USE');
  }

  try {
    await admin.auth().getUserByEmail(normalizedEmail);
    throw new ConflictError(SIGNUP_EMAIL_IN_USE_MESSAGE, 'EMAIL_IN_USE');
  } catch (error) {
    if (error instanceof ConflictError) {
      throw error;
    }

    if (isFirebaseUserNotFound(error)) {
      return;
    }

    throw error;
  }
}

export async function assertPhoneAvailableForSignup(phone: string) {
  const normalizedPhone = normalizePhoneInput(phone);

  const existingUser = await db.user.findFirst({
    where: { phone: normalizedPhone },
  });

  if (existingUser) {
    throw new ConflictError(SIGNUP_PHONE_IN_USE_MESSAGE, 'PHONE_IN_USE');
  }
}
