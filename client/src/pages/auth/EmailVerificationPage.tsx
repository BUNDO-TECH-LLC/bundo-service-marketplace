import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { api, ApiError } from '../../lib/api';
import { resolveApiSession } from '../../lib/authSession';
import { EmailInboxHint } from '../../components/EmailInboxHint';
import { sendBundoEmailVerification } from '../../lib/authEmailVerification';
import { auth } from '../../lib/firebase';

type VerificationState = {
  email?: string;
  accountKind?: 'CUSTOMER' | 'ARTISAN';
};

export function EmailVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as VerificationState;

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const email = state.email || auth?.currentUser?.email || 'your email';

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
      await sendBundoEmailVerification(auth.currentUser);
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
    navigate('/login');
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

    const session = await resolveApiSession(auth.currentUser, true);
    const accountKind = state.accountKind || 'CUSTOMER';

    if (!session.user.role) {
      await api('/users/role', {
        method: 'PATCH',
        token: session.token,
        body: JSON.stringify({ role: accountKind }),
      });
    }

    navigate('/loading', {
      state: {
        redirectTo: accountKind === 'ARTISAN' ? '/workspace/overview' : '/',
      },
    });
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
