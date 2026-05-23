import { applyActionCode, type Auth } from 'firebase/auth';

/** Query params Firebase appends after the user opens a verification or reset link. */
export function readFirebaseEmailAction(search: string) {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  if (!mode || !oobCode) {
    return null;
  }
  return { mode, oobCode };
}

/**
 * Complete email verification when the user lands from the Firebase email link.
 * Without this, the email may arrive but `emailVerified` stays false in the app.
 */
export async function completeFirebaseEmailAction(auth: Auth, search: string) {
  const action = readFirebaseEmailAction(search);
  if (!action || action.mode !== 'verifyEmail') {
    return { handled: false as const };
  }

  await applyActionCode(auth, action.oobCode);
  await auth.currentUser?.reload();

  return { handled: true as const, verified: Boolean(auth.currentUser?.emailVerified) };
}

export function stripFirebaseEmailActionParams(search: string) {
  const params = new URLSearchParams(search);
  ['mode', 'oobCode', 'apiKey', 'lang', 'continueUrl'].forEach((key) => params.delete(key));
  const next = params.toString();
  return next ? `?${next}` : '';
}
