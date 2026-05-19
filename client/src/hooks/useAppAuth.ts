import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ApiError } from '../lib/api';
import { buildAppPath, legacyQueryToAppPath, parseAppPath } from '../lib/appPaths';
import { needsEmailVerification } from '../lib/authSignupStorage';
import { auth } from '../lib/firebase';
import { hasPushConfig } from '../lib/messaging';
import { resolveApiSession } from '../lib/resolveApiSession';
import { clearStoredRoute, isAuthPathname, isPublicBrowsePathname } from '../lib/appRouting';
import { readStoredRoute, storedRouteToPath } from '../lib/workspaceRoute';
import type { PushStatus } from '../appTypes';
import type { ApiUser } from '../types';

type UseAppAuthOptions = {
  navigate: NavigateFunction;
  loadPrivateData: (token: string, user?: ApiUser | null) => Promise<void>;
  clearPrivateData: () => void;
  completePaymentReturn: (reference: string, token: string, user: ApiUser) => Promise<unknown>;
  setNotice: (message: string) => void;
  processedPaymentReferenceRef: MutableRefObject<string | null>;
};

export function useAppAuth({
  navigate,
  loadPrivateData,
  clearPrivateData,
  completePaymentReturn,
  setNotice,
  processedPaymentReferenceRef,
}: UseAppAuthOptions) {
  const [authChecked, setAuthChecked] = useState(false);
  const [routeHydrated, setRouteHydrated] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [me, setMe] = useState<ApiUser | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus>(hasPushConfig() ? 'idle' : 'missing-config');
  const [pushToken, setPushToken] = useState('');

  const currentTokenRef = useRef('');
  const authBootstrapCompletedRef = useRef(false);

  useEffect(() => {
    currentTokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (!auth) {
      setAuthChecked(true);
      setRouteHydrated(true);
      return;
    }

    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        const hadSession = Boolean(currentTokenRef.current);
        setToken('');
        setMe(null);
        clearPrivateData();
        setPushToken('');
        setPushStatus(hasPushConfig() ? 'idle' : 'missing-config');
        setRouteHydrated(false);
        clearStoredRoute();
        authBootstrapCompletedRef.current = false;
        if (hadSession) {
          navigate({ pathname: '/', search: '' }, { replace: true });
        }
        setAuthChecked(true);
        return;
      }

      if (needsEmailVerification(user)) {
        setToken('');
        setMe(null);
        clearPrivateData();
        setPushToken('');
        setPushStatus(hasPushConfig() ? 'idle' : 'missing-config');
        setRouteHydrated(false);
        clearStoredRoute();
        authBootstrapCompletedRef.current = false;
        if (!isAuthPathname(window.location.pathname)) {
          navigate({ pathname: '/', search: '' }, { replace: true });
        }
        setAuthChecked(true);
        return;
      }

      const finishAuthBootstrap = () => {
        setRouteHydrated(true);
        setAuthChecked(true);
        authBootstrapCompletedRef.current = true;
      };

      if (authBootstrapCompletedRef.current) {
        try {
          const session = await resolveApiSession(user);
          setToken(session.token);
          setMe(session.user);
          if (session.user.role) {
            await loadPrivateData(session.token, session.user);
          }
        } catch {
          // Keep the current route if a background token refresh fails.
        }
        return;
      }

      try {
        const session = await resolveApiSession(user);
        setToken(session.token);
        setMe(session.user);

        if (!session.user.role) {
          finishAuthBootstrap();
          setNotice('Choose client or artisan to finish setting up your Bundo account before booking.');
          navigate({ pathname: '/', search: '' }, { replace: true });
          return;
        }

        await loadPrivateData(session.token, session.user);

        const path = window.location.pathname.replace(/\/+$/, '') || '/';
        const preservePublicRoute = isPublicBrowsePathname(path);
        const params = new URLSearchParams(window.location.search);
        const reference = params.get('reference') || params.get('trxref');

        if (reference) {
          processedPaymentReferenceRef.current = reference;
          try {
            await completePaymentReturn(reference, session.token, session.user);
          } catch (error) {
            setNotice(
              error instanceof ApiError
                ? error.message
                : 'Payment could not be confirmed yet. Open Bookings to check status or try again.'
            );
          } finally {
            navigate(buildAppPath({ view: 'workspace', workspaceSection: 'bookings' }), { replace: true });
          }
          finishAuthBootstrap();
          return;
        }

        if (preservePublicRoute) {
          finishAuthBootstrap();
          return;
        }

        if (session.user.role === 'ADMIN') {
          const adminPath = parseAppPath(path);
          if (adminPath?.view === 'admin') {
            finishAuthBootstrap();
            return;
          }

          const storedAdminRoute = readStoredRoute(session.user.role);
          if (storedAdminRoute?.view === 'admin') {
            navigate({ pathname: storedRouteToPath(storedAdminRoute), search: '' }, { replace: true });
          } else {
            navigate({ pathname: '/admin/overview', search: '' }, { replace: true });
          }
          finishAuthBootstrap();
          return;
        }

        const legacyTarget = legacyQueryToAppPath(window.location.search);
        if (legacyTarget) {
          navigate({ pathname: legacyTarget, search: '' }, { replace: true });
          finishAuthBootstrap();
          return;
        }

        const storedRoute = readStoredRoute(session.user.role);
        if (storedRoute) {
          navigate({ pathname: storedRouteToPath(storedRoute), search: '' }, { replace: true });
        } else if (session.user.role === 'ARTISAN') {
          navigate('/workspace/overview', { replace: true });
        }
        finishAuthBootstrap();
      } catch {
        setToken('');
        setMe(null);
        clearPrivateData();
        setRouteHydrated(false);
        setNotice('We could not finish account sync. Please make sure the backend is running, then sign in again.');
        navigate({ pathname: '/', search: '' }, { replace: true });
        setAuthChecked(true);
      }
    });
  }, [
    navigate,
    loadPrivateData,
    clearPrivateData,
    completePaymentReturn,
    setNotice,
    processedPaymentReferenceRef,
  ]);

  return {
    authChecked,
    routeHydrated,
    setRouteHydrated,
    firebaseUser,
    token,
    setToken,
    me,
    setMe,
    pushStatus,
    setPushStatus,
    pushToken,
    setPushToken,
    currentTokenRef,
  };
}
