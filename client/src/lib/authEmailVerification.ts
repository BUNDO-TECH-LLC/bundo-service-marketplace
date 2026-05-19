import type { ActionCodeSettings } from 'firebase/auth';
import { sendEmailVerification, type User } from 'firebase/auth';

function verificationContinueUrl() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return `${window.location.origin}/`;
}

export function emailVerificationActionCodeSettings(): ActionCodeSettings | undefined {
  const url = verificationContinueUrl();
  if (!url) {
    return undefined;
  }

  return { url };
}

export async function sendBundoEmailVerification(user: User) {
  const settings = emailVerificationActionCodeSettings();
  if (settings) {
    await sendEmailVerification(user, settings);
    return;
  }

  await sendEmailVerification(user);
}
