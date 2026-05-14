import { api } from '../lib/api';
import { bookingDate, paymentLabel, statusLabel } from '../lib/bookingDisplay';
import { money } from '../lib/formatting';
import type { ActionRunner } from '../appTypes';
import type { Booking } from '../types';
import { EmptyState } from '../components/EmptyState';

export function AdminBookingsPanel({
  token,
  bookings,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  bookings: Booking[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
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
    <section className="admin-bookings">
      <div className="section-head compact">
        <div>
          <p className="eyebrow">Payments</p>
          <h2>Held booking funds</h2>
          <p>Release artisan payouts only after service completion and internal review.</p>
        </div>
      </div>

      {bookings.length === 0 && (
        <EmptyState
          title="No admin bookings yet"
          body="Completed and paid bookings will appear here once customers start transacting."
        />
      )}

      <div className="booking-list">
        {bookings.map((booking) => {
          const paymentStatus = booking.payment?.status;
          const openDispute = booking.disputes?.find(
            (dispute) =>
              dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW'
          );
          const canRelease =
            booking.status === 'COMPLETED' &&
            paymentStatus === 'PAID_HELD' &&
            !openDispute;

          return (
            <article className="booking-detail-card" key={booking.id}>
              <header className="booking-detail-head">
                <div className="booking-person">
                  <span>{(booking.artisan?.displayName || 'B').slice(0, 1).toUpperCase()}</span>
                  <div>
                    <h3>{booking.artisan?.displayName || 'Artisan profile'}</h3>
                    <p>{booking.offering?.title || booking.offering?.category?.name || 'Service booking'}</p>
                  </div>
                </div>
                <div className="admin-status-stack">
                  <span className={`booking-status ${booking.status.toLowerCase()}`}>{statusLabel(booking.status)}</span>
                  <span className={`payment-chip ${(paymentStatus || 'UNPAID').toLowerCase()}`}>
                    {paymentLabel(paymentStatus)}
                  </span>
                </div>
              </header>

              <dl className="booking-detail-list">
                <div>
                  <dt>Customer</dt>
                  <dd>{booking.customerUser?.email || 'Unknown customer'}</dd>
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
                  <dt>Provider earns</dt>
                  <dd>{booking.payment ? money(booking.payment.providerEarning) : 'Pending payment'}</dd>
                </div>
                <div>
                  <dt>Disputes</dt>
                  <dd>{openDispute ? openDispute.status.toLowerCase().replace(/_/g, ' ') : booking.disputes?.length || 0}</dd>
                </div>
              </dl>

              <div className="booking-card-actions">
                {openDispute && (
                  <>
                    <button
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
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () => resolveDispute(openDispute.id, 'REFUND_PARTIAL'),
                          'Dispute resolved with partial refund'
                        )
                      }
                    >
                      Partial refund
                    </button>
                  </>
                )}
                {canRelease ? (
                  <button
                    className="primary-action"
                    disabled={busy}
                    onClick={() => runAction(() => releasePayment(booking.id), 'Payout released to artisan')}
                  >
                    Release payout
                  </button>
                ) : !openDispute ? (
                  <button className="secondary-button" disabled>
                    {paymentStatus === 'RELEASED'
                      ? 'Already released'
                      : paymentStatus === 'PAID_HELD'
                        ? 'Awaiting completion'
                        : 'No held funds yet'}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}