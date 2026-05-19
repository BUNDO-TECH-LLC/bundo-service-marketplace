import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { PromptDialog } from '../components/PromptDialog';
import { bookingDate, paymentLabel } from '../lib/bookingDisplay';
import { canStartOrCompleteBooking } from '../lib/bookingPayment';
import { money } from '../lib/formatting';
import {
  adminJobFilterCounts,
  filterAdminJobs,
  jobStageClass,
  jobStageLabel,
  type AdminBooking,
  type AdminJobFilter,
} from '../lib/adminJobStages';
import type { ActionRunner, AdminSection, AdminUserRecord } from '../appTypes';
import type { Booking } from '../types';
import { EmptyState } from '../components/EmptyState';
import { AdminJobChat } from './AdminJobChat';

const filters: Array<{ id: AdminJobFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'requests', label: 'Requests' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'ongoing', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'payouts', label: 'Payouts' },
];

function moderatorLabel(user: AdminUserRecord) {
  return user.email || user.phone || user.firebaseUid.slice(0, 8);
}

export function AdminBookingsPanel({
  token,
  bookings,
  bookingsTotal,
  adminUsers,
  busy,
  runAction,
  refresh,
  setSection,
  onOpenConversation,
}: {
  token: string;
  bookings: Booking[];
  bookingsTotal?: number;
  adminUsers: AdminUserRecord[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  setSection: (section: AdminSection) => void;
  onOpenConversation: (conversationId: string) => void;
}) {
  const [filter, setFilter] = useState<AdminJobFilter>('all');
  const [moderatorFilter, setModeratorFilter] = useState<'all' | 'unassigned' | string>('all');
  const [expandedChatId, setExpandedChatId] = useState<string | null>(null);
  const [expandedActionsId, setExpandedActionsId] = useState<string | null>(null);
  const [jobs, setJobs] = useState(bookings);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(bookingsTotal ?? bookings.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [disputePrompt, setDisputePrompt] = useState<null | {
    disputeId: string;
    action: 'RELEASE' | 'REFUND_FULL' | 'REFUND_PARTIAL';
    step: 'note' | 'amount';
    note?: string;
  }>(null);

  useEffect(() => {
    setJobs(bookings);
    setPage(1);
    setTotal(bookingsTotal ?? bookings.length);
  }, [bookings, bookingsTotal]);

  useEffect(() => {
    if (moderatorFilter === 'all') {
      return;
    }

    let mounted = true;
    const params = new URLSearchParams({ page: '1', limit: '200', moderatorId: moderatorFilter });
    api<{ bookings: Booking[]; meta: { total: number } }>(`/admin/bookings?${params}`, { token })
      .then((response) => {
        if (!mounted) return;
        setJobs(response.bookings);
        setPage(1);
        setTotal(response.meta.total);
      })
      .catch(() => {
        if (!mounted) return;
      });

    return () => {
      mounted = false;
    };
  }, [moderatorFilter, token]);

  const jobBookings = jobs as AdminBooking[];
  const adminModerators = useMemo(
    () => adminUsers.filter((user) => user.role === 'ADMIN' && user.status === 'ACTIVE'),
    [adminUsers]
  );
  const counts = useMemo(() => adminJobFilterCounts(jobBookings), [jobBookings]);
  const visibleJobs = useMemo(
    () => filterAdminJobs(jobBookings, filter),
    [filter, jobBookings]
  );
  const loadedCount = jobBookings.length;
  const totalCount = total;

  async function loadMoreJobs() {
    if (loadingMore || loadedCount >= totalCount) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const params = new URLSearchParams({ page: String(nextPage), limit: '200' });
      if (moderatorFilter !== 'all') {
        params.set('moderatorId', moderatorFilter);
      }
      const response = await api<{ bookings: Booking[]; meta: { total: number } }>(
        `/admin/bookings?${params}`,
        { token }
      );
      setJobs((current) => [...current, ...response.bookings]);
      setPage(nextPage);
      setTotal(response.meta.total);
    } finally {
      setLoadingMore(false);
    }
  }

  async function submitDisputeResolution(resolutionInput: string) {
    if (!disputePrompt) return;

    if (disputePrompt.step === 'note') {
      if (disputePrompt.action === 'REFUND_PARTIAL') {
        setDisputePrompt({ ...disputePrompt, step: 'amount', note: resolutionInput });
        return;
      }

      await api(`/admin/disputes/${disputePrompt.disputeId}/resolve`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          action: disputePrompt.action,
          resolution: resolutionInput || undefined,
        }),
      });
      setDisputePrompt(null);
      await refresh();
      return;
    }

    await api(`/admin/disputes/${disputePrompt.disputeId}/resolve`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        action: disputePrompt.action,
        resolution: disputePrompt.note || undefined,
        refundAmount: Number(resolutionInput),
      }),
    });
    setDisputePrompt(null);
    await refresh();
  }

  function startDisputeResolution(
    disputeId: string,
    action: 'RELEASE' | 'REFUND_FULL' | 'REFUND_PARTIAL'
  ) {
    setDisputePrompt({ disputeId, action, step: 'note' });
  }

  async function updateStatus(bookingId: string, status: Booking['status']) {
    await api(`/admin/bookings/${bookingId}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  async function confirmAppointment(bookingId: string) {
    await updateStatus(bookingId, 'ACCEPTED');
  }

  async function releasePayment(bookingId: string) {
    await api(`/admin/bookings/${bookingId}/release-payment`, {
      method: 'POST',
      token,
    });
    await refresh();
  }

  async function assignModerator(bookingId: string, moderatorId: string | null) {
    await api(`/admin/bookings/${bookingId}/moderator`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ moderatorId }),
    });
    await refresh();
  }

  return (
    <section className="admin-jobs">
      <header className="admin-panel-head">
        <div>
          <p className="eyebrow">Jobs</p>
          <h2>Booking lifecycle and support</h2>
          <p>
            Showing {loadedCount} of {totalCount} jobs. Assign a moderator, update status, chat, and resolve payouts from each row.
          </p>
        </div>
      </header>

      <div className="admin-job-filters" role="tablist" aria-label="Job filters">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? 'active' : ''}
            onClick={() => setFilter(item.id)}
          >
            <span>{item.label}</span>
            <strong>{counts[item.id]}</strong>
          </button>
        ))}
      </div>

      <div className="admin-job-moderator-filters" role="group" aria-label="Filter by moderator">
        <button
          type="button"
          className={moderatorFilter === 'all' ? 'active' : ''}
          onClick={() => setModeratorFilter('all')}
        >
          All moderators
        </button>
        <button
          type="button"
          className={moderatorFilter === 'unassigned' ? 'active' : ''}
          onClick={() => setModeratorFilter('unassigned')}
        >
          Unassigned
        </button>
        {adminModerators.map((admin) => (
          <button
            key={admin.firebaseUid}
            type="button"
            className={moderatorFilter === admin.firebaseUid ? 'active' : ''}
            onClick={() => setModeratorFilter(admin.firebaseUid)}
          >
            {moderatorLabel(admin)}
          </button>
        ))}
      </div>

      {totalCount > loadedCount && (
        <div className="admin-list-hint-row">
          <p className="admin-list-hint" role="status">
            Showing {loadedCount} of {totalCount} jobs.
          </p>
          <button
            type="button"
            className="secondary-button"
            disabled={loadingMore || busy}
            onClick={() => void loadMoreJobs()}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {visibleJobs.length === 0 && (
        <EmptyState
          title="No jobs in this queue"
          body="Switch filters or wait for new booking activity."
        />
      )}

      <div className="admin-inline-table" role="list">
        {visibleJobs.map((booking) => {
          const paymentStatus = booking.payment?.status;
          const openDispute = booking.disputes?.find(
            (dispute) =>
              dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW'
          );
          const paymentSecured = canStartOrCompleteBooking(booking);
          const canRelease =
            booking.status === 'COMPLETED' &&
            paymentStatus === 'PAID_HELD' &&
            !openDispute;
          const isAppointment = booking.status === 'ACCEPTED';
          const chatOpen = expandedChatId === booking.id;
          const actionsOpen = expandedActionsId === booking.id;
          const conversationId = booking.conversationId;
          const title =
            booking.offering?.title || booking.offering?.category?.name || 'Service booking';

          return (
            <article className="admin-row admin-row--job" key={booking.id} role="listitem">
              {isAppointment && (
                <p className="admin-row-banner" role="status">
                  <strong>New appointment</strong> — coordinate in chat when ready.
                </p>
              )}

              <div className="admin-row-grid">
                <div className="admin-row-primary">
                  <div className="admin-row-title-line">
                    <span className="admin-row-id">#{booking.id.slice(0, 8)}</span>
                    <strong className="admin-row-title">{title}</strong>
                  </div>
                  <p className="admin-row-sub">
                    {booking.artisan?.displayName || 'Artisan'} · {bookingDate(booking.scheduledAt)}
                  </p>
                  <div className="admin-row-chips">
                    <span className={`booking-status ${jobStageClass(booking.status)}`}>
                      {jobStageLabel(booking.status)}
                    </span>
                    <span className={`payment-chip ${(paymentStatus || 'UNPAID').toLowerCase()}`}>
                      {paymentLabel(paymentStatus)}
                    </span>
                    {openDispute && (
                      <span className="booking-status cancelled">Dispute open</span>
                    )}
                  </div>
                </div>

                <dl className="admin-row-fields">
                  <div>
                    <dt>Customer</dt>
                    <dd title={booking.customerUser?.email || undefined}>
                      {booking.customerUser?.email || booking.customerUser?.phone || 'Unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt>Artisan</dt>
                    <dd title={booking.artisan?.displayName || undefined}>
                      {booking.artisan?.displayName || 'Unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{booking.artisan?.city || '—'}</dd>
                  </div>
                  <div>
                    <dt>Amount</dt>
                    <dd>
                      {booking.payment
                        ? money(booking.payment.amount)
                        : money(booking.offering?.priceFrom || 0)}
                    </dd>
                  </div>
                  <div className="admin-row-fields-note">
                    <dt>Note</dt>
                    <dd title={booking.note?.trim() || undefined}>
                      {booking.note?.trim() || '—'}
                    </dd>
                  </div>
                </dl>

                <label className="admin-row-moderator">
                  <span>Moderator</span>
                  <select
                    value={booking.moderatorId || ''}
                    disabled={busy}
                    onChange={(event) => {
                      const value = event.target.value;
                      runAction(
                        () => assignModerator(booking.id, value || null),
                        value ? 'Moderator assigned' : 'Moderator cleared'
                      );
                    }}
                  >
                    <option value="">Unassigned</option>
                    {adminModerators.map((admin) => (
                      <option key={admin.firebaseUid} value={admin.firebaseUid}>
                        {moderatorLabel(admin)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="admin-row-toolbar">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setExpandedActionsId(actionsOpen ? null : booking.id)
                    }
                  >
                    {actionsOpen ? 'Hide actions' : 'Actions'}
                  </button>
                  {conversationId && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setExpandedChatId(chatOpen ? null : booking.id)}
                    >
                      {chatOpen ? 'Hide chat' : 'Chat'}
                    </button>
                  )}
                </div>
              </div>

              {actionsOpen && (
                <div className="admin-row-actions">
                  {booking.status === 'REQUESTED' && (
                    <button
                      type="button"
                      className="primary-action"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () => confirmAppointment(booking.id),
                          'Appointment confirmed'
                        )
                      }
                    >
                      Confirm
                    </button>
                  )}
                  {!paymentSecured && ['ACCEPTED', 'ONGOING'].includes(booking.status) && (
                    <p className="booking-payment-notice" role="status">
                      Payment not secured — cannot progress this job.
                    </p>
                  )}
                  {booking.status === 'ACCEPTED' && (
                    <button
                      type="button"
                      className="primary-action"
                      disabled={busy || !paymentSecured}
                      onClick={() =>
                        runAction(
                          () => updateStatus(booking.id, 'ONGOING'),
                          'Job marked in progress'
                        )
                      }
                    >
                      Start
                    </button>
                  )}
                  {(booking.status === 'ACCEPTED' || booking.status === 'ONGOING') && (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy || !paymentSecured}
                      onClick={() =>
                        runAction(
                          () => updateStatus(booking.id, 'COMPLETED'),
                          'Job marked completed'
                        )
                      }
                    >
                      Complete
                    </button>
                  )}
                  {conversationId && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        onOpenConversation(conversationId);
                        setSection('messages');
                      }}
                    >
                      Full support view
                    </button>
                  )}
                  {openDispute && (
                    <>
                      <button
                        type="button"
                        className="primary-action"
                        disabled={busy}
                        onClick={() => startDisputeResolution(openDispute.id, 'RELEASE')}
                      >
                        Resolve & release
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={busy}
                        onClick={() => startDisputeResolution(openDispute.id, 'REFUND_FULL')}
                      >
                        Full refund
                      </button>
                    </>
                  )}
                  {canRelease && (
                    <button
                      type="button"
                      className="primary-action"
                      disabled={busy}
                      onClick={() =>
                        runAction(() => releasePayment(booking.id), 'Payout released')
                      }
                    >
                      Release payout
                    </button>
                  )}
                </div>
              )}

              {chatOpen && conversationId && (
                <AdminJobChat
                  token={token}
                  conversationId={conversationId}
                  busy={busy}
                  runAction={runAction}
                />
              )}
            </article>
          );
        })}
      </div>

      <PromptDialog
        open={disputePrompt !== null}
        title={
          disputePrompt?.step === 'amount'
            ? 'Partial refund amount'
            : disputePrompt?.action === 'RELEASE'
              ? 'Resolve dispute — release payout'
              : 'Resolve dispute — refund'
        }
        message={
          disputePrompt?.step === 'note'
            ? 'Add a short admin note for the audit trail.'
            : 'Enter the refund amount in NGN.'
        }
        label={disputePrompt?.step === 'amount' ? 'Amount (NGN)' : 'Admin note'}
        inputType={disputePrompt?.step === 'amount' ? 'number' : 'text'}
        confirmLabel={disputePrompt?.step === 'amount' ? 'Issue refund' : 'Continue'}
        busy={busy}
        onCancel={() => setDisputePrompt(null)}
        onConfirm={(value) => runAction(() => submitDisputeResolution(value), 'Dispute resolved')}
      />
    </section>
  );
}
