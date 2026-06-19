import { onAuthStateChanged, type User } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppRoot } from '../../app/appRootContext';
import { AuthLayout } from '../../layouts/AuthLayout';
import { ApiError } from '../../lib/api';
import { EmailInboxHint } from '../../components/EmailInboxHint';
import { resendBundoEmailVerification } from '../../lib/verificationEmailResend';
import {
  ARTISAN_ONBOARDING_PATH,
  clearArtisanApplicantOnServer,
  markArtisanApplicant,
} from '../../lib/artisanApplication';
import { CUSTOMER_PROFILE_PATH, isCustomerProfileComplete } from '../../lib/customerProfile';
import { buildAuthDrawerSearch } from '../../lib/authDrawerPrompt';
import {
  clearPendingVerificationRole,
  readPendingSignupPhone,
  readPendingVerificationRole,
  resolveSignupIntent,
} from '../../lib/authSignupStorage';
import { finalizeAuthSession } from '../../lib/authSessionFlow';
import {
  completeFirebaseEmailAction,
  readFirebaseEmailAction,
  stripFirebaseEmailActionParams,
} from '../../lib/firebaseEmailAction';
import { auth } from '../../lib/firebase';
import type { ApiUser } from '../../types';

type VerificationState = {
  email?: string;
  accountKind?: 'CUSTOMER' | 'ARTISAN';
  phone?: string;
};

function destinationForRole(role: ApiUser['role']) {
  if (role === 'ARTISAN') return '/';
  if (role === 'ADMIN') return '/admin/overview';
  return '/workspace/overview';
}

function waitForAuthUser(timeoutMs = 4000): Promise<User | null> {
  const firebaseAuth = auth;
  if (!firebaseAuth) {
    return Promise.resolve(null);
  }

  if (firebaseAuth.currentUser) {
    return Promise.resolve(firebaseAuth.currentUser);
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      unsubscribe();
      resolve(firebaseAuth.currentUser);
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        window.clearTimeout(timer);
        unsubscribe();
        resolve(user);
      }
    });
  });
}

