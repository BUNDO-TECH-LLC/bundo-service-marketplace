import { GoogleAuthProvider, signInWithPopup, type User } from 'firebase/auth';
import { api, ApiError } from './api';
import {
  clearPendingSignupIntent,
  clearPendingSignupPhone,
  clearPendingSignupRole,
  clearSessionSignupIntent,
  readPendingSignupRole,
} from './authSignupStorage';
import { formatAuthFlowError } from './authErrors';
import { auth } from './firebase';
import { resolveApiSession } from './resolveApiSession';
import type { ApiUser, Role } from '../types';

type AccountKind = Extract<Role, 'CUSTOMER' | 'ARTISAN'>;

export async function signInWithGooglePopup() {
  if (!auth) {
    throw new Error('Firebase is not configured for this environment.');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    throw new Error(formatAuthFlowError(error, 'login'));
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
