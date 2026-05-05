import { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
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

  async function resendVerification() {
    if (!auth?.currentUser) {
      setMessage('Login again so we can resend your verification email.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      await sendEmailVerification(auth.currentUser);
      setMessage('Verification email sent again.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not resend the verification email.');
    } finally {
      setBusy(false);
    }
  }

  async function continueAfterVerification() {
    if (!auth?.currentUser) {
      navigate('/login');
      return;
    }

    await auth.currentUser.reload();

    if (!auth.currentUser.emailVerified) {
      setMessage('Your email is not verified yet. Check your inbox, then try again.');
      return;
    }

    navigate(state.accountKind === 'ARTISAN' ? '/?view=workspace' : '/');
  }

  return (
    <AuthLayout title="Check your inbox">
      <div className="grid gap-[18px]">
        <p className="m-0 leading-[1.55] text-[var(--color-muted)]">We sent a verification link to {email}.</p>
        <p className="m-0 leading-[1.55] text-[var(--color-muted)]">
          After verification, customers can continue booking services and artisans can move into profile and KYC onboarding.
        </p>

        {message && (
          <p className="m-0 rounded-md bg-[var(--color-accent-soft)] p-3 text-sm leading-[1.45] font-extrabold text-[var(--color-accent-dark)]">
            {message}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
          <button
            className="min-h-12 rounded-md bg-[var(--color-accent)] px-[18px] py-[13px] font-extrabold text-[var(--color-white)] hover:bg-[var(--color-accent-dark)]"
            type="button"
            onClick={continueAfterVerification}
          >
            I have verified my email
          </button>
          <button
            className="min-h-12 rounded-md bg-[var(--color-soft)] px-[18px] py-[13px] font-extrabold text-[var(--color-ink)] hover:bg-[var(--color-neutral-hover)] disabled:cursor-not-allowed disabled:opacity-55"
            type="button"
            disabled={busy}
            onClick={resendVerification}
          >
            {busy ? 'Sending...' : 'Resend email'}
          </button>
        </div>

        <Link className="font-black text-[var(--color-accent-dark)]" to="/login">
          Back to login
        </Link>
      </div>
    </AuthLayout>
  );
}
