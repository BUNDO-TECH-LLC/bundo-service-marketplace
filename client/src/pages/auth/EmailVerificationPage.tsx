import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppRoot } from '../../app/appRootContext';
import { AuthLayout } from '../../layouts/AuthLayout';
import { ApiError } from '../../lib/api';
import { EmailInboxHint } from '../../components/EmailInboxHint';
import { resendBundoEmailVerification } from '../../lib/verificationEmailResend';
import { ARTISAN_ONBOARDING_PATH, clearArtisanApplicantOnServer, markArtisanApplicant } from '../../lib/artisanApplication';
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

export function EmailVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useAppRoot();
  const state = (location.state || {}) as VerificationState;

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkApplied, setLinkApplied] = useState(false);

  const email = state.email || auth?.currentUser?.email || 'your email';

  useEffect(() => {
    if (!auth?.currentUser) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const result = await completeFirebaseEmailAction(auth, location.search);
        if (cancelled || !result.handled) {
          return;
        }

        setLinkApplied(true);
        if (result.verified) {
          setMessage('Email verified from your link. Tap the button below to continue into Bundo.');
        } else {
          setMessage('We received your verification link. Tap the button below to finish signing in.');
        }

        const cleaned = stripFirebaseEmailActionParams(location.search);
        navigate({ pathname: location.pathname, search: cleaned }, { replace: true });
      } catch (error) {
        if (!cancelled) {
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
  }, [location.pathname, location.search, navigate]);

  function maskEmail(email: string) {
    if (!email.includes('@')) return email;

    const [name, domain] = email.split('@');
    const visibleName = name.slice(0, 4);

    return `${visibleName}•••••@${domain}`;
  }

  async function resendVerification() {
    if (!auth?.currentUser) {
      setMessage('Login again so we can resend your verification email.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      await resendBundoEmailVerification(auth.currentUser);
      setMessage('Verification link sent again. Check your inbox and spam folder.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not resend the verification email.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function continueAfterVerification() {
  if (!auth?.currentUser) {
    navigate({ pathname: '/', search: buildAuthDrawerSearch({ mode: 'login' }) });
    return;
  }

  setBusy(true);
  setMessage('');

  try {
    await auth.currentUser.reload();

    if (!auth.currentUser.emailVerified) {
      setMessage(
        'Your email is not verified yet. Click the link in your inbox (or spam folder), then try again.'
      );
      return;
    }

    const pendingPhone =
      state.phone || readPendingSignupPhone(auth.currentUser.email) || undefined;
    const signupIntent =
      state.accountKind ||
      readPendingVerificationRole(auth.currentUser.email) ||
      resolveSignupIntent(auth.currentUser.email) ||
      undefined;

    const { session } = await finalizeAuthSession(auth.currentUser, {
      mode: 'signup',
      phone: pendingPhone,
      forceTokenRefresh: true,
      intendedRole: signupIntent === 'CUSTOMER' ? 'CUSTOMER' : undefined,
    });

    clearPendingVerificationRole(auth.currentUser.email);

    ctx.acknowledgeSession(session.token, session.user);
    await ctx.loadPrivateData(session.token, session.user).catch(() => undefined);

    if (signupIntent === 'ARTISAN') {
      const updated = await markArtisanApplicant(session.token, session.user.firebaseUid);
      ctx.acknowledgeSession(session.token, updated || session.user);
      navigate(ARTISAN_ONBOARDING_PATH, { replace: true });
      return;
    }

    const cleared = await clearArtisanApplicantOnServer(session.token, session.user.firebaseUid);
    const nextUser = cleared || session.user;
    ctx.acknowledgeSession(session.token, nextUser);

    if (!isCustomerProfileComplete(nextUser)) {
      navigate(CUSTOMER_PROFILE_PATH, { replace: true });
      return;
    }

    navigate(destinationForRole(nextUser.role) || '/workspace/overview', { replace: true });
  } catch (error) {
    setMessage(
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Could not finish signing you in after verification.'
    );
  } finally {
    setBusy(false);
  }
}

  return (
     <AuthLayout
    title="Verify your email"
    subtitle={
      <>
        We sent a verification link to your email <br />
        {email}
      </>
    }
  >
      {message && (
        <p
          className={`m-0 rounded-md p-3 text-sm leading-[1.45] ${
            linkApplied
              ? 'bg-[var(--color-success-wash,#e8f5ee)] text-[var(--color-ink-muted)]'
              : 'bg-[var(--color-danger-wash)] font-extrabold text-[var(--color-danger-dark)]'
          }`}
          role="status"
        >
          {message}
        </p>
      )}
      <EmailInboxHint email={typeof email === 'string' ? email : undefined} />
      <div className="grid gap-[18px]">
        <button
          type="button"
          onClick={continueAfterVerification}
          className="mb-8 h-[57px] w-full rounded-[15px] bg-[var(--color-primary)] text-base font-medium text-white hover:opacity-90"
        >
          I have verified my email
        </button>
        <div className='grid justify-center'>
        <p className="text-[15px] text-[var(--color-text-sub)]">
          Didn’t receive the link?{' '}
          <button
            type="button"
            disabled={busy}
            onClick={resendVerification}
            className="font-medium text-[var(--color-primary)] disabled:opacity-50"
          >
            {busy ? 'Sending...' : 'Click to resend'}
          </button>
        </p>
        </div>
      </div>
    </AuthLayout>
  );
}
