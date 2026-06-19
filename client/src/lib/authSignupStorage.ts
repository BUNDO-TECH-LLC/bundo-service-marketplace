import type { SignupRole } from '../appTypes';
import type { User } from 'firebase/auth';

const pendingSignupRoleStorageKey = 'bundo:pending-signup-role';
const pendingSignupPhoneStorageKey = 'bundo:pending-signup-phone';
const pendingSignupIntentStorageKey = 'bundo:pending-signup-intent';
const pendingVerificationRoleStorageKey = 'bundo:pending-verification-role';
const sessionSignupIntentStorageKey = 'bundo:session-signup-intent';
const googleRedirectIntentStorageKey = 'bundo:google-redirect-intent';
const GOOGLE_REDIRECT_INTENT_TTL_MS = 10 * 60_000;

export type GoogleRedirectIntent = {
  mode: 'login' | 'signup';
  role: SignupRole | null;
  phone: string | null;
  displayName: string | null;
  createdAt: number;
};

function pendingSignupRoleKey(emailAddress: string) {
  return `${pendingSignupRoleStorageKey}:${emailAddress.trim().toLowerCase()}`;
}

function pendingSignupPhoneKey(emailAddress: string) {
  return `${pendingSignupPhoneStorageKey}:${emailAddress.trim().toLowerCase()}`;
}

function pendingSignupIntentKey(emailAddress: string) {
  return `${pendingSignupIntentStorageKey}:${emailAddress.trim().toLowerCase()}`;
}

function pendingVerificationRoleKey(emailAddress: string) {
  return `${pendingVerificationRoleStorageKey}:${emailAddress.trim().toLowerCase()}`;
}

export function savePendingSignupRole(emailAddress: string | null, role: SignupRole | null) {
  if (!emailAddress || !role) return;
  window.localStorage.setItem(pendingSignupRoleKey(emailAddress), role);
}

export function readPendingSignupRole(emailAddress: string | null) {
  if (!emailAddress) return null;
  const storedRole = window.localStorage.getItem(pendingSignupRoleKey(emailAddress));
  return storedRole === 'CUSTOMER' || storedRole === 'ARTISAN' ? storedRole : null;
}

export function clearPendingSignupRole(emailAddress: string | null) {
  if (!emailAddress) return;
  window.localStorage.removeItem(pendingSignupRoleKey(emailAddress));
}

export function savePendingSignupPhone(emailAddress: string | null, phone: string | null) {
  if (!emailAddress || !phone?.trim()) return;
  window.localStorage.setItem(pendingSignupPhoneKey(emailAddress), phone.trim());
}

export function readPendingSignupPhone(emailAddress: string | null) {
  if (!emailAddress) return null;
  const stored = window.localStorage.getItem(pendingSignupPhoneKey(emailAddress));
  return stored?.trim() || null;
}

export function clearPendingSignupPhone(emailAddress: string | null) {
  if (!emailAddress) return;
  window.localStorage.removeItem(pendingSignupPhoneKey(emailAddress));
}

/** Marketing / URL intent — pre-selects role after auth, does not set role until user confirms. */
export function saveSessionSignupIntent(role: SignupRole | null) {
  if (!role) {
    window.sessionStorage.removeItem(sessionSignupIntentStorageKey);
    return;
  }
  window.sessionStorage.setItem(sessionSignupIntentStorageKey, role);
}

export function readSessionSignupIntent(): SignupRole | null {
  const stored = window.sessionStorage.getItem(sessionSignupIntentStorageKey);
  return stored === 'CUSTOMER' || stored === 'ARTISAN' ? stored : null;
}

export function clearSessionSignupIntent() {
  window.sessionStorage.removeItem(sessionSignupIntentStorageKey);
}

export function savePendingSignupIntent(emailAddress: string | null, role: SignupRole | null) {
  if (!emailAddress || !role) return;
  window.localStorage.setItem(pendingSignupIntentKey(emailAddress), role);
}

export function readPendingSignupIntent(emailAddress: string | null): SignupRole | null {
  if (!emailAddress) return null;
  const stored = window.localStorage.getItem(pendingSignupIntentKey(emailAddress));
  return stored === 'CUSTOMER' || stored === 'ARTISAN' ? stored : null;
}

export function clearPendingSignupIntent(emailAddress: string | null) {
  if (!emailAddress) return;
  window.localStorage.removeItem(pendingSignupIntentKey(emailAddress));
}

/** Persists chosen signup role until email verification completes (survives email-link navigation). */
export function savePendingVerificationRole(emailAddress: string | null, role: SignupRole | null) {
  if (!emailAddress || !role) return;
  window.localStorage.setItem(pendingVerificationRoleKey(emailAddress), role);
}

export function readPendingVerificationRole(emailAddress: string | null): SignupRole | null {
  if (!emailAddress) return null;
  const stored = window.localStorage.getItem(pendingVerificationRoleKey(emailAddress));
  return stored === 'CUSTOMER' || stored === 'ARTISAN' ? stored : null;
}

export function clearPendingVerificationRole(emailAddress: string | null) {
  if (!emailAddress) return;
  window.localStorage.removeItem(pendingVerificationRoleKey(emailAddress));
}

export function resolveSignupIntent(
  emailAddress: string | null,
  sessionIntent: SignupRole | null = null
): SignupRole | null {
  const verificationRole = readPendingVerificationRole(emailAddress);
  if (verificationRole) {
    return verificationRole;
  }

  if (sessionIntent) {
    return sessionIntent;
  }

  const emailIntent = readPendingSignupIntent(emailAddress);
  if (emailIntent) {
    return emailIntent;
  }

  return readSessionSignupIntent();
}

export function saveGoogleRedirectIntent(input: Omit<GoogleRedirectIntent, 'createdAt'>) {
  window.sessionStorage.setItem(
    googleRedirectIntentStorageKey,
    JSON.stringify({
      ...input,
      createdAt: Date.now(),
    })
  );
}

export function readGoogleRedirectIntent(): GoogleRedirectIntent | null {
  const stored = window.sessionStorage.getItem(googleRedirectIntentStorageKey);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<GoogleRedirectIntent>;
    if (Date.now() - Number(parsed.createdAt || 0) > GOOGLE_REDIRECT_INTENT_TTL_MS) {
      clearGoogleRedirectIntent();
      return null;
    }

    const mode = parsed.mode === 'signup' ? 'signup' : 'login';
    const role = parsed.role === 'CUSTOMER' || parsed.role === 'ARTISAN' ? parsed.role : null;

    return {
      mode,
      role,
      phone: typeof parsed.phone === 'string' && parsed.phone.trim() ? parsed.phone.trim() : null,
      displayName:
        typeof parsed.displayName === 'string' && parsed.displayName.trim()
          ? parsed.displayName.trim()
          : null,
      createdAt: Number(parsed.createdAt || 0),
    };
  } catch {
    clearGoogleRedirectIntent();
    return null;
  }
}

export function clearGoogleRedirectIntent() {
  window.sessionStorage.removeItem(googleRedirectIntentStorageKey);
}

export function needsEmailVerification(user: User) {
  return user.providerData.some((provider) => provider.providerId === 'password') && !user.emailVerified;
}
