import { useState } from 'react';
import type { User } from 'firebase/auth';
import { resendBundoEmailVerification } from '../../lib/verificationEmailResend';
import { needsEmailVerification } from '../../lib/authSignupStorage';
import type { ActionRunner } from '../../appTypes';

export function EmailVerificationReminder({
  firebaseUser,
  busy,
  runAction,
  onNotice,
}: {
  firebaseUser: User | null;
  busy: boolean;
  runAction: ActionRunner;
  onNotice: (message: string) => void;
}) {
  const [checking, setChecking] = useState(false);

  if (!firebaseUser || !needsEmailVerification(firebaseUser)) {
    return null;
  }

  const user = firebaseUser;

  async function resendVerification() {
    await resendBundoEmailVerification(user);
  }

  async function refreshStatus() {
    setChecking(true);
    try {
      await user.reload();
      if (user.emailVerified) {
        onNotice('Email verified. Thank you.');
        window.location.reload();
        return;
      }
      onNotice('Email is not verified yet. Open the link in your inbox, then check again.');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not refresh verification status.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <aside className="settings-email-reminder" role="status" aria-live="polite">
      <p className="settings-email-reminder-title">Verify your email</p>
      <p className="settings-email-reminder-copy">
        We sent a link to <strong>{user.email}</strong>. Confirm it when you can so we can reach you about
        bookings and account updates. You can keep using Bundo in the meantime.
      </p>
      <div className="settings-email-reminder-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={busy || checking}
          onClick={() =>
            void runAction(
              resendVerification,
              'Verification email sent. Check your inbox and spam folder.'
            )
          }
        >
          Resend verification email
        </button>
        <button type="button" className="text-button" disabled={busy || checking} onClick={() => void refreshStatus()}>
          I&apos;ve verified — check again
        </button>
      </div>
    </aside>
  );
}
