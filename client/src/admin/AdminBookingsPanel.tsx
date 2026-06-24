import { Fragment, useEffect, useMemo, useState } from 'react';
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
import type { Booking, Payout } from '../types';
import { EmptyState } from '../components/EmptyState';
import { AdminToast } from '../components/AdminToast';
import { AdminJobChat } from './AdminJobChat';
import { AdminPayoutDialog } from './AdminPayoutDialog';
import { AdminTableScrollHint } from './AdminTableScrollHint';

const filters: Array<{ id: AdminJobFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'requests', label: 'Requests' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'ongoing', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'declined', label: 'Declined' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'payouts', label: 'Payouts' },
];

function moderatorLabel(user: AdminUserRecord) {
  return user.email || user.phone || user.firebaseUid.slice(0, 8);
}

function customerLabel(booking: Booking) {
  return booking.customerUser?.email || booking.customerUser?.phone || 'Unknown';
}

function jobRowContext(booking: AdminBooking) {
  const paymentStatus = booking.payment?.status;
  const openDispute = booking.disputes?.find(
    (dispute) => dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW'
  );
  const paymentSecured = canStartOrCompleteBooking(booking);
  const awaitingOtpPayout = booking.payouts?.find((payout) => payout.status === 'PENDING');
  const processingPayout = booking.payouts?.find((payout) => payout.status === 'PROCESSING');
  const releasableNow =
    paymentStatus === 'PAID_HELD' ||
    paymentStatus === 'PARTIALLY_RELEASED' ||
    paymentStatus === 'PARTIALLY_REFUNDED';
  const canReleaseOnDispute =
    Boolean(openDispute) &&
    (paymentStatus === 'PAID_HELD' ||
      paymentStatus === 'PARTIALLY_RELEASED' ||
      paymentStatus === 'PARTIALLY_REFUNDED');
  const canRefundOnDispute =
    Boolean(openDispute) &&
    paymentStatus === 'PAID_HELD' &&
    (booking.payment?.releasedAmount ?? 0) === 0;
  const canRelease =
    releasableNow &&
    !['CANCELLED', 'DECLINED'].includes(booking.status) &&
    !openDispute &&
    !awaitingOtpPayout &&
    !processingPayout;
  const title = booking.offering?.title || booking.offering?.category?.name || 'Service booking';
  const amount =
    booking.payment?.amount ?? booking.agreedAmount ?? booking.offering?.priceFrom ?? 0;

  return {
    paymentStatus,
    openDispute,
    paymentSecured,
    awaitingOtpPayout,
    processingPayout,
    canReleaseOnDispute,
    canRefundOnDispute,
    canRelease,
    title,
    amount,
    isAppointment: booking.status === 'ACCEPTED',
    conversationId: booking.conversationId,
  };
}

