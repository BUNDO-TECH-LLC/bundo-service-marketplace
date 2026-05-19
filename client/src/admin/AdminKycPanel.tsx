import { api } from '../lib/api';
import { bookingDate } from '../lib/bookingDisplay';
import type { ActionRunner, AdminArtisanRecord } from '../appTypes';
import type { ArtisanKycSubmission } from '../types';
import { AdminPortfolioGallery } from '../components/AdminPortfolioGallery';
import { EmptyState } from '../components/EmptyState';

export function AdminKycPanel({
  token,
  submissions,
  artisans: _artisans,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  submissions: ArtisanKycSubmission[];
  artisans?: AdminArtisanRecord[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  async function reviewSubmission(
    submissionId: string,
    status: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'
  ) {
    const reviewNote = window.prompt(
      status === 'APPROVED'
        ? 'Optional approval note'
        : 'Add a short note for the artisan',
      ''
    );

    await api(`/admin/kyc-submissions/${submissionId}/review`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        status,
        reviewNote: reviewNote || undefined,
      }),
    });
    await refresh();
  }

  return (
    <section className="admin-bookings">
      <div className="section-head compact">
        <div>
          <p className="eyebrow">Compliance</p>
          <h2>Artisan KYC review</h2>
          <p>Review submitted identity details before scaling artisan approvals and payouts.</p>
        </div>
      </div>

      {submissions.length === 0 && (
        <EmptyState
          title="No KYC submissions yet"
          body="Artisan KYC submissions will appear here once providers start sending their identity details."
        />
      )}

      <div className="booking-list">
        {submissions.map((submission) => (
          <article className="booking-detail-card" key={submission.id}>
            <header className="booking-detail-head">
              <div className="booking-person">
                <span>{(submission.legalName || 'K').slice(0, 1).toUpperCase()}</span>
                <div>
                  <h3>{submission.legalName}</h3>
                  <p>{submission.artisan?.displayName || submission.artisan?.user?.email || 'Artisan submission'}</p>
                </div>
              </div>
              <span className={`booking-status ${submission.status.toLowerCase().replace(/_/g, '-')}`}>
                {submission.status.toLowerCase().replace(/_/g, ' ')}
              </span>
            </header>

            <dl className="booking-detail-list">
              <div>
                <dt>Document</dt>
                <dd>{submission.documentType}</dd>
              </div>
              <div>
                <dt>Number</dt>
                <dd>{submission.documentNumber}</dd>
              </div>
              <div>
                <dt>City</dt>
                <dd>{submission.city}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{submission.address}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{bookingDate(submission.submittedAt)}</dd>
              </div>
              <div>
                <dt>Document URL</dt>
                <dd>
                  <a href={submission.documentImageUrl} target="_blank" rel="noreferrer">
                    Open document
                  </a>
                </dd>
              </div>
            </dl>

            <div className="admin-review-photos">
              <h4>Portfolio photos ({submission.artisan?.portfolioImages?.length ?? 0})</h4>
              <AdminPortfolioGallery
                images={submission.artisan?.portfolioImages ?? []}
                artisanName={submission.artisan?.displayName}
              />
            </div>

            <div className="booking-card-actions">
              <button
                className="primary-action"
                disabled={busy || submission.status === 'APPROVED'}
                onClick={() =>
                  runAction(
                    () => reviewSubmission(submission.id, 'APPROVED'),
                    'KYC approved'
                  )
                }
              >
                Approve
              </button>
              <button
                className="secondary-button"
                disabled={busy || submission.status === 'CHANGES_REQUESTED'}
                onClick={() =>
                  runAction(
                    () => reviewSubmission(submission.id, 'CHANGES_REQUESTED'),
                    'KYC returned for changes'
                  )
                }
              >
                Request changes
              </button>
              <button
                className="secondary-button"
                disabled={busy || submission.status === 'REJECTED'}
                onClick={() =>
                  runAction(
                    () => reviewSubmission(submission.id, 'REJECTED'),
                    'KYC rejected'
                  )
                }
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}