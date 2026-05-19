import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmailInboxHint } from '../../components/EmailInboxHint';
import { AuthLayout } from '../../layouts/AuthLayout';
import { sendBundoPasswordResetEmail } from '../../lib/authEmailVerification';
import { firebaseReady } from '../../lib/firebase';

const labelClassName = 'grid gap-[7px] text-sm font-medium text-[var(--color-text-muted)]';
const requiredLabelClassName = 'inline-flex gap-px';
const requiredMarkClassName = 'not-italic text-[var(--color-accent-bright)]';
const inputClassName =
  'min-h-[43px] w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-white)] px-3.5 py-2.5 text-[15px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] focus:ring-3 focus:ring-[var(--color-accent-soft)]';
const errorClassName =
  'm-0 rounded-md bg-[var(--color-danger-wash)] p-3 text-sm leading-[1.45] font-extrabold text-[var(--color-danger-dark)]';
const successClassName =
  'm-0 rounded-md bg-[var(--color-success-wash,#e8f5ee)] p-3 text-sm leading-[1.45] font-semibold text-[var(--color-ink-muted)]';

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get('email')?.trim() || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Enter the email address for your Bundo account.');
      return;
    }

    setSubmitting(true);

    try {
      await sendBundoPasswordResetEmail(email);
      setSent(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not send password reset email.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={
        <>
          Remember your password?{' '}
          <Link className="font-medium text-[var(--color-accent-link)] no-underline" to="/login">
            Back to log in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="grid gap-4">
          <p className={successClassName}>
            If an account exists for <strong>{email.trim()}</strong>, we sent a reset link. Open it from your
            inbox to choose a new password.
          </p>
          <EmailInboxHint email={email.trim()} />
          <Link
            className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-[var(--color-accent-button)] px-[18px] py-[13px] text-base font-extrabold text-[var(--color-white)] no-underline hover:bg-[var(--color-primary-hover)]"
            to="/login"
          >
            Return to log in
          </Link>
        </div>
      ) : (
        <form className="grid gap-3.5" onSubmit={submit}>
          <p className="m-0 text-sm leading-relaxed text-[var(--color-text-sub)]">
            Enter your account email and we&apos;ll send a link to reset your password.
          </p>

          <label className={labelClassName}>
            <span className={requiredLabelClassName}>
              Email<em className={requiredMarkClassName}>*</em>
            </span>
            <input
              className={inputClassName}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          {error && <p className={errorClassName}>{error}</p>}

          <button
            className="mt-2.5 min-h-14 rounded-2xl bg-[var(--color-accent-button)] px-[18px] py-[13px] text-base font-extrabold text-[var(--color-white)] hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={!firebaseReady || submitting}
            type="submit"
          >
            {submitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