export function AdminBookingsPanel({
  token,
  bookings,
  bookingsTotal,
  busy,
  runAction,
  refresh,
  setSection,
  onOpenConversation,
  navigationIntent,
}: {
  token: string;
  bookings: Booking[];
  bookingsTotal?: number;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  setSection: (section: AdminSection) => void;
  onOpenConversation: (conversationId: string) => void;
  navigationIntent?: { token: number; intent: { jobs?: { filter?: AdminJobFilter } } } | null;
}) {
  const [filter, setFilter] = useState<AdminJobFilter>('all');
  const [moderatorFilter, setModeratorFilter] = useState<'all' | 'unassigned' | string>('all');
  const [moderatorUsers, setModeratorUsers] = useState<AdminUserRecord[]>([]);
  const [expandedChatId, setExpandedChatId] = useState<string | null>(null);
  const [expandedActionsId, setExpandedActionsId] = useState<string | null>(null);
  const [jobs, setJobs] = useState(bookings);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(bookingsTotal ?? bookings.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [disputePrompt, setDisputePrompt] = useState<null | {
    disputeId: string;
    action: 'RELEASE' | 'REFUND_FULL' | 'REFUND_PARTIAL' | 'CLOSE';
    step: 'note' | 'amount';
    note?: string;
  }>(null);
  const [payoutOtpPrompt, setPayoutOtpPrompt] = useState<null | {
    payoutId: string;
    bookingId: string;
    title: string;
    resolution?: string;
  }>(null);
  const [payoutDialogBooking, setPayoutDialogBooking] = useState<Booking | null>(null);
  const [moderatorToast, setModeratorToast] = useState<string | null>(null);

  useEffect(() => {
    setJobs(bookings);
    setPage(1);
    setTotal(bookingsTotal ?? bookings.length);
  }, [bookings, bookingsTotal]);

  useEffect(() => {
    const jobsIntent = navigationIntent?.intent.jobs;
    if (!jobsIntent?.filter) return;
    setFilter(jobsIntent.filter);
    setExpandedChatId(null);
    setExpandedActionsId(null);
  }, [navigationIntent?.token, navigationIntent?.intent.jobs]);

  // Load the moderator (admin) list directly so assignment always works,
  // regardless of which admin section was visited first.
  useEffect(() => {
    let mounted = true;
    api<{ users: AdminUserRecord[] }>('/admin/users?page=1&limit=100', { token })
      .then((response) => {
        if (mounted) setModeratorUsers(response.users ?? []);
      })
      .catch(() => {
        if (mounted) setModeratorUsers([]);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

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
    () => moderatorUsers.filter((user) => user.role === 'ADMIN' && user.status === 'ACTIVE'),
    [moderatorUsers]
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

      const response = await api<{
        requiresOtp?: boolean;
        payout?: Payout;
      }>(`/admin/disputes/${disputePrompt.disputeId}/resolve`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          action: disputePrompt.action,
          resolution: resolutionInput || undefined,
        }),
      });

      if (response.requiresOtp && response.payout) {
        const booking = jobBookings.find((item) => item.id === response.payout?.bookingId);
        setPayoutOtpPrompt({
          payoutId: response.payout.id,
          bookingId: response.payout.bookingId,
          title: booking?.offering?.title || booking?.offering?.category?.name || 'this booking',
          resolution: resolutionInput || undefined,
        });
      }

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
    action: 'RELEASE' | 'REFUND_FULL' | 'REFUND_PARTIAL' | 'CLOSE'
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

  async function approveCancellationRefund(paymentId: string) {
    await api(`/admin/payments/${paymentId}/approve-cancellation-refund`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        resolution: 'Cancellation refund approved from admin jobs panel',
      }),
    });
    await refresh();
  }

  async function confirmAppointment(bookingId: string) {
    await updateStatus(bookingId, 'ACCEPTED');
  }

  async function handlePayoutReleased(
    response: { requiresOtp?: boolean; payout?: Payout },
    booking: Booking
  ) {
    if (response.requiresOtp && response.payout) {
      const title = booking.offering?.title || booking.offering?.category?.name || 'this booking';
      setPayoutOtpPrompt({
        payoutId: response.payout.id,
        bookingId: booking.id,
        title,
      });
    }

    await refresh();
  }

  async function finalizePayoutOtp(otp: string) {
    if (!payoutOtpPrompt) return;

    await api(`/admin/payouts/${payoutOtpPrompt.payoutId}/finalize-otp`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        otp,
        resolution: payoutOtpPrompt.resolution,
      }),
    });
    setPayoutOtpPrompt(null);
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

  function handleModeratorAssign(
    booking: AdminBooking,
    moderatorId: string | null,
    moderatorName: string | null
  ) {
    const jobTitle =
      booking.offering?.title || booking.offering?.category?.name || 'this job';

    void runAction(async () => {
      await assignModerator(booking.id, moderatorId);
      setModeratorToast(
        moderatorId && moderatorName
          ? `${moderatorName} assigned to ${jobTitle}`
          : `Moderator cleared for ${jobTitle}`
      );
    }, '');
  }

  return (
    <section className="admin-jobs admin-panel">
      <article className="admin-surface">
        <div className="admin-surface-head">
          <div>
            <p className="eyebrow">Operations queue</p>
            <h3>Jobs</h3>
            <p className="admin-panel-lead muted">
              Showing {loadedCount} of {totalCount} jobs. Scroll the table to review details, assign
              moderators, and open actions without leaving the queue.
            </p>
          </div>
          <span className="admin-surface-count">{visibleJobs.length}</span>
        </div>

      <div className="admin-jobs-toolbar">
        <label className="admin-jobs-status-filter">
          <span>Status</span>
          <select
            value={filter}
            disabled={busy}
            aria-label="Filter jobs by status"
            onChange={(event) => setFilter(event.target.value as AdminJobFilter)}
          >
            {filters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({counts[item.id]})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="admin-job-filters" role="tablist" aria-label="Filter jobs by status">
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

      {visibleJobs.length > 0 && (
        <div className="admin-table-scroll-wrap admin-jobs-table-wrap">
          <AdminTableScrollHint />
          <table className="admin-jobs-table admin-data-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Service</th>
                <th scope="col">Customer</th>
                <th scope="col">Artisan</th>
                <th scope="col">Scheduled</th>
                <th scope="col">Location</th>
                <th scope="col">Stage</th>
                <th scope="col">Payment</th>
                <th scope="col">Amount</th>
                <th scope="col">Moderator</th>
                <th scope="col">Access</th>
              </tr>
            </thead>
            <tbody>
              {visibleJobs.map((booking, index) => {
                const ctx = jobRowContext(booking);
                const chatOpen = expandedChatId === booking.id;
                const actionsOpen = expandedActionsId === booking.id;

                return (
                  <Fragment key={booking.id}>
                    <tr
                      className={
                        ctx.isAppointment ? 'admin-jobs-table-row admin-jobs-table-row--highlight' : 'admin-jobs-table-row'
                      }
                    >
                      <td className="admin-jobs-table-index" data-label="#">
                        {index + 1}
                      </td>
                      <td className="admin-jobs-table-service" data-label="Service">
                        <strong title={ctx.title}>{ctx.title}</strong>
                        <span className="admin-jobs-table-meta">#{booking.id.slice(0, 8)}</span>
                        {booking.note?.trim() ? (
                          <span className="admin-jobs-table-note" title={booking.note.trim()}>
                            {booking.note.trim()}
                          </span>
                        ) : null}
                        {ctx.isAppointment ? (
                          <span className="admin-jobs-table-flag">New appointment</span>
                        ) : null}
                      </td>
                      <td data-label="Customer" title={customerLabel(booking)}>
                        {customerLabel(booking)}
                      </td>
                      <td data-label="Artisan" title={booking.artisan?.displayName || undefined}>
                        {booking.artisan?.displayName || 'Unknown'}
                      </td>
                      <td className="admin-jobs-table-nowrap" data-label="Scheduled">
                        {bookingDate(booking.scheduledAt)}
                      </td>
                      <td data-label="Location">{booking.artisan?.city || '—'}</td>
                      <td data-label="Stage">
                        <span className={`booking-status ${jobStageClass(booking.status)}`}>
                          {jobStageLabel(booking.status)}
                        </span>
                      </td>
                      <td data-label="Payment">
                        <div className="admin-jobs-table-chips">
                          <span
                            className={`payment-chip ${(ctx.paymentStatus || 'UNPAID').toLowerCase()}`}
                          >
                            {paymentLabel(ctx.paymentStatus)}
                          </span>
                          {ctx.openDispute ? (
                            <span className="booking-status cancelled">Dispute</span>
                          ) : null}
                          {ctx.awaitingOtpPayout ? (
                            <span className="booking-status appointment">OTP</span>
                          ) : null}
                          {ctx.processingPayout ? (
                            <span className="booking-status ongoing">Processing</span>
                          ) : null}
                          {ctx.paymentStatus === 'REFUND_REQUESTED' ? (
                            <span className="booking-status appointment">Refund pending</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="admin-jobs-table-amount" data-label="Amount">
                        <strong>{money(ctx.amount)}</strong>
                        {booking.payment ? (
                          <span
                            className="admin-jobs-table-meta"
                            title={`Fee ${money(booking.payment.platformFee)} · Artisan ${money(booking.payment.providerEarning)}${
                              (booking.payment.releasedAmount ?? 0) > 0
                                ? ` · Released ${money(booking.payment.releasedAmount ?? 0)}`
                                : ''
                            }`}
                          >
                            Fee {money(booking.payment.platformFee)}
                          </span>
                        ) : null}
                      </td>
                      <td data-label="Moderator">
                        <select
                          className="admin-inline-select admin-jobs-table-select"
                          value={booking.moderatorId || ''}
                          disabled={busy}
                          aria-label={`Moderator for ${ctx.title}`}
                          onChange={(event) => {
                            const value = event.target.value;
                            const selected = value
                              ? adminModerators.find((admin) => admin.firebaseUid === value)
                              : null;
                            handleModeratorAssign(
                              booking,
                              value || null,
                              selected ? moderatorLabel(selected) : null
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
                      </td>
                      <td data-label="Access">
                        <div className="admin-jobs-table-access">
                          <button
                            type="button"
                            className="secondary-button admin-jobs-table-action"
                            onClick={() =>
                              setExpandedActionsId(actionsOpen ? null : booking.id)
                            }
                          >
                            {actionsOpen ? 'Hide' : 'Actions'}
                          </button>
                          {ctx.conversationId ? (
                            <button
                              type="button"
                              className="text-button admin-jobs-table-action"
                              onClick={() =>
                                setExpandedChatId(chatOpen ? null : booking.id)
                              }
                            >
                              {chatOpen ? 'Hide chat' : 'Chat'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>

                    {actionsOpen ? (
                      <tr className="admin-jobs-table-expand-row">
                        <td colSpan={11}>
                          <div className="admin-jobs-table-actions">
                            {booking.status === 'REQUESTED' && (
                              <button
                                type="button"
                                className="primary-action"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(
                                    () => confirmAppointment(booking.id),
                                    'Appointment confirmed'
                                  )
                                }
                              >
                                Confirm
                              </button>
                            )}
                            {!ctx.paymentSecured &&
                              ['ACCEPTED', 'ONGOING'].includes(booking.status) && (
                                <p className="booking-payment-notice" role="status">
                                  Payment not secured — cannot progress this job.
                                </p>
                              )}
                            {booking.status === 'ACCEPTED' && (
                              <button
                                type="button"
                                className="primary-action"
                                disabled={busy || !ctx.paymentSecured}
                                onClick={() =>
                                  void runAction(
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
                                disabled={busy || !ctx.paymentSecured}
                                onClick={() =>
                                  void runAction(
                                    () => updateStatus(booking.id, 'COMPLETED'),
                                    'Job marked completed'
                                  )
                                }
                              >
                                Complete
                              </button>
                            )}
                            {ctx.conversationId ? (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => {
                                  onOpenConversation(ctx.conversationId!);
                                  setSection('messages');
                                }}
                              >
                                Full support view
                              </button>
                            ) : null}
                            {ctx.openDispute ? (
                              <div className="admin-dispute-actions">
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled={busy}
                                  onClick={() =>
                                    startDisputeResolution(ctx.openDispute!.id, 'CLOSE')
                                  }
                                >
                                  Close dispute
                                </button>
                                {ctx.canReleaseOnDispute ? (
                                  <button
                                    type="button"
                                    className="primary-action"
                                    disabled={busy}
                                    onClick={() =>
                                      startDisputeResolution(ctx.openDispute!.id, 'RELEASE')
                                    }
                                  >
                                    Resolve & release
                                  </button>
                                ) : null}
                                {ctx.canRefundOnDispute ? (
                                  <>
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      disabled={busy}
                                      onClick={() =>
                                        startDisputeResolution(ctx.openDispute!.id, 'REFUND_FULL')
                                      }
                                    >
                                      Full refund
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      disabled={busy}
                                      onClick={() =>
                                        startDisputeResolution(
                                          ctx.openDispute!.id,
                                          'REFUND_PARTIAL'
                                        )
                                      }
                                    >
                                      Partial refund
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                            {!ctx.openDispute &&
                              ['REQUESTED', 'ACCEPTED', 'ONGOING'].includes(booking.status) && (
                                <button
                                  type="button"
                                  className="admin-danger-button"
                                  disabled={busy}
                                  onClick={() =>
                                    void runAction(
                                      () => updateStatus(booking.id, 'CANCELLED'),
                                      'Job cancelled'
                                    )
                                  }
                                >
                                  Cancel job
                                </button>
                              )}
                            {ctx.paymentStatus === 'REFUND_REQUESTED' && booking.payment?.id ? (
                              <button
                                type="button"
                                className="primary-action"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(
                                    () => approveCancellationRefund(booking.payment!.id),
                                    'Cancellation refund approved'
                                  )
                                }
                              >
                                Approve cancellation refund
                              </button>
                            ) : null}
                            {ctx.canRelease ? (
                              <button
                                type="button"
                                className="primary-action"
                                disabled={busy}
                                onClick={() => setPayoutDialogBooking(booking)}
                              >
                                {ctx.paymentStatus === 'PARTIALLY_RELEASED'
                                  ? 'Release more'
                                  : 'Release payout'}
                              </button>
                            ) : null}
                            {ctx.awaitingOtpPayout ? (
                              <button
                                type="button"
                                className="primary-action"
                                disabled={busy}
                                onClick={() =>
                                  setPayoutOtpPrompt({
                                    payoutId: ctx.awaitingOtpPayout!.id,
                                    bookingId: booking.id,
                                    title: ctx.title,
                                  })
                                }
                              >
                                Enter payout OTP
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}

                    {chatOpen && ctx.conversationId ? (
                      <tr className="admin-jobs-table-expand-row">
                        <td colSpan={11}>
                          <AdminJobChat
                            token={token}
                            conversationId={ctx.conversationId}
                            busy={busy}
                            runAction={runAction}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PromptDialog
        open={disputePrompt !== null}
        title={
          disputePrompt?.step === 'amount'
            ? 'Partial refund amount'
            : disputePrompt?.action === 'CLOSE'
              ? 'Close dispute'
              : disputePrompt?.action === 'RELEASE'
                ? 'Resolve dispute — release payout'
                : 'Resolve dispute — refund'
        }
        message={
          disputePrompt?.step === 'note'
            ? disputePrompt?.action === 'CLOSE'
              ? 'Record why this dispute is closed. No refund or payout will be processed.'
              : 'Add a short admin note for the audit trail.'
            : 'Enter the refund amount in NGN.'
        }
        label={disputePrompt?.step === 'amount' ? 'Amount (NGN)' : 'Admin note'}
        inputType={disputePrompt?.step === 'amount' ? 'number' : 'text'}
        confirmLabel={
          disputePrompt?.step === 'amount'
            ? 'Issue refund'
            : disputePrompt?.action === 'CLOSE'
              ? 'Close dispute'
              : 'Continue'
        }
        busy={busy}
        onCancel={() => setDisputePrompt(null)}
        onConfirm={(value) =>
          runAction(
            () => submitDisputeResolution(value),
            disputePrompt?.action === 'CLOSE' ? 'Dispute closed' : 'Dispute resolved'
          )
        }
      />
      <AdminPayoutDialog
        open={payoutDialogBooking !== null}
        booking={payoutDialogBooking}
        token={token}
        onClose={() => setPayoutDialogBooking(null)}
        onReleased={handlePayoutReleased}
      />
      <PromptDialog
        open={payoutOtpPrompt !== null}
        title="Authorize Paystack payout"
        message={`Enter the OTP Paystack sent for ${payoutOtpPrompt?.title || 'this payout'}. Funds stay held until this OTP is accepted.`}
        label="Paystack OTP"
        inputType="text"
        confirmLabel="Authorize payout"
        busy={busy}
        onCancel={() => setPayoutOtpPrompt(null)}
        onConfirm={(value) => runAction(() => finalizePayoutOtp(value), 'Payout authorized')}
      />

      {moderatorToast ? (
        <AdminToast message={moderatorToast} onDismiss={() => setModeratorToast(null)} />
      ) : null}
      </article>
    </section>
  );
}
