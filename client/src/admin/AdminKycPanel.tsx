import { useState } from 'react';
import { api } from '../lib/api';
import { bookingDate } from '../lib/bookingDisplay';
import { PromptDialog } from '../components/PromptDialog';
import type { ActionRunner } from '../appTypes';
import type { ArtisanKycSubmission } from '../types';
import { AdminPortfolioGallery } from '../components/AdminPortfolioGallery';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { useAdminList } from '../hooks/useAdminList';

export function AdminKycPanel({
  token,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [reviewPrompt, setReviewPrompt] = useState<null | {
    submissionId: string;
    status: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
  }>(null);
  const {
    items: submissions,
    total,
    page,
    limit,
    loading,
    setPage,
    reload,
  } = useAdminList<ArtisanKycSubmission>({
    token,
    path: '/admin/kyc-submissions',
    limit: 12,
    select: (response) => (response.submissions as ArtisanKycSubmission[]) ?? [],
  });

  async function submitReview(note: string) {
    if (!reviewPrompt) return;
    await api(`/admin/kyc-submissions/${reviewPrompt.submissionId}/review`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        status: reviewPrompt.status,
        reviewNote: note || undefined,
      }),
    });
    setReviewPrompt(null);
    await reload();
    await refresh();
  }

  return (
    <section className="admin-panel admin-kyc-panel">
      <p className="admin-panel-lead muted">
        Review identity submissions before approving artisans and releasing payouts.
      </p>

      <PromptDialog
        open={reviewPrompt !== null}
        title={
          reviewPrompt?.status === 'APPROVED'
            ? 'Approve KYC'
            : reviewPrompt?.status === 'REJECTED'
              ? 'Reject KYC'
              : 'Request KYC changes'
        }
        message="Add an optional note for the artisan."
        label="Review note"
        confirmLabel="Save"
        required={false}
        busy={busy}
        onCancel={() => setReviewPrompt(null)}
        onConfirm={(note) =>
          runAction(
            () => submitReview(note),
            reviewPrompt?.status === 'APPROVED'
              ? 'KYC approved'
              : reviewPrompt?.status === 'REJECTED'
                ? 'KYC rejected'
                : 'KYC returned for changes'
          )
        }
      />

      {loading && <p className="muted">Loading submissions…</p>}
      {!loading && submissions.length === 0 && (
        <EmptyState
          title="No KYC submissions yet"
          body="Artisan KYC submissions will appear here once providers start sending their identity details."
        />
      )}

      <div className="admin-inline-table" role="list">
        {submissions.map((submission) => (
          <article className="admin-row admin-row--kyc" key={submission.id} role="listitem">
            <div className="admin-row-grid admin-row-grid--kyc">
              <div className="admin-row-primary">
                <strong className="admin-row-title">{submission.legalName}</strong>
                <p className="admin-row-sub">
                  {submission.artisan?.displayName || submission.artisan?.user?.email || 'Artisan submission'}
                </p>
                <span className={`booking-status ${submission.status.toLowerCase().replace(/_/g, '-')}`}>
                  {submission.status.toLowerCase().replace(/_/g, ' ')}
                </span>
              </div>
              <dl className="admin-row-fields admin-row-fields--compact">
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
                  <dt>Submitted</dt>
                  <dd>{bookingDate(submission.submittedAt)}</dd>
                </div>
                <div className="admin-row-fields-wide">
                  <dt>Address</dt>
                  <dd>{submission.address}</dd>
                </div>
                <div>
                  <dt>Document</dt>
                  <dd>
                    <a href={submission.documentImageUrl} target="_blank" rel="noreferrer">
                      Open file
                    </a>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="admin-review-photos admin-review-photos--inline">
              <p className="admin-row-photo-label">
                Portfolio ({submission.artisan?.portfolioImages?.length ?? 0})
              </p>
              <AdminPortfolioGallery
                images={submission.artisan?.portfolioImages ?? []}
                artisanName={submission.artisan?.displayName}
              />
            </div>

            <div className="admin-row-actions admin-row-actions--inline">
              <button
                className="primary-action"
                disabled={busy || submission.status === 'APPROVED'}
                onClick={() =>
                  setReviewPrompt({ submissionId: submission.id, status: 'APPROVED' })
                }
              >
                Approve
              </button>
              <button
                className="secondary-button"
                disabled={busy || submission.status === 'CHANGES_REQUESTED'}
                onClick={() =>
                  setReviewPrompt({ submissionId: submission.id, status: 'CHANGES_REQUESTED' })
                }
              >
                Request changes
              </button>
              <button
                className="secondary-button"
                disabled={busy || submission.status === 'REJECTED'}
                onClick={() =>
                  setReviewPrompt({ submissionId: submission.id, status: 'REJECTED' })
                }
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>

      <Pagination page={page} limit={limit} total={total} busy={busy || loading} onPageChange={setPage} />
    </section>
  );
}
