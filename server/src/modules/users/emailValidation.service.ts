import { promises as dns } from 'dns';
import { ValidationError } from '../../utils/errors';

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export async function validateSignupEmail(raw: string) {
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

  try {
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords.length > 0) {
      return { email, domainReachable: true as const };
    }
  } catch {
    // Fall through to A/AAAA lookup for domains without MX (uncommon).
  }

  try {
    await Promise.any([dns.resolve4(domain), dns.resolve6(domain)]);
    return { email, domainReachable: true as const };
  } catch {
    throw new ValidationError(
      'This email domain does not look reachable. Check the address or try another email provider.'
    );
  }
}
