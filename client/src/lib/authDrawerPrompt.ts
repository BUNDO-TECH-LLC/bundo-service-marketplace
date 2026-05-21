import type { SignupRole } from '../appTypes';

export type AuthDrawerMode = 'login' | 'signup' | 'reset' | 'choose-role';

export type AuthDrawerPrompt = {
  mode: AuthDrawerMode;
  role?: SignupRole;
  email?: string;
};

const AUTH_QUERY_KEY = 'auth';
const ROLE_QUERY_KEY = 'role';
const EMAIL_QUERY_KEY = 'email';

export function parseAuthDrawerPrompt(search: string): AuthDrawerPrompt | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const rawMode = params.get(AUTH_QUERY_KEY)?.trim().toLowerCase();

  if (rawMode !== 'login' && rawMode !== 'signup' && rawMode !== 'reset' && rawMode !== 'choose-role') {
    return null;
  }

  const prompt: AuthDrawerPrompt = { mode: rawMode };

  const rawRole = params.get(ROLE_QUERY_KEY)?.trim().toLowerCase();
  if (rawRole === 'artisan') {
    prompt.role = 'ARTISAN';
  } else if (rawRole === 'client' || rawRole === 'customer') {
    prompt.role = 'CUSTOMER';
  }

  const rawEmail = params.get(EMAIL_QUERY_KEY)?.trim();
  if (rawEmail) {
    prompt.email = rawEmail;
  }

  return prompt;
}

export function buildAuthDrawerSearch(prompt: AuthDrawerPrompt): string {
  const params = new URLSearchParams();
  params.set(AUTH_QUERY_KEY, prompt.mode);

  if (prompt.role === 'ARTISAN') {
    params.set(ROLE_QUERY_KEY, 'artisan');
  } else if (prompt.role === 'CUSTOMER') {
    params.set(ROLE_QUERY_KEY, 'client');
  }

  if (prompt.email?.trim()) {
    params.set(EMAIL_QUERY_KEY, prompt.email.trim());
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export function stripAuthDrawerParams(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete(AUTH_QUERY_KEY);
  params.delete(ROLE_QUERY_KEY);
  params.delete(EMAIL_QUERY_KEY);

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}
