import type { Artisan, ArtisanKycSubmission } from '../types';
import { kycStatusLabel } from '../lib/artisanVerification';
import { bookingDate } from '../lib/bookingDisplay';

export function ArtisanPendingApproval({
  profile,
  kycSubmission,
  variant = 'submitted',
  onEditSubmission,
}: {
  profile: Artisan | null;
  kycSubmission: ArtisanKycSubmission | null;
  variant?: 'submitted' | 'changes_requested' | 'rejected';
  onEditSubmission?: () => void;
}) {
  const displayName = profile?.displayName || 'Artisan';
  const submittedAt = kycSubmission?.submittedAt
    ? bookingDate(kycSubmission.submittedAt)
    : kycSubmission?.createdAt
      ? bookingDate(kycSubmission.createdAt)
      : 'Just now';

  return (
    <main className="artisan-pending-page">
      <section className="artisan-pending-card">
        <div className={`artisan-pending-icon ${variant === 'rejected' ? 'is-rejected' : ''}`} aria-hidden>
          {variant === 'rejected' ? '!' : '✓'}
        </div>

        <p className="eyebrow">
          {variant === 'rejected'
            ? 'Verification update'
            : variant === 'changes_requested'
              ? 'Action needed'
              : 'Application received'}
        </p>
        <h1>
          {variant === 'rejected'
            ? 'Your application was not approved'
            : variant === 'changes_requested'
              ? 'We need a few updates before approval'
              : `Thanks, ${displayName.split(' ')[0]} — you're on the list`}
        </h1>
        <p className="artisan-pending-lead">
          {variant === 'rejected'
            ? 'You can update your profile and KYC details, then submit again for review.'
            : variant === 'changes_requested'
              ? 'Our team reviewed your submission and left notes. Update your details and resubmit so we can finish verification.'
              : 'Your artisan profile is complete and with our verification team. You will get an in-app notification as soon as you are approved.'}
        </p>

        <div className="artisan-pending-status-row">
          <span className={`booking-status ${variant === 'rejected' ? 'declined' : 'appointment'}`}>
            {variant === 'rejected' ? 'Not approved' : 'Profile awaiting approval'}
          </span>
          <span className="booking-status requested">{kycStatusLabel(kycSubmission?.status ?? 'PENDING')}</span>
        </div>

        <dl className="artisan-pending-meta">
          <div>
            <dt>Submitted</dt>
            <dd>{submittedAt}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{profile?.city || '—'}{profile?.area ? ` · ${profile.area}` : ''}</dd>
          </div>
          {kycSubmission?.reviewNote && variant === 'changes_requested' && (
            <div className="full">
              <dt>Team notes</dt>
              <dd>{kycSubmission.reviewNote}</dd>
            </div>
          )}
        </dl>

        <div className="artisan-pending-timeline">
          <h2>What happens next</h2>
          <ol>
            <li>
              <strong>We review your KYC and profile</strong>
              <span>Usually within 1–2 business days.</span>
            </li>
            <li>
              <strong>You receive a notification</strong>
              <span>Approved artisans unlock jobs, messages, and payouts setup.</span>
            </li>
            <li>
              <strong>Your public profile goes live</strong>
              <span>Customers can discover you and send booking requests.</span>
            </li>
          </ol>
        </div>

        <aside className="artisan-pending-callout">
          <strong>While you wait</strong>
          <p>
            Jobs, marketplace visibility, and customer messaging stay locked until approval. You can
            still sign out, read Help, or check notifications once they arrive.
          </p>
        </aside>

        {(variant === 'changes_requested' || variant === 'rejected') && onEditSubmission && (
          <div className="artisan-pending-actions">
            <button type="button" className="primary-action" onClick={onEditSubmission}>
              {variant === 'rejected' ? 'Update and resubmit' : 'Update submission'}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
