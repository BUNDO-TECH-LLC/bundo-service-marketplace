import { BUNDO_SUPPORT_EMAIL } from '../constants/support';
import { ApiError } from './api';

export function formatFirebaseAuthError(
  error: unknown,
  context: 'login' | 'signup' | 'reset' = 'login'
): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code)
      : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Sign in instead, or use Forgot password if you do not remember it.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using email and password. Sign in with email instead.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 8 characters.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return context === 'login'
        ? 'Incorrect email or password. Try again or use Forgot password.'
        : 'Could not create your account with these details. Check your email and password.';
    case 'auth/user-not-found':
      return context === 'login'
        ? 'Incorrect email or password. Try again or use Forgot password.'
        : 'No account found with this email. Create an account instead.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled. Try again when you are ready.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not available right now. Try email and password instead.';
    case 'auth/unauthorized-domain':
      return `Google sign-in is not available from this website right now. Try email and password or contact ${BUNDO_SUPPORT_EMAIL}.`;
    default:
      return error instanceof Error ? error.message : 'Could not complete sign-in.';
  }
}

export function formatApiAuthError(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const payload =
    error.data && typeof error.data === 'object'
      ? (error.data as { code?: string; message?: string })
      : null;

  if (payload?.message) {
    return payload.message;
  }

  return error.message;
}

export function formatAuthFlowError(
  error: unknown,
  context: 'login' | 'signup' | 'reset' = 'login'
): string {
  return formatApiAuthError(error) ?? formatFirebaseAuthError(error, context);
}