export function EmailVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useAppRoot();
  const state = (location.state || {}) as VerificationState;

  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('error');
  const [busy, setBusy] = useState(false);
  const [autoRedirecting, setAutoRedirecting] = useState(false);
  const continueInFlightRef = useRef(false);

  const email = state.email || auth?.currentUser?.email || 'your email';

  const continueAfterVerification = useCallback(async () => {
    const user = auth?.currentUser ?? (await waitForAuthUser());

    if (!user) {
      navigate({
        pathname: '/',
        search: buildAuthDrawerSearch({ mode: 'login', email: typeof email === 'string' ? email : undefined }),
      });
      return false;
    }

    if (continueInFlightRef.current) {
      return false;
    }

    continueInFlightRef.current = true;
    setBusy(true);
    setAutoRedirecting(true);
    setMessage('Email verified. Taking you into Bundo…');
    setMessageTone('success');

    try {
      await user.reload();

      if (!user.emailVerified) {
        setAutoRedirecting(false);
        setMessageTone('error');
        setMessage(
          'Your email is not verified yet. Open the link in your inbox (or spam folder), then try again.'
        );
        return false;
      }

      const pendingPhone = state.phone || readPendingSignupPhone(user.email) || undefined;
      const signupIntent =
        state.accountKind ||
        readPendingVerificationRole(user.email) ||
        resolveSignupIntent(user.email) ||
        undefined;

      const { session } = await finalizeAuthSession(user, {
        mode: 'signup',
        phone: pendingPhone,
        forceTokenRefresh: true,
        intendedRole: signupIntent === 'CUSTOMER' ? 'CUSTOMER' : undefined,
      });

      clearPendingVerificationRole(user.email);

      ctx.acknowledgeSession(session.token, session.user);
      await ctx.loadPrivateData(session.token, session.user).catch(() => undefined);

      if (signupIntent === 'ARTISAN') {
        const updated = await markArtisanApplicant(session.token, session.user.firebaseUid);
        ctx.acknowledgeSession(session.token, updated || session.user);
        navigate(ARTISAN_ONBOARDING_PATH, { replace: true });
        return true;
      }

      const cleared = await clearArtisanApplicantOnServer(session.token, session.user.firebaseUid);
      const nextUser = cleared || session.user;
      ctx.acknowledgeSession(session.token, nextUser);

      if (!isCustomerProfileComplete(nextUser)) {
        navigate(CUSTOMER_PROFILE_PATH, { replace: true });
        return true;
      }

      navigate(destinationForRole(nextUser.role) || '/workspace/overview', { replace: true });
      return true;
    } catch (error) {
      setAutoRedirecting(false);
      setMessage(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not finish signing you in after verification.'
      );
      return false;
    } finally {
      continueInFlightRef.current = false;
      setBusy(false);
    }
  }, [ctx, email, navigate, state.accountKind, state.phone]);

  useEffect(() => {
    if (!auth || !readFirebaseEmailAction(location.search)) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const result = await completeFirebaseEmailAction(auth, location.search);
        if (cancelled || !result.handled) {
          return;
        }

        const cleaned = stripFirebaseEmailActionParams(location.search);
        navigate({ pathname: location.pathname, search: cleaned }, { replace: true });

        if (!result.verified) {
          setMessageTone('error');
          setMessage('We received your verification link. Sign in if needed, then continue.');
          return;
        }

        const continued = await continueAfterVerification();
        if (!cancelled && !continued) {
          setAutoRedirecting(false);
        }
      } catch (error) {
        if (!cancelled) {
          setAutoRedirecting(false);
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not complete verification from the email link.'
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [continueAfterVerification, location.pathname, location.search, navigate]);

  async function resendVerification() {
    if (!auth?.currentUser) {
      setMessageTone('error');
      setMessage('Sign in first so we can resend your verification email.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      await resendBundoEmailVerification(auth.currentUser);
      setMessageTone('success');
      setMessage('Verification link sent again. Check your inbox and spam folder.');
    } catch (error) {
      setMessageTone('error');
      setMessage(
        error instanceof Error ? error.message : 'Could not resend the verification email.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={autoRedirecting ? 'You’re all set' : 'Verify your email'}
      subtitle={
        autoRedirecting ? (
          <>Hang tight — we’re signing you in and opening your dashboard.</>
        ) : (
          <>
            We sent a verification link to your email <br />
            {email}
          </>
        )
      }
    >
      {message && (
        <p
          className={`m-0 rounded-md p-3 text-sm leading-[1.45] ${
            autoRedirecting || messageTone === 'success'
              ? 'bg-[var(--color-success-wash,#e8f5ee)] text-[var(--color-ink-muted)]'
              : 'bg-[var(--color-danger-wash)] font-extrabold text-[var(--color-danger-dark)]'
          }`}
          role="status"
        >
          {message}
        </p>
      )}

      {autoRedirecting ? (
        <div
          className="grid place-items-center gap-3 py-6"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span
            className="inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--color-primary)]/25 border-t-[var(--color-primary)]"
            aria-hidden="true"
          />
          <p className="m-0 text-sm text-[var(--color-text-sub)]">Redirecting…</p>
        </div>
      ) : (
        <>
          <EmailInboxHint email={typeof email === 'string' ? email : undefined} />
          <div className="grid gap-[18px]">
            <button
              type="button"
              onClick={() => void continueAfterVerification()}
              disabled={busy}
              className="mb-2 h-[57px] w-full rounded-[15px] bg-[var(--color-primary)] text-base font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? 'Continuing…' : 'I have verified my email'}
            </button>
            <div className="grid justify-center">
              <p className="text-[15px] text-[var(--color-text-sub)]">
                Didn’t receive the link?{' '}
                <button
                  type="button"
                  disabled={busy}
                  onClick={resendVerification}
                  className="font-medium text-[var(--color-primary)] disabled:opacity-50"
                >
                  {busy ? 'Sending…' : 'Click to resend'}
                </button>
              </p>
            </div>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
