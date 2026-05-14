import type { SignupRole } from '../appTypes';
import type { User } from 'firebase/auth';

const pendingSignupRoleStorageKey = 'bundo:pending-signup-role';

function pendingSignupRoleKey(emailAddress: string) {
  return `${pendingSignupRoleStorageKey}:${emailAddress.trim().toLowerCase()}`;
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

export function needsEmailVerification(user: User) {
  return user.providerData.some((provider) => provider.providerId === 'password') && !user.emailVerified;
}
