import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from 'firebase/auth';
import { api, ApiError } from './api';
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

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function authErrorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: string }).code)
    : '';
}

function shouldFallbackToRedirect(error: unknown) {
  return [
    'auth/popup-blocked',
    'auth/cancelled-popup-request',
    'auth/operation-not-supported-in-this-environment',
  ].includes(authErrorCode(error));
}

export async function signInWithGooglePopup() {
  if (!auth) {
    throw new Error('Firebase is not configured for this environment.');
  }

  const provider = createGoogleProvider();

  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (!shouldFallbackToRedirect(error)) {
      throw error;
    }

    await signInWithRedirect(auth, provider);
    return null;
  }
}

export async function startGoogleRedirectSignIn() {
  if (!auth) {
    throw new Error('Firebase is not configured for this environment.');
  }

  await signInWithRedirect(auth, createGoogleProvider());
}

export async function getGoogleRedirectResult() {
  if (!auth) {
    return null;
  }

  return getRedirectResult(auth);
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
      ? options.intendedRole ?? rememberedRole
      : options.intendedRole || rememberedRole;

  if (options.phone?.trim()) {
    try {
      await api('/users/phone', {
        method: 'PATCH',
        token: session.token,
        body: JSON.stringify({ phone: options.phone.trim() }),
      });
      const refreshed = await api<{ user: ApiUser }>('/me', { token: session.token });
      session = { token: session.token, user: refreshed.user };
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        throw new Error(error.message);
      }
      throw error;
    }
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
