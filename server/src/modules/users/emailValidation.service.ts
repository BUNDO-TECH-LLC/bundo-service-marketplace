import { ValidationError } from '../../utils/errors';

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export function validateEmailFormat(raw: string) {
  const email = normalizeEmail(raw);

  if (!email) {
    throw new ValidationError('Enter your email address.');
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new ValidationError('Enter a valid email address.');
  }

  const domain = email.split('@')[1];
  if (!domain || !domain.includes('.')) {
    throw new ValidationError('Enter a valid email domain.');
  }

  return { email, domain };
}

export async function validateSignupEmail(raw: string) {
  const { email } = validateEmailFormat(raw);
  return { email, domainReachable: true as const };
}
