import type { SignupRole } from '../appTypes';
import type { User } from 'firebase/auth';

const pendingSignupRoleStorageKey = 'bundo:pending-signup-role';
const pendingSignupPhoneStorageKey = 'bundo:pending-signup-phone';
const pendingSignupIntentStorageKey = 'bundo:pending-signup-intent';
const sessionSignupIntentStorageKey = 'bundo:session-signup-intent';

function pendingSignupRoleKey(emailAddress: string) {
  return `${pendingSignupRoleStorageKey}:${emailAddress.trim().toLowerCase()}`;
}

function pendingSignupPhoneKey(emailAddress: string) {
  return `${pendingSignupPhoneStorageKey}:${emailAddress.trim().toLowerCase()}`;
}

function pendingSignupIntentKey(emailAddress: string) {
  return `${pendingSignupIntentStorageKey}:${emailAddress.trim().toLowerCase()}`;
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

export function resolveSignupIntent(
  emailAddress: string | null,
  sessionIntent: SignupRole | null = null
): SignupRole | null {
  return (
    readPendingSignupIntent(emailAddress) ||
    sessionIntent ||
    readSessionSignupIntent() ||
    null
  );
}

export function needsEmailVerification(user: User) {
  return user.providerData.some((provider) => provider.providerId === 'password') && !user.emailVerified;
}
