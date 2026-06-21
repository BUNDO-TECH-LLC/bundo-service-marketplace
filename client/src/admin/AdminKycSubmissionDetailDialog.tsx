import { useEffect } from 'react';
import { bookingDate } from '../lib/bookingDisplay';
import type { ArtisanKycSubmission } from '../types';
import { AdminPortfolioGallery } from '../components/AdminPortfolioGallery';

function maskDocumentNumber(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return '••••';
  }

  return `•••• ${trimmed.slice(-4)}`;
}

function statusLabel(status: ArtisanKycSubmission['status']) {
  return status.toLowerCase().replace(/_/g, ' ');
}

function statusClass(status: ArtisanKycSubmission['status']) {
  return status.toLowerCase().replace(/_/g, '-');
}

export function AdminKycSubmissionDetailDialog({
  submission,
  busy,
  onClose,
  onApprove,
  onRequestChanges,
  onReject,
}: {
  submission: ArtisanKycSubmission;
  busy: boolean;
  onClose: () => void;
  onApprove: () => void;
  onRequestChanges: () => void;
  onReject: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const portfolioCount = submission.artisan?.portfolioImages?.length ?? 0;
  const artisanLabel =
    submission.artisan?.displayName || submission.artisan?.user?.email || 'Artisan submission';

  return (
    <div className="prompt-dialog-backdrop" role="presentation" onClick={onClose}>
      <article
        className="prompt-dialog admin-kyc-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-kyc-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-kyc-detail-head">
          <div>
            <p className="eyebrow">Verification review</p>
            <h2 id="admin-kyc-detail-title">{submission.legalName}</h2>
            <p className="admin-kyc-detail-sub">{artisanLabel}</p>
          </div>
          <button type="button" className="secondary-button admin-kyc-detail-close" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="admin-kyc-detail-body">
          <div className="admin-kyc-detail-summary">
            <span className={`booking-status ${statusClass(submission.status)}`}>
              {statusLabel(submission.status)}
            </span>
            <span className="admin-kyc-detail-meta">
              Submitted {bookingDate(submission.submittedAt)}
            </span>
          </div>

          <dl className="admin-kyc-detail-fields">
            <div>
              <dt>Document type</dt>
              <dd>{submission.documentType}</dd>
            </div>
            <div>
              <dt>Document number</dt>
              <dd>{maskDocumentNumber(submission.documentNumber)}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>{submission.city}</dd>
            </div>
            <div className="admin-kyc-detail-fields-wide">
              <dt>Address</dt>
              <dd>{submission.address}</dd>
            </div>
            {submission.reviewNote ? (
              <div className="admin-kyc-detail-fields-wide">
                <dt>Previous review note</dt>
                <dd>{submission.reviewNote}</dd>
              </div>
            ) : null}
          </dl>

          <section className="admin-kyc-detail-media">
            <h3>Identity documents</h3>
            <div className="admin-kyc-detail-media-grid">
              <article className="admin-kyc-media-card">
                <p className="admin-kyc-media-label">Government ID</p>
                <a
                  className="admin-kyc-media-open"
                  href={submission.documentImageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open full document
                </a>
                <a
                  className="admin-kyc-media-preview"
                  href={submission.documentImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open government ID document"
                >
                  <img src={submission.documentImageUrl} alt="" loading="lazy" />
                </a>
              </article>

              {submission.selfieImageUrl ? (
                <article className="admin-kyc-media-card">
                  <p className="admin-kyc-media-label">Selfie</p>
                  <a
                    className="admin-kyc-media-open"
                    href={submission.selfieImageUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open full photo
                  </a>
                  <a
                    className="admin-kyc-media-preview"
                    href={submission.selfieImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open selfie photo"
                  >
                    <img src={submission.selfieImageUrl} alt="" loading="lazy" />
                  </a>
                </article>
              ) : null}
            </div>
          </section>

          <section className="admin-kyc-detail-media">
            <h3>Portfolio ({portfolioCount})</h3>
            <AdminPortfolioGallery
              images={submission.artisan?.portfolioImages ?? []}
              artisanName={submission.artisan?.displayName}
            />
          </section>
        </div>

        <footer className="admin-kyc-detail-actions">
          <button
            type="button"
            className="primary-action"
            disabled={busy || submission.status === 'APPROVED'}
            onClick={onApprove}
          >
            Approve
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy || submission.status === 'CHANGES_REQUESTED'}
            onClick={onRequestChanges}
          >
            Request changes
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy || submission.status === 'REJECTED'}
            onClick={onReject}
          >
            Reject
          </button>
        </footer>
      </article>
    </div>
  );
}
