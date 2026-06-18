import type { User } from 'firebase/auth';
import { sendBundoEmailVerification } from './authEmailVerification';

const STORAGE_PREFIX = 'bundo:verify-email-sent:';
/** Avoid hammering Firebase when users tap Resend repeatedly. */
export const VERIFICATION_RESEND_COOLDOWN_MS = 60_000;

export function verificationResendWaitMs(firebaseUid?: string | null): number {
  if (typeof window === 'undefined' || !firebaseUid) {
    return 0;
  }

  const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${firebaseUid}`);
  if (!raw) {
    return 0;
  }

  const sentAt = Number(raw);
  if (!Number.isFinite(sentAt)) {
    return 0;
  }

  return Math.max(0, VERIFICATION_RESEND_COOLDOWN_MS - (Date.now() - sentAt));
}

export function markVerificationEmailSent(firebaseUid?: string | null) {
  if (typeof window === 'undefined' || !firebaseUid) {
    return;
  }

  window.sessionStorage.setItem(`${STORAGE_PREFIX}${firebaseUid}`, String(Date.now()));
}

export async function resendBundoEmailVerification(user: User) {
  const waitMs = verificationResendWaitMs(user.uid);
  if (waitMs > 0) {
    const seconds = Math.ceil(waitMs / 1000);
    throw new Error(`Please wait ${seconds} seconds before requesting another verification email.`);
  }

  await sendBundoEmailVerification(user);
  markVerificationEmailSent(user.uid);
}
