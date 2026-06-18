import { ArtisanPortfolioManager } from '../components/ArtisanPortfolioManager';
import { ArtisanPayoutSection } from '../features/artisan/ArtisanPayoutSection';
import type { ActionRunner } from '../appTypes';
import type { Artisan, ArtisanKycSubmission, PortfolioImage } from '../types';
import { kycStatusLabel } from '../lib/artisanVerification';
import { bookingDate } from '../lib/bookingDisplay';

const SUPPORT_EMAIL = 'support@bundo.ng';

export function ArtisanPendingApproval({
  profile,
  kycSubmission,
  variant = 'submitted',
  onEditSubmission,
  portfolioImages = [],
  busy = false,
  uploadingPortfolio = false,
  runAction,
  uploadPortfolioFile,
  uploadPortfolioFiles,
  removePortfolioImage,
  token,
  onOpenHelp,
}: {
  profile: Artisan | null;
  kycSubmission: ArtisanKycSubmission | null;
  variant?: 'submitted' | 'changes_requested' | 'rejected';
  onEditSubmission?: () => void;
  portfolioImages?: PortfolioImage[];
  busy?: boolean;
  uploadingPortfolio?: boolean;
  runAction?: ActionRunner;
  uploadPortfolioFile?: (file: File, displayOrder: number) => Promise<void>;
  uploadPortfolioFiles?: (files: File[]) => Promise<void>;
  removePortfolioImage?: (imageId: string) => Promise<void>;
  token?: string;
  onOpenHelp?: () => void;
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
            ? 'You can update your public profile or resubmit verification, then wait for review.'
            : variant === 'changes_requested'
              ? 'Our team reviewed your submission and left notes. Update your details and resubmit so we can finish verification.'
              : 'Your profile is with our verification team. You can still complete the checklist below while you wait.'}
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
            <dd>
              {profile?.city || '—'}
              {profile?.area ? ` · ${profile.area}` : ''}
            </dd>
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
              <strong>Submitted</strong>
              <span>Your profile and verification details are in our queue.</span>
            </li>
            <li>
              <strong>Under review (24–48 hours)</strong>
              <span>Our team checks your identity and service details.</span>
            </li>
            <li>
              <strong>Approved</strong>
              <span>You receive a notification and can start receiving bookings.</span>
            </li>
            <li>
              <strong>Go live</strong>
              <span>Your public profile appears in the marketplace.</span>
            </li>
          </ol>
        </div>

        <aside className="artisan-pending-callout">
          <strong>While you wait</strong>
          <ul className="become-artisan-confirm-list">
            <li>Add portfolio photos below to strengthen your profile.</li>
            <li>Set up your payout bank account so you are ready on day one.</li>
            <li>Read how bookings and payments work in Help.</li>
          </ul>
          <p className="muted">
            Need help? Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            {onOpenHelp ? (
              <>
                {' '}
                or{' '}
                <button type="button" className="link-button" onClick={onOpenHelp}>
                  open Help
                </button>
              </>
            ) : null}
            .
          </p>
        </aside>

        {token && runAction && (
          <div className="artisan-pending-payout">
            <ArtisanPayoutSection token={token} busy={busy} runAction={runAction} />
          </div>
        )}

        {runAction && uploadPortfolioFile && uploadPortfolioFiles && removePortfolioImage && (
          <ArtisanPortfolioManager
            variant="pending"
            portfolioImages={portfolioImages}
            busy={busy}
            uploadingPortfolio={uploadingPortfolio}
            runAction={runAction}
            uploadPortfolioFile={uploadPortfolioFile}
            uploadPortfolioFiles={uploadPortfolioFiles}
            removePortfolioImage={removePortfolioImage}
          />
        )}

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
