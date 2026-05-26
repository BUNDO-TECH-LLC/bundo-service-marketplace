import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ApiError } from '../lib/api';
import { buildAppPath, legacyQueryToAppPath, parseAppPath } from '../lib/appPaths';
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

  const navigateRef = useRef(navigate);
  const loadPrivateDataRef = useRef(loadPrivateData);
  const clearPrivateDataRef = useRef(clearPrivateData);
  const completePaymentReturnRef = useRef(completePaymentReturn);
  const setNoticeRef = useRef(setNotice);
  const processedPaymentReferenceRefRef = useRef(processedPaymentReferenceRef);

  useEffect(() => {
    currentTokenRef.current = token;
  }, [token]);

  useEffect(() => {
    navigateRef.current = navigate;
    loadPrivateDataRef.current = loadPrivateData;
    clearPrivateDataRef.current = clearPrivateData;
    completePaymentReturnRef.current = completePaymentReturn;
    setNoticeRef.current = setNotice;
    processedPaymentReferenceRefRef.current = processedPaymentReferenceRef;
  });

  useEffect(() => {
    if (!auth) {
      setAuthChecked(true);
      setRouteHydrated(true);
      return;
    }

    const authInitTimer = window.setTimeout(() => {
      setAuthChecked(true);
      setRouteHydrated(true);
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
        clearPrivateDataRef.current();
        setRouteHydrated(true);
        setAuthChecked(true);
        authBootstrapCompletedRef.current = false;
        window.clearTimeout(authInitTimer);
        setNoticeRef.current(message);
        if (!isAuthPathname(window.location.pathname)) {
          navigateRef.current({ pathname: '/', search: '' }, { replace: true });
        }
      };

      void (async () => {
        setFirebaseUser(user);

        if (!user) {
          const hadSession = Boolean(currentTokenRef.current);
          setToken('');
          setMe(null);
          clearPrivateDataRef.current();
          setPushToken('');
          setPushStatus(hasPushConfig() ? 'idle' : 'missing-config');
          setRouteHydrated(true);
          clearStoredRoute();
          authBootstrapCompletedRef.current = false;
          window.clearTimeout(authInitTimer);
          if (hadSession) {
            navigateRef.current({ pathname: '/', search: '' }, { replace: true });
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
            setRouteHydrated(true);
            if (session.user.role) {
              void loadPrivateDataRef.current(session.token, session.user).catch(() => undefined);
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

          const path = window.location.pathname.replace(/\/+$/, '') || '/';
          const onAuthScreen = isAuthPathname(path);

          if (!session.user.role) {
            finishAuthBootstrap();
            setNoticeRef.current('Finishing your account setup…');
            if (!onAuthScreen) {
              navigateRef.current({ pathname: '/', search: '' }, { replace: true });
            }
            return;
          }

          // Unblock the shell before dashboard fetches — avoids a full-screen loader on session restore.
          finishAuthBootstrap();
          void loadPrivateDataRef.current(session.token, session.user).catch(() => {
            if (!isStale()) {
              setNoticeRef.current('Some dashboard data could not be loaded. Try refreshing the page.');
            }
          });

          if (onAuthScreen) {
            return;
          }

          const preservePublicRoute = isPublicBrowsePathname(path);
          const params = new URLSearchParams(window.location.search);
          const reference = params.get('reference') || params.get('trxref');

          if (reference) {
            processedPaymentReferenceRefRef.current.current = reference;
            try {
              await completePaymentReturnRef.current(reference, session.token, session.user);
            } catch (error) {
              if (!isStale()) {
                setNoticeRef.current(
                  error instanceof ApiError
                    ? error.message
                    : 'Payment could not be confirmed yet. Open Bookings to check status or try again.'
                );
              }
            } finally {
              if (!isStale()) {
                navigateRef.current(buildAppPath({ view: 'workspace', workspaceSection: 'bookings' }), {
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
                navigateRef.current({ pathname: storedRouteToPath(storedAdminRoute), search: '' }, { replace: true });
              } else {
                navigateRef.current({ pathname: '/admin/overview', search: '' }, { replace: true });
              }
            }
            return;
          }

          const legacyTarget = legacyQueryToAppPath(window.location.search);
          if (legacyTarget) {
            if (!isStale()) {
              navigateRef.current({ pathname: legacyTarget, search: '' }, { replace: true });
            }
            return;
          }

          const storedRoute = readStoredRoute(session.user.role);
          if (!isStale()) {
            if (storedRoute) {
              navigateRef.current({ pathname: storedRouteToPath(storedRoute), search: '' }, { replace: true });
            } else if (session.user.role === 'ARTISAN' || session.user.role === 'CUSTOMER') {
              navigateRef.current('/workspace/overview', { replace: true });
            }
          }
        } catch {
          if (isStale() || authBootstrapCompletedRef.current) {
            return;
          }
          await failAuthBootstrap(
            'We could not finish account sync. Make sure the backend is running, then sign in again.'
          );
        }
      })();
    });

    return () => {
      window.clearTimeout(authInitTimer);
      unsubscribe();
    };
  }, []);

  const acknowledgeSession = (sessionToken: string, user: ApiUser) => {
    authBootstrapCompletedRef.current = true;
    currentTokenRef.current = sessionToken;
    setToken(sessionToken);
    setMe(user);
    setRouteHydrated(true);
    setAuthChecked(true);
  };

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
    acknowledgeSession,
  };
}
