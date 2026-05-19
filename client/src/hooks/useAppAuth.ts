import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
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

const AUTH_INIT_TIMEOUT_MS = 10_000;

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
  const authListenerGenerationRef = useRef(0);

  useEffect(() => {
    currentTokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (!auth) {
      setAuthChecked(true);
      setRouteHydrated(true);
      return;
    }

    let authInitTimedOut = false;
    const authInitTimer = window.setTimeout(() => {
      authInitTimedOut = true;
      setAuthChecked(true);
      setRouteHydrated(true);
      setNotice('Authentication is taking longer than expected. You can still browse; try signing in again.');
    }, AUTH_INIT_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const generation = ++authListenerGenerationRef.current;

      const isStale = () => generation !== authListenerGenerationRef.current;

      const finishAuthBootstrap = () => {
        if (isStale()) return;
        setRouteHydrated(true);
        setAuthChecked(true);
        authBootstrapCompletedRef.current = true;
        window.clearTimeout(authInitTimer);
      };

      const failAuthBootstrap = async (message: string) => {
        if (isStale()) return;
        setToken('');
        setMe(null);
        clearPrivateData();
        setRouteHydrated(true);
        setAuthChecked(true);
        authBootstrapCompletedRef.current = false;
        window.clearTimeout(authInitTimer);
        setNotice(message);
        if (auth) {
          try {
            await signOut(auth);
          } catch {
            // Ignore sign-out errors; Firebase session may already be cleared.
          }
        }
        if (!isAuthPathname(window.location.pathname)) {
          navigate({ pathname: '/', search: '' }, { replace: true });
        }
      };

      void (async () => {
        setFirebaseUser(user);

        if (!user) {
          const hadSession = Boolean(currentTokenRef.current);
          setToken('');
          setMe(null);
          clearPrivateData();
          setPushToken('');
          setPushStatus(hasPushConfig() ? 'idle' : 'missing-config');
          setRouteHydrated(true);
          clearStoredRoute();
          authBootstrapCompletedRef.current = false;
          window.clearTimeout(authInitTimer);
          if (hadSession) {
            navigate({ pathname: '/', search: '' }, { replace: true });
          }
          if (!isStale()) {
            setAuthChecked(true);
          }
          return;
        }

        if (needsEmailVerification(user)) {
          setToken('');
          setMe(null);
          clearPrivateData();
          setPushToken('');
          setPushStatus(hasPushConfig() ? 'idle' : 'missing-config');
          setRouteHydrated(true);
          clearStoredRoute();
          authBootstrapCompletedRef.current = false;
          window.clearTimeout(authInitTimer);
          if (!isAuthPathname(window.location.pathname)) {
            navigate('/verify-email', {
              replace: true,
              state: { email: user.email ?? '' },
            });
          }
          if (!isStale()) {
            setAuthChecked(true);
          }
          return;
        }

        if (authBootstrapCompletedRef.current) {
          try {
            const session = await resolveApiSession(user);
            if (isStale()) return;
            setToken(session.token);
            setMe(session.user);
            if (session.user.role) {
              void loadPrivateData(session.token, session.user).catch(() => undefined);
            }
          } catch {
            // Keep the current route if a background token refresh fails.
          }
          return;
        }

        try {
          const session = await resolveApiSession(user);
          if (isStale()) return;

          setToken(session.token);
          setMe(session.user);

          // Unblock the UI before dashboard API calls finish.
          finishAuthBootstrap();

          const path = window.location.pathname.replace(/\/+$/, '') || '/';
          const onAuthScreen = isAuthPathname(path);

          if (!session.user.role) {
            setNotice('Choose client or artisan to finish setting up your Bundo account before booking.');
            if (!onAuthScreen) {
              navigate({ pathname: '/', search: '' }, { replace: true });
            }
            return;
          }

          void loadPrivateData(session.token, session.user).catch(() => {
            if (!isStale()) {
              setNotice('Some dashboard data could not be loaded. Try refreshing the page.');
            }
          });

          // Auth screens handle their own post-login navigation.
          if (onAuthScreen) {
            return;
          }

          const preservePublicRoute = isPublicBrowsePathname(path) && !onAuthScreen;
          const params = new URLSearchParams(window.location.search);
          const reference = params.get('reference') || params.get('trxref');

          if (reference) {
            processedPaymentReferenceRef.current = reference;
            try {
              await completePaymentReturn(reference, session.token, session.user);
            } catch (error) {
              if (!isStale()) {
                setNotice(
                  error instanceof ApiError
                    ? error.message
                    : 'Payment could not be confirmed yet. Open Bookings to check status or try again.'
                );
              }
            } finally {
              if (!isStale()) {
                navigate(buildAppPath({ view: 'workspace', workspaceSection: 'bookings' }), {
                  replace: true,
                });
              }
            }
            return;
          }

          if (preservePublicRoute) {
            return;
          }

          if (session.user.role === 'ADMIN') {
            const adminPath = parseAppPath(path);
            if (adminPath?.view === 'admin') {
              return;
            }

            const storedAdminRoute = readStoredRoute(session.user.role);
            if (!isStale()) {
              if (storedAdminRoute?.view === 'admin') {
                navigate({ pathname: storedRouteToPath(storedAdminRoute), search: '' }, { replace: true });
              } else {
                navigate({ pathname: '/admin/overview', search: '' }, { replace: true });
              }
            }
            return;
          }

          const legacyTarget = legacyQueryToAppPath(window.location.search);
          if (legacyTarget) {
            if (!isStale()) {
              navigate({ pathname: legacyTarget, search: '' }, { replace: true });
            }
            return;
          }

          const storedRoute = readStoredRoute(session.user.role);
          if (!isStale()) {
            if (storedRoute) {
              navigate({ pathname: storedRouteToPath(storedRoute), search: '' }, { replace: true });
            } else if (session.user.role === 'ARTISAN') {
              navigate('/workspace/overview', { replace: true });
            } else if (session.user.role === 'CUSTOMER') {
              navigate('/workspace/overview', { replace: true });
            }
          }
        } catch {
          if (!isStale() && !authInitTimedOut) {
            await failAuthBootstrap(
              'We could not finish account sync. Make sure the backend is running, then sign in again.'
            );
          }
        }
      })();
    });

    return () => {
      window.clearTimeout(authInitTimer);
      unsubscribe();
    };
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
