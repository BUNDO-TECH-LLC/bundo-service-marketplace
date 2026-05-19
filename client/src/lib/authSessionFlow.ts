import { GoogleAuthProvider, signInWithPopup, type User } from 'firebase/auth';
import { api } from './api';
import { clearPendingSignupRole, readPendingSignupRole } from './authSignupStorage';
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
  return signInWithPopup(auth, provider);
}

export async function finalizeAuthSession(
  firebaseUser: User,
  options: {
    mode: 'login' | 'signup';
    intendedRole?: AccountKind;
    phone?: string;
  }
) {
  let session = await resolveApiSession(firebaseUser);
  const rememberedRole = readPendingSignupRole(firebaseUser.email);
  const intendedRole = options.intendedRole || rememberedRole;

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

  const destination =
    session.user.role === 'ARTISAN' || session.user.role === 'ADMIN'
      ? options.mode === 'signup'
        ? '/'
        : '/workspace/overview'
      : '/workspace/overview';

  return { session, destination };
}
