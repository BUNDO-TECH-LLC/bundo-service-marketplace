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

import { api } from './api';

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
export async function checkEmailDeliverability(raw: string): Promise<EmailDeliverabilityResult> {
  const format = validateEmailAddress(raw);
  if (!format.ok) {
    return format;
  }

  try {
    await api<{ email: string }>('/users/validate-email', {
      method: 'POST',
      body: JSON.stringify({ email: format.normalized }),
    });
    return { ok: true, normalized: format.normalized };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Could not confirm this email domain. Try another address.';
    return { ok: false, message };
  }
}
