import { useState } from 'react';
import { isArtisanApplicant, markArtisanApplicant } from '../../lib/artisanApplication';
import type { ApiUser } from '../../types';

export function BecomeArtisanButton({
  me,
  token,
  busy,
  onStart,
  onApplicantMarked,
}: {
  me: ApiUser;
  token: string;
  busy?: boolean;
  onStart: () => void;
  onApplicantMarked?: (user: ApiUser) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const alreadyApplicant = isArtisanApplicant(me);

  if (me.role === 'ARTISAN' || me.role === 'ADMIN') {
    return null;
  }

  if (alreadyApplicant) {
    return (
      <button
        type="button"
        className="secondary-button become-artisan-button"
        disabled={busy}
        onClick={onStart}
      >
        Continue artisan onboarding
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="become-artisan-confirm">
        <div className="auth-status-card">
          <strong>Start offering services on Bundo?</strong>
          <span>
            You are switching from a client account to the artisan onboarding path. You will set up a public profile,
            services, and identity verification. You cannot receive paid bookings until admin approves you. You can still
            book services as a client while your application is pending.
          </span>
        </div>
        <ul className="become-artisan-confirm-list">
          <li>Your account stays a client until verification is approved.</li>
          <li>Three quick setup steps, then a separate identity verification review.</li>
          <li>This is intended for people who want to sell services—not only book them.</li>
        </ul>
        <div className="auth-action-stack">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void (async () => {
                const updated = await markArtisanApplicant(token, me.firebaseUid);
                if (updated) {
                  onApplicantMarked?.(updated);
                }
                setConfirming(false);
                onStart();
              })();
            }}
          >
            Yes, start artisan onboarding
          </button>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="secondary-button become-artisan-button"
      disabled={busy}
      onClick={() => setConfirming(true)}
    >
      Become an artisan
    </button>
  );
}
