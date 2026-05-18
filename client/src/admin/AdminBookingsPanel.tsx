import { useMemo, useState } from 'react';
import { api } from '../lib/api';
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
import type { ActionRunner, AdminSection } from '../appTypes';
import type { Booking } from '../types';
import { EmptyState } from '../components/EmptyState';
import { AdminJobChat } from './AdminJobChat';

const filters: Array<{ id: AdminJobFilter; label: string }> = [
  { id: 'all', label: 'All jobs' },
  { id: 'requests', label: 'New requests' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'ongoing', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'payouts', label: 'Payouts' },
];

export function AdminBookingsPanel({
  token,
  bookings,
  busy,
  runAction,
  refresh,
  setSection,
  onOpenConversation,
}: {
  token: string;
  bookings: Booking[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  setSection: (section: AdminSection) => void;
  onOpenConversation: (conversationId: string) => void;
}) {
  const [filter, setFilter] = useState<AdminJobFilter>('all');
  const [expandedChatId, setExpandedChatId] = useState<string | null>(null);

  const jobBookings = bookings as AdminBooking[];
  const counts = useMemo(() => adminJobFilterCounts(jobBookings), [jobBookings]);
  const visibleJobs = useMemo(
    () => filterAdminJobs(jobBookings, filter),
    [filter, jobBookings]
  );

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

  async function resolveDispute(
    disputeId: string,
    action: 'RELEASE' | 'REFUND_FULL' | 'REFUND_PARTIAL'
  ) {
    const resolution = window.prompt(
      action === 'RELEASE'
        ? 'Add a short admin note for this payout release'
        : 'Add a short admin note for this refund decision',
      ''
    );

    let refundAmount: number | undefined;

    if (action === 'REFUND_PARTIAL') {
      const rawAmount = window.prompt('Enter the refund amount in NGN', '');
      if (!rawAmount) {
        return;
      }
      refundAmount = Number(rawAmount);
    }

    await api(`/admin/disputes/${disputeId}/resolve`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        action,
        resolution: resolution || undefined,
        refundAmount,
      }),
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
            Track requests, appointments, active work, payouts, and jump into the client–artisan chat from any entry.
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

      {visibleJobs.length === 0 && (
        <EmptyState
          title="No jobs in this queue"
          body="Switch filters or wait for new booking activity."
        />
      )}

      <div className="admin-job-entries">
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
          const conversationId = booking.conversationId;

          return (
            <article className="admin-job-entry" key={booking.id}>
              {isAppointment && (
                <div className="appointment-notice" role="status">
                  <strong>New appointment</strong>
                  <span>Client and artisan are connected — coordinate in chat and mark progress when work starts.</span>
                </div>
              )}

              <div className="admin-job-entry-head">
                <div className="admin-job-entry-title">
                  <p className="eyebrow">Job #{booking.id.slice(0, 8)}</p>
                  <h3>{booking.offering?.title || booking.offering?.category?.name || 'Service booking'}</h3>
                  <p>{booking.artisan?.displayName || 'Artisan'} · {bookingDate(booking.scheduledAt)}</p>
                </div>
                <div className="admin-status-stack">
                  <span className={`booking-status ${jobStageClass(booking.status)}`}>
                    {jobStageLabel(booking.status)}
                  </span>
                  <span className={`payment-chip ${(paymentStatus || 'UNPAID').toLowerCase()}`}>
                    {paymentLabel(paymentStatus)}
                  </span>
                </div>
              </div>

              <dl className="admin-job-meta">
                <div>
                  <dt>Customer</dt>
                  <dd>{booking.customerUser?.email || 'Unknown customer'}</dd>
                </div>
                <div>
                  <dt>Artisan</dt>
                  <dd>{booking.artisan?.displayName || 'Unknown artisan'}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{booking.artisan?.city || 'Unknown city'}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{booking.payment ? money(booking.payment.amount) : money(booking.offering?.priceFrom || 0)}</dd>
                </div>
                <div>
                  <dt>Note</dt>
                  <dd>{booking.note?.trim() || 'No customer note'}</dd>
                </div>
                <div>
                  <dt>Disputes</dt>
                  <dd>
                    {openDispute
                      ? openDispute.status.toLowerCase().replace(/_/g, ' ')
                      : booking.disputes?.length || 0}
                  </dd>
                </div>
              </dl>

              <div className="admin-job-actions">
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
                    Confirm appointment
                  </button>
                )}
                {!paymentSecured && ['ACCEPTED', 'ONGOING'].includes(booking.status) && (
                  <p className="booking-payment-notice" role="status">
                    Customer payment is not secured yet — cannot start or complete this job.
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
                    Mark in progress
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
                    Mark completed
                  </button>
                )}

                {conversationId ? (
                  <>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setExpandedChatId(chatOpen ? null : booking.id)}
                    >
                      {chatOpen ? 'Hide chat' : 'Open chat'}
                    </button>
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
                  </>
                ) : (
                  <button type="button" className="secondary-button" disabled>
                    Chat unavailable
                  </button>
                )}

                {openDispute && (
                  <>
                    <button
                      type="button"
                      className="primary-action"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () => resolveDispute(openDispute.id, 'RELEASE'),
                          'Dispute resolved with artisan release'
                        )
                      }
                    >
                      Resolve and release
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () => resolveDispute(openDispute.id, 'REFUND_FULL'),
                          'Dispute resolved with full refund'
                        )
                      }
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
                      runAction(() => releasePayment(booking.id), 'Payout released to artisan')
                    }
                  >
                    Release payout
                  </button>
                )}
              </div>

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
    </section>
  );
}
