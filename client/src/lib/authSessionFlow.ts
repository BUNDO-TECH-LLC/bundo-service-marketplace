import { GoogleAuthProvider, signInWithPopup, type User } from 'firebase/auth';
import { api } from './api';
import {
  clearPendingSignupIntent,
  clearPendingSignupPhone,
  clearPendingSignupRole,
  clearSessionSignupIntent,
  readPendingSignupRole,
} from './authSignupStorage';
import { auth } from './firebase';
import { resolveApiSession } from './resolveApiSession';
import type { ApiUser, Role } from '../types';

type AccountKind = Extract<Role, 'CUSTOMER' | 'ARTISAN'>;

function formatGoogleAuthError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code)
      : '';

  switch (code) {
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled. Try again when you are ready.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this Firebase project. Enable Google under Authentication → Sign-in method.';
    case 'auth/unauthorized-domain':
      return 'This website is not authorized for Google sign-in. Add your domain in Firebase → Authentication → Settings → Authorized domains.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using email/password. Sign in with email instead.';
    default:
      return error instanceof Error ? error.message : 'Could not continue with Google.';
  }
}

export async function signInWithGooglePopup() {
  if (!auth) {
    throw new Error('Firebase is not configured for this environment.');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    throw new Error(formatGoogleAuthError(error));
  }
}

export async function finalizeAuthSession(
  firebaseUser: User,
  options: {
    mode: 'login' | 'signup';
    intendedRole?: AccountKind;
    phone?: string;
    forceTokenRefresh?: boolean;
  }
) {
  let session = await resolveApiSession(firebaseUser, options.forceTokenRefresh ?? false);
  const rememberedRole = readPendingSignupRole(firebaseUser.email);
  const intendedRole =
    options.mode === 'signup'
      ? 'CUSTOMER'
      : options.intendedRole || rememberedRole;

  if (options.phone?.trim()) {
    await api('/users/phone', {
      method: 'PATCH',
      token: session.token,
      body: JSON.stringify({ phone: options.phone.trim() }),
    });
    const refreshed = await api<{ user: ApiUser }>('/me', { token: session.token });
    session = { token: session.token, user: refreshed.user };
  }

  if (
    intendedRole &&
    session.user.role !== intendedRole &&
    session.user.role !== 'ADMIN' &&
    !(session.user.role === 'ARTISAN' && intendedRole === 'CUSTOMER')
  ) {
    await api('/users/role', {
      method: 'PATCH',
      token: session.token,
      body: JSON.stringify({ role: intendedRole }),
    });
    const refreshed = await api<{ user: ApiUser }>('/me', { token: session.token });
    session = { token: session.token, user: refreshed.user };
  }

  clearPendingSignupRole(firebaseUser.email);
  clearPendingSignupPhone(firebaseUser.email);
  clearPendingSignupIntent(firebaseUser.email);
  clearSessionSignupIntent();

  const destination =
    session.user.role === 'ARTISAN' || session.user.role === 'ADMIN'
      ? options.mode === 'signup'
        ? '/'
        : '/workspace/overview'
      : '/workspace/overview';

  return { session, destination };
}
