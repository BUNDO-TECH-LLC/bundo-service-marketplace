import { Navigate } from 'react-router-dom';
import { useAppRoot } from '../app/appRootContext';
import {
  ARTISAN_ONBOARDING_PATH,
  isArtisanApplicantSession,
  markArtisanWelcomeSeen,
} from '../lib/artisanApplication';

export default function ArtisanOnboardingWelcomePage() {
  const ctx = useAppRoot();

  if (!ctx.isAuthed || !ctx.me) {
    return <Navigate to="/" replace />;
  }

  if (ctx.me.role === 'ARTISAN') {
    return <Navigate to={ARTISAN_ONBOARDING_PATH} replace />;
  }

  if (ctx.me.role === 'ADMIN') {
    return <Navigate to="/admin/overview" replace />;
  }

  if (!isArtisanApplicantSession(ctx.me.firebaseUid)) {
    return <Navigate to="/" replace />;
  }

  const displayName =
    ctx.firebaseUser?.displayName?.split(' ')[0] ||
    ctx.me.email?.split('@')[0] ||
    'there';

  function startOnboarding() {
    markArtisanWelcomeSeen(ctx.me!.firebaseUid);
    ctx.setNotice('');
    ctx.navigate(ARTISAN_ONBOARDING_PATH);
  }

  return (
    <main className="artisan-welcome-page">
      <section className="artisan-welcome-card">
        <div className="artisan-welcome-icon" aria-hidden>
          ✓
        </div>
        <p className="eyebrow">Artisan account confirmed</p>
        <h1>Welcome, {displayName} — let&apos;s set up your business</h1>
        <p className="artisan-welcome-lead">
          Your login is ready. Next you will complete your public profile, service offerings, identity
          verification, and availability. After admin approval you will get full access to jobs, messages, and
          payouts on the artisan side of Bundo.
        </p>

        <ul className="artisan-welcome-checklist">
          <li>
            <strong>Profile &amp; offerings</strong>
            <span>Describe your services and pricing so clients can find you.</span>
          </li>
          <li>
            <strong>Verification (KYC)</strong>
            <span>Upload ID and business details for admin review.</span>
          </li>
          <li>
            <strong>Go live after approval</strong>
            <span>Receive bookings and manage your artisan workspace.</span>
          </li>
        </ul>

        <div className="auth-action-stack">
          <button type="button" onClick={startOnboarding} disabled={ctx.busy}>
            Start artisan onboarding
          </button>
          <button
            type="button"
            className="mode-switch"
            onClick={() => ctx.navigate('/')}
          >
            Back to home
          </button>
        </div>
      </section>
    </main>
  );
}
