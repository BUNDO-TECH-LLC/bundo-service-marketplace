import { Navigate, useSearchParams } from 'react-router-dom';
import type { AuthDrawerMode } from '../../lib/authDrawerPrompt';
import { buildAuthDrawerSearch, parseAuthDrawerPrompt } from '../../lib/authDrawerPrompt';
import type { SignupRole } from '../../appTypes';

function roleFromLegacySignupParams(searchParams: URLSearchParams): SignupRole | undefined {
  const rawRole = searchParams.get('role')?.trim().toLowerCase();
  if (rawRole === 'artisan') {
    return 'ARTISAN';
  }
  if (rawRole === 'client' || rawRole === 'customer') {
    return 'CUSTOMER';
  }
  return undefined;
}

export function AuthDrawerRedirect({ preset }: { preset: AuthDrawerMode }) {
  const [searchParams] = useSearchParams();
  const existing = parseAuthDrawerPrompt(`?${searchParams.toString()}`);

  const prompt = {
    mode: existing?.mode || preset,
    role: existing?.role || (preset === 'signup' ? roleFromLegacySignupParams(searchParams) : undefined),
    email: existing?.email || searchParams.get('email')?.trim() || undefined,
  };

  return <Navigate to={{ pathname: '/', search: buildAuthDrawerSearch(prompt) }} replace />;
}
