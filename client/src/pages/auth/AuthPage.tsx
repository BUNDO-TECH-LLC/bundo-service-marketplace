import { FormEvent, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { api } from '../../lib/api';
import { resolveApiSession } from '../../lib/authSession';
import { sendBundoEmailVerification } from '../../lib/authEmailVerification';
import { auth, firebaseReady } from '../../lib/firebase';
import type { Role } from '../../types';
import googleLogo from '../../assets/icons/material-icon-theme_google.svg';
import appleLogo from '../../assets/icons/Vector.svg';
import LoadingPage from '../LoadingPage';
import { PasswordInput } from '../../components/PasswordInput';

type AuthMode = 'login' | 'signup';
type AccountKind = Extract<Role, 'CUSTOMER' | 'ARTISAN'>;

type AuthPageProps = {
  mode: AuthMode;
};

const labelClassName = 'grid gap-[7px] text-sm font-medium text-[var(--color-text-muted)]';
const requiredLabelClassName = 'inline-flex gap-px';
const requiredMarkClassName = 'not-italic text-[var(--color-accent-bright)]';
const inputClassName =
  'min-h-[43px] w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-white)] px-3.5 py-2.5 text-[15px] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] focus:ring-3 focus:ring-[var(--color-accent-soft)]';
const errorClassName =
  'm-0 rounded-md bg-[var(--color-danger-wash)] p-3 text-sm leading-[1.45] font-extrabold text-[var(--color-danger-dark)]';

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialRole = searchParams.get('role') === 'artisan' ? 'ARTISAN' : 'CUSTOMER';

  const [accountKind] = useState<AccountKind>(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showLoading, setShowLoading] = useState(false);
  const [nextRoute, setNextRoute] = useState('/');

  const title = mode === 'login' ? 'Welcome back!' : 'Create an account';
  const action = mode === 'login' ? 'Log in' : 'Get Started';

  function showLoadingThenNavigate(route: string) {
    setNextRoute(route);
    setShowLoading(true);

    setTimeout(() => {
      navigate(route);
    }, 3200);
  }

  async function sendPasswordReset() {
    if (!auth) return;

    if (!email.trim()) {
      setError('Enter your email first, then use forgot password.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setError('Password reset email sent. Check your inbox and spam folder.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not send password reset email.');
    } finally {
      setSubmitting(false);
    }
  }

  async function ensureRole(token: string, role: AccountKind) {
    await api('/users/role', {
      method: 'PATCH',
      token,
      body: JSON.stringify({ role }),
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth) return;

    setError('');

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      if (mode === 'login') {
        const credential = await signInWithEmailAndPassword(auth, email, password);

        const session = await resolveApiSession(credential.user);

        const destination =
          session.user.role === 'ARTISAN' || session.user.role === 'ADMIN'
            ? '/?view=workspace'
            : '/customer/dashboard';

        showLoadingThenNavigate(destination);
        return;
      }

      const credential = await createUserWithEmailAndPassword(auth, email, password);

      if (fullName.trim()) {
        await updateProfile(credential.user, { displayName: fullName.trim() });
      }

      await sendBundoEmailVerification(credential.user);

      const session = await resolveApiSession(credential.user);
      await ensureRole(session.token, accountKind);

      navigate('/verify-email', {
        state: {
          email,
          accountKind,
        },
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (showLoading) {
    return <LoadingPage />;
  }

  return (
    <AuthLayout
      title={title}
      subtitle={
        mode === 'login' ? (
          <>
            Do not have an account?{' '}
            <Link className="font-medium text-[var(--color-accent-link)] no-underline" to="/create-account">
              Create account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link className="font-medium text-[var(--color-accent-link)] no-underline" to="/login">
              Log in
            </Link>
          </>
        )
      }
    >
      <div className="grid gap-4">
        <button
          className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-white)] text-base font-bold text-[var(--color-ink-soft)] hover:bg-[var(--color-soft)]"
          type="button"
          onClick={() => setError('Google sign-in is not connected yet.')}
        >
          <img className="h-[20px] w-[20px]" src={googleLogo} alt="Google logo" />
          Continue with Google
        </button>

        <button
          className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-[var(--color-apple-black)] bg-[var(--color-apple-black)] text-base font-bold text-[var(--color-white)] hover:bg-[var(--color-black)]"
          type="button"
          onClick={() => setError('Apple sign-in is not connected yet.')}
        >
          <img className="h-[20px] w-[20px]" src={appleLogo} alt="Apple logo" />
          Continue with Apple
        </button>
      </div>

      <div className="mt-4 mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-[var(--color-text-faint)] before:h-px before:bg-[var(--color-line-softer)] before:content-[''] after:h-px after:bg-[var(--color-line-softer)] after:content-['']">
        <span>Or</span>
      </div>

      <form className="grid gap-3.5" onSubmit={submit}>
        {mode === 'signup' && (
          <label className={labelClassName}>
            <span className={requiredLabelClassName}>
              Name<em className={requiredMarkClassName}>*</em>
            </span>
            <input
              className={inputClassName}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Enter your name"
              type="text"
              autoComplete="name"
              required
            />
          </label>
        )}

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

        {mode === 'signup' && (
          <label className={labelClassName}>
            <span className={requiredLabelClassName}>
              Phone Number<em className={requiredMarkClassName}>*</em>
            </span>
            <input
              className={inputClassName}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Enter your phone number"
              type="tel"
              autoComplete="tel"
              required
            />
          </label>
        )}

        <label className={labelClassName}>
          <span className={requiredLabelClassName}>
            Password<em className={requiredMarkClassName}>*</em>
          </span>
          <PasswordInput
            wrapClassName="password-input-wrap--auth-page"
            value={password}
            onChange={setPassword}
            placeholder={mode === 'login' ? 'Enter your password' : 'Create a password'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'signup' ? 8 : undefined}
            required
          />
        </label>

        {mode === 'login' && (
          <button
            className="min-h-auto w-max justify-self-end bg-transparent p-0 text-sm leading-tight font-bold text-[var(--color-accent-link)] hover:bg-transparent hover:text-[var(--color-accent-dark)]"
            type="button"
            onClick={sendPasswordReset}
          >
            Forgot password?
          </button>
        )}

        {mode === 'signup' && (
          <label className={labelClassName}>
            <span className={requiredLabelClassName}>
              Confirm Password<em className={requiredMarkClassName}>*</em>
            </span>
            <PasswordInput
              wrapClassName="password-input-wrap--auth-page"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirm password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <small className="mt-[-3px] text-sm text-[var(--color-accent-bright)]">
              Must be at least 8 characters.
            </small>
          </label>
        )}

        {error && <p className={errorClassName}>{error}</p>}

        <button
          className="mt-2.5 min-h-14 rounded-2xl bg-[var(--color-accent-button)] px-[18px] py-[13px] text-base font-extrabold text-[var(--color-white)] hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-55"
          disabled={!firebaseReady || submitting}
          type="submit"
        >
          {submitting ? 'Please wait...' : action}
        </button>
      </form>
    </AuthLayout>
  );
}
