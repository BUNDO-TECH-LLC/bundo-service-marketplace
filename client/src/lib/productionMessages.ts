import { BUNDO_SUPPORT_EMAIL } from '../constants/support';

export const SIGN_IN_UNAVAILABLE =
  'Sign-in is temporarily unavailable. Please try again in a few minutes or contact support.';

export const SIGN_IN_UNAVAILABLE_WITH_EMAIL = `Sign-in is temporarily unavailable. Please try again in a few minutes or email ${BUNDO_SUPPORT_EMAIL}.`;

export const PUSH_ALERTS_UNAVAILABLE =
  'Push alerts are not available on this device right now. You can still check notifications inside Bundo.';

export function supportContactSuffix() {
  return `Contact ${BUNDO_SUPPORT_EMAIL} if this continues.`;
}
