import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { bookingDate } from '../lib/bookingDisplay';
import type { ActionRunner } from '../appTypes';
import type { ArtisanKycSubmission, KycStatus } from '../types';
import { EmptyState } from '../components/EmptyState';
import { PromptDialog } from '../components/PromptDialog';
import { Pagination } from '../components/Pagination';
import { useAdminList } from '../hooks/useAdminList';
import { AdminKycSubmissionDetailDialog } from './AdminKycSubmissionDetailDialog';
import { AdminTableScrollHint } from './AdminTableScrollHint';

type KycStatusFilter = 'all' | Exclude<KycStatus, 'NOT_SUBMITTED'>;

const kycStatusFilters: Array<{ id: KycStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'CHANGES_REQUESTED', label: 'Changes requested' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
];

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

function fileSummary(submission: ArtisanKycSubmission) {
  const portfolioCount = submission.artisan?.portfolioImages?.length ?? 0;
  const parts = ['ID document'];
  if (submission.selfieImageUrl) {
    parts.push('selfie');
  }
  if (portfolioCount > 0) {
    parts.push(`${portfolioCount} portfolio`);
  }
  return parts.join(' · ');
}

export function AdminKycPanel({
  token,
  busy,
  runAction,
  refresh,
  navigationIntent,
}: {
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  navigationIntent?: {
    token: number;
    intent: { verification?: { status?: Exclude<KycStatus, 'NOT_SUBMITTED'> } };
  } | null;
}) {
  const [reviewPrompt, setReviewPrompt] = useState<null | {
    submissionId: string;
    status: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
  }>(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<KycStatusFilter>('all');

  useEffect(() => {
    const verificationIntent = navigationIntent?.intent.verification;
    if (!verificationIntent?.status) return;
    setStatusFilter(verificationIntent.status);
    setActiveSubmissionId(null);
  }, [navigationIntent?.token, navigationIntent?.intent.verification]);

  const statusParams = useMemo(
    () => (statusFilter === 'all' ? undefined : { status: statusFilter }),
    [statusFilter]
  );

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
    extraParams: statusParams,
    select: (response) => (response.submissions as ArtisanKycSubmission[]) ?? [],
  });

  const activeSubmission = submissions.find((item) => item.id === activeSubmissionId) ?? null;

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
    setActiveSubmissionId(null);
    await reload();
    await refresh();
  }

  function openReview(
    submission: ArtisanKycSubmission,
    status: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'
  ) {
    setActiveSubmissionId(null);
    setReviewPrompt({ submissionId: submission.id, status });
  }

  return (
    <section className="admin-panel admin-kyc-panel">
      <article className="admin-surface">
        <div className="admin-surface-head">
          <div>
            <p className="eyebrow">Verification queue</p>
            <h3>KYC submissions</h3>
            <p className="admin-panel-lead muted">
              Review identity submissions before approving artisans and releasing payouts. Open a row to
              inspect documents and portfolio photos.
            </p>
          </div>
          <span className="admin-surface-count">{total}</span>
        </div>

        <div className="admin-kyc-filters" role="tablist" aria-label="KYC status filters">
          {kycStatusFilters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === item.id}
              className={statusFilter === item.id ? 'active' : ''}
              disabled={busy || loading}
              onClick={() => {
                setStatusFilter(item.id);
                setActiveSubmissionId(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

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

        {activeSubmission ? (
          <AdminKycSubmissionDetailDialog
            submission={activeSubmission}
            busy={busy}
            onClose={() => setActiveSubmissionId(null)}
            onApprove={() => openReview(activeSubmission, 'APPROVED')}
            onRequestChanges={() => openReview(activeSubmission, 'CHANGES_REQUESTED')}
            onReject={() => openReview(activeSubmission, 'REJECTED')}
          />
        ) : null}

        {loading && <p className="muted">Loading submissions…</p>}
        {!loading && submissions.length === 0 && (
          <EmptyState
            title="No KYC submissions yet"
            body="Artisan KYC submissions will appear here once providers start sending their identity details."
          />
        )}

        {!loading && submissions.length > 0 && (
          <div className="admin-table-scroll-wrap">
            <AdminTableScrollHint />
            <table className="admin-kyc-table admin-data-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Applicant</th>
                  <th scope="col">Status</th>
                  <th scope="col">Document</th>
                  <th scope="col">City</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Files</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission, index) => {
                  const queueNumber = (page - 1) * limit + index + 1;

                  return (
                    <tr key={submission.id}>
                      <td className="admin-kyc-table-index">{queueNumber}</td>
                      <td className="admin-kyc-table-applicant">
                        <strong>{submission.legalName}</strong>
                        <span className="admin-profiles-meta">
                          {submission.artisan?.displayName ||
                            submission.artisan?.user?.email ||
                            'Artisan submission'}
                        </span>
                      </td>
                      <td>
                        <span className={`booking-status ${statusClass(submission.status)}`}>
                          {statusLabel(submission.status)}
                        </span>
                      </td>
                      <td className="admin-kyc-table-doc">
                        <strong>{submission.documentType}</strong>
                        <span className="admin-profiles-meta">
                          {maskDocumentNumber(submission.documentNumber)}
                        </span>
                      </td>
                      <td>{submission.city}</td>
                      <td className="admin-data-table-nowrap">{bookingDate(submission.submittedAt)}</td>
                      <td className="admin-data-table-clip">{fileSummary(submission)}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button admin-data-table-action"
                          disabled={busy}
                          onClick={() => setActiveSubmissionId(submission.id)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} limit={limit} total={total} busy={busy || loading} onPageChange={setPage} />
      </article>
    </section>
  );
}
