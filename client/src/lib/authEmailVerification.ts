import type { ActionCodeSettings } from 'firebase/auth';
import { sendEmailVerification, sendPasswordResetEmail, type User } from 'firebase/auth';
import { auth } from './firebase';

function verificationContinueUrl() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return `${window.location.origin}/verify-email`;
}

export function emailVerificationActionCodeSettings(): ActionCodeSettings | undefined {
  const url = verificationContinueUrl();
  if (!url) {
    return undefined;
  }

  return { url, handleCodeInApp: false };
}

function formatVerificationSendError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code)
      : '';

  switch (code) {
    case 'auth/too-many-requests':
      return 'Too many verification emails requested. Wait a few minutes, then use Resend on the verification page.';
    case 'auth/unauthorized-continue-uri':
      return 'This site is not authorized for verification links in Firebase. Add your domain under Authentication → Settings → Authorized domains.';
    case 'auth/invalid-continue-uri':
      return 'Verification link settings are invalid. Check Firebase authorized domains for this app URL.';
    default:
      return error instanceof Error ? error.message : 'Could not send verification email.';
  }
}

function isContinueUriError(error: unknown) {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code)
      : '';
  return code === 'auth/unauthorized-continue-uri' || code === 'auth/invalid-continue-uri';
}

export async function sendBundoEmailVerification(user: User) {
  try {
    const settings = emailVerificationActionCodeSettings();
    if (settings) {
      await sendEmailVerification(user, settings);
      return;
    }

    await sendEmailVerification(user);
  } catch (error) {
    if (isContinueUriError(error)) {
      try {
        await sendEmailVerification(user);
        return;
      } catch (fallbackError) {
        throw new Error(formatVerificationSendError(fallbackError));
      }
    }

    throw new Error(formatVerificationSendError(error));
  }
}

/** Where users land after completing the reset link from their email. */
export function passwordResetActionCodeSettings(): ActionCodeSettings | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return { url: `${window.location.origin}/login`, handleCodeInApp: false };
}

export async function sendBundoPasswordResetEmail(email: string) {
  if (!auth) {
    throw new Error('Firebase is not configured for this environment.');
  }

  const settings = passwordResetActionCodeSettings();

  try {
    if (settings) {
      await sendPasswordResetEmail(auth, email.trim(), settings);
      return;
    }

    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    if (isContinueUriError(error)) {
      await sendPasswordResetEmail(auth, email.trim());
      return;
    }

    throw error;
  }
}
