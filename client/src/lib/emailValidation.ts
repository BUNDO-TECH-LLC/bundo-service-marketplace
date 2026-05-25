export type EmailValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; message: string };

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const COMMON_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
};

import { api, ApiError } from './api';

export function validateEmailAddress(raw: string): EmailValidationResult {
  const normalized = raw.trim().toLowerCase();

  if (!normalized) {
    return { ok: false, message: 'Enter your email address.' };
  }

  if (normalized.length > 254) {
    return { ok: false, message: 'Email address is too long.' };
  }

  if (!normalized.includes('@')) {
    return { ok: false, message: 'Email must include @ and a domain (e.g. name@example.com).' };
  }

  const [, domain] = normalized.split('@');
  if (!domain || !domain.includes('.')) {
    return { ok: false, message: 'Enter a valid domain (e.g. name@example.com).' };
  }

  const typoSuggestion = COMMON_TYPOS[domain];
  if (typoSuggestion) {
    return {
      ok: false,
      message: `Did you mean ${normalized.replace(domain, typoSuggestion)}?`,
    };
  }

  if (!EMAIL_PATTERN.test(normalized)) {
    return { ok: false, message: 'Enter a valid email address.' };
  }

  return { ok: true, normalized };
}

export type EmailDeliverabilityResult =
  | { ok: true; normalized: string }
  | { ok: false; message: string };

/** Format + typo check, then server MX/domain reachability for signup. */
export async function checkEmailDeliverability(
  raw: string,
  options?: { purpose?: 'signup' }
): Promise<EmailDeliverabilityResult> {
  const format = validateEmailAddress(raw);
  if (!format.ok) {
    return format;
  }

  try {
    await api<{ email: string }>('/users/validate-email', {
      method: 'POST',
      body: JSON.stringify({
        email: format.normalized,
        ...(options?.purpose ? { purpose: options.purpose } : {}),
      }),
    });
    return { ok: true, normalized: format.normalized };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return {
        ok: false,
        message:
          error.message ||
          'An account already exists with this email. Sign in instead, or use Forgot password.',
      };
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Could not confirm this email domain. Try another address.';
    return { ok: false, message };
  }
}

export async function checkSignupPhoneAvailability(raw: string): Promise<EmailDeliverabilityResult> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: 'Enter your phone number (include country code, e.g. +234…).' };
  }

  try {
    await api('/users/validate-signup-phone', {
      method: 'POST',
      body: JSON.stringify({ phone: trimmed }),
    });
    return { ok: true, normalized: trimmed };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.message };
    }

    return { ok: false, message: 'Could not verify this phone number. Try again.' };
  }
}
